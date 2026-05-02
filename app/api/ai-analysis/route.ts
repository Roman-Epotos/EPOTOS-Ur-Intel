import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

async function extractTextFromPdf(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
    return text
  } catch (err) {
    console.error('PDF extraction error:', err)
    return ''
  }
}

async function extractTextFromDocx(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (err) {
    console.error('DOCX extraction error:', err)
    return ''
  }
}

async function extractTextFromXlsx(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const texts: string[] = []
    workbook.SheetNames.forEach((sheetName: string) => {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim()) texts.push(`Лист: ${sheetName}\n${csv}`)
    })
    return texts.join('\n\n')
  } catch (err) {
    console.error('XLSX extraction error:', err)
    return ''
  }
}

async function analyzeWithAI(text: string, analysisType: string): Promise<object> {
  const prompts: Record<string, string> = {
    legal_review: `You are a legal expert for EPOTOS company. Analyze the following contract and provide a structured risk analysis in JSON format. All text values in JSON must be in Russian language.

Contract text:
${text.slice(0, 8000)}

Return ONLY valid JSON without markdown:
{
  "red_flags": [
    {"severity": "high|medium|low", "title": "risk title in Russian", "description": "description in Russian", "recommendation": "recommendation in Russian"}
  ],
  "warnings": [
    {"title": "title in Russian", "description": "description in Russian"}
  ],
  "positives": [
    {"title": "title in Russian", "description": "description in Russian"}
  ],
  "overall_risk": "high|medium|low",
  "summary": "brief conclusion in Russian"
}`,

    passport: `You are a legal expert for EPOTOS company. Create a passport summary for the following contract in JSON format. All text values in JSON must be in Russian language.

Contract text:
${text.slice(0, 8000)}

Return ONLY valid JSON without markdown:
{
  "essence": "contract essence in 2-3 sentences in Russian",
  "parties": {
    "our_obligations": ["obligation 1 in Russian", "obligation 2 in Russian"],
    "counterparty_obligations": ["obligation 1 in Russian", "obligation 2 in Russian"]
  },
  "key_terms": {
    "amount": "contract amount in Russian",
    "payment_terms": "payment terms in Russian",
    "start_date": "start date in Russian",
    "end_date": "end date in Russian",
    "auto_renewal": "auto-renewal terms or none in Russian"
  },
  "termination": "termination conditions in Russian",
  "control_points": ["control point 1 in Russian", "control point 2 in Russian"],
  "attention_zones": ["attention zone 1 in Russian", "attention zone 2 in Russian"]
}`
  }

  const prompt = prompts[analysisType]
  if (!prompt) throw new Error('Неизвестный тип анализа')

  console.log('Calling OpenRouter, prompt length:', prompt.length)
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'Epotos-YurIntel',
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.5-flash-02-23',
        messages: [{ role: 'user', content: prompt.replace(/[^\x00-\x7F]/g, (c) => encodeURIComponent(c)) }],
        max_tokens: 4000,
        temperature: 0.2,
      }),
    })

    console.log('OpenRouter response status:', response.status)
    const data = await response.json()
    console.log('OpenRouter data:', JSON.stringify(data).slice(0, 300))
    const content = data.choices?.[0]?.message?.content ?? '{}'
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    try {
      return JSON.parse(cleaned)
    } catch {
      return { error: 'Не удалось распарсить ответ AI', raw: content }
    }
  } catch (fetchError) {
    console.error('OpenRouter fetch error:', fetchError)
    return { error: 'Ошибка соединения с OpenRouter: ' + String(fetchError) }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, version_id, file_url, file_name, analysis_type, user_name } = body

    if (!contract_id || !file_url || !analysis_type) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const { data: analysis, error: createError } = await supabase
      .from('ai_analysis')
      .insert({
        contract_id,
        version_id: version_id ?? null,
        type: analysis_type,
        status: 'processing',
        model_used: 'qwen/qwen3.5-flash-02-23',
      })
      .select('id')
      .single()

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    console.log('Starting analysis:', { file_name, analysis_type, file_url: file_url.slice(0, 50) })
    const fileName = file_name.toLowerCase()
    let textOrUrl: string

    if (fileName.endsWith('.pdf')) {
      console.log('PDF mode - extracting text with unpdf')
      textOrUrl = await extractTextFromPdf(file_url)
      console.log('PDF text length:', textOrUrl.length)
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      console.log('DOCX mode - extracting text with mammoth')
      textOrUrl = await extractTextFromDocx(file_url)
      console.log('DOCX text length:', textOrUrl.length)
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      console.log('XLSX mode - extracting text with xlsx')
      textOrUrl = await extractTextFromXlsx(file_url)
      console.log('XLSX text length:', textOrUrl.length)
    } else {
      return NextResponse.json({ error: 'Неподдерживаемый формат файла' }, { status: 400 })
    }

    if (!textOrUrl || textOrUrl.length < 50) {
      await supabase
        .from('ai_analysis')
        .update({ status: 'error', result_json: { error: 'Не удалось извлечь текст из документа' } })
        .eq('id', analysis.id)
      return NextResponse.json({ error: 'Не удалось извлечь текст из документа' }, { status: 400 })
    }

    const result = await analyzeWithAI(textOrUrl, analysis_type)

    await supabase
      .from('ai_analysis')
      .update({
        status: 'completed',
        result_json: result,
      })
      .eq('id', analysis.id)

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