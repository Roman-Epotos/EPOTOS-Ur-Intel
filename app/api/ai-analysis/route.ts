import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

async function extractTextFromUrl(fileUrl: string, fileName: string): Promise<string> {
  const response = await fetch(fileUrl)
  const buffer = await response.arrayBuffer()

  if (fileName.toLowerCase().endsWith('.pdf')) {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PDFParser = require('pdf2json')
      const pdfParser = new PDFParser()
      pdfParser.on('pdfParser_dataReady', (pdfData: { Pages: Array<{ Texts: Array<{ R: Array<{ T: string }> }> }> }) => {
        const text = pdfData.Pages
          .map(page => page.Texts.map(t => decodeURIComponent(t.R[0]?.T ?? '')).join(' '))
          .join('\n')
        resolve(text)
      })
      pdfParser.on('pdfParser_dataError', () => resolve(''))
      pdfParser.parseBuffer(Buffer.from(buffer))
    })
  } else if (fileName.toLowerCase().endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) })
    return result.value
  }

  return ''
}

async function analyzeWithAI(text: string, analysisType: string): Promise<object> {
  const prompts: Record<string, string> = {
    legal_review: `Ты юридический эксперт. Проанализируй следующий договор и выдай структурированный анализ в формате JSON.

Договор:
${text.slice(0, 8000)}

Верни ТОЛЬКО валидный JSON без markdown в следующем формате:
{
  "red_flags": [
    {"severity": "high|medium|low", "title": "название риска", "description": "описание", "recommendation": "рекомендация"}
  ],
  "warnings": [
    {"title": "название", "description": "описание"}
  ],
  "positives": [
    {"title": "название", "description": "описание"}
  ],
  "overall_risk": "high|medium|low",
  "summary": "краткое общее заключение"
}`,

    passport: `Ты юридический эксперт. Создай паспорт следующего договора в формате JSON.

Договор:
${text.slice(0, 8000)}

Верни ТОЛЬКО валидный JSON без markdown в следующем формате:
{
  "essence": "суть договора в 2-3 предложениях",
  "parties": {
    "our_obligations": ["обязательство 1", "обязательство 2"],
    "counterparty_obligations": ["обязательство 1", "обязательство 2"]
  },
  "key_terms": {
    "amount": "сумма договора",
    "payment_terms": "условия оплаты",
    "start_date": "дата начала",
    "end_date": "дата окончания",
    "auto_renewal": "условия автопролонгации или нет"
  },
  "termination": "условия расторжения",
  "control_points": ["контрольная точка 1", "контрольная точка 2"],
  "attention_zones": ["зона внимания 1", "зона внимания 2"]
}`
  }

  const prompt = prompts[analysisType]
  if (!prompt) throw new Error('Неизвестный тип анализа')

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
      'X-Title': 'Эпотос-ЮрИнтел',
    },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  })

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content ?? '{}'

  // Очищаем от markdown если есть
  const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    return { error: 'Не удалось распарсить ответ AI', raw: content }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, version_id, file_url, file_name, analysis_type, user_name } = body

    if (!contract_id || !file_url || !analysis_type) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Создаём запись анализа со статусом processing
    const { data: analysis, error: createError } = await supabase
      .from('ai_analysis')
      .insert({
        contract_id,
        version_id: version_id ?? null,
        type: analysis_type,
        status: 'processing',
        model_used: 'openrouter/auto',
      })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    // Извлекаем текст из документа
    const text = await extractTextFromUrl(file_url, file_name)

    if (!text || text.length < 100) {
      await supabase
        .from('ai_analysis')
        .update({ status: 'error', result_json: { error: 'Не удалось извлечь текст из документа' } })
        .eq('id', analysis.id)

      return NextResponse.json({ error: 'Не удалось извлечь текст из документа' }, { status: 400 })
    }

    // Анализируем с AI
    const result = await analyzeWithAI(text, analysis_type)

    // Сохраняем результат
    await supabase
      .from('ai_analysis')
      .update({
        status: 'completed',
        result_json: result,
        prompt: text.slice(0, 500),
      })
      .eq('id', analysis.id)

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: analysis_type === 'legal_review' ? 'AI Legal Review выполнен' : 'AI Паспорт договора создан',
        details: `Анализ выполнен моделью openrouter/auto`,
        user_name: user_name ?? 'Система',
      })

    return NextResponse.json({ success: true, analysis_id: analysis.id, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id')
  const type = request.nextUrl.searchParams.get('type')

  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  let query = supabase
    .from('ai_analysis')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false })

  if (type) {
    query = query.eq('type', type)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ analyses: data ?? [] })
}