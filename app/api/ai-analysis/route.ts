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
    const response = await fetch(fileUrl, {
      headers: { 'Accept': 'application/octet-stream' }
    })
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    console.log('DOCX buffer size:', buffer.length, 'first bytes:', buffer.slice(0, 4).toString('hex'))
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch (err) {
    console.error('DOCX extraction error:', err)
    // Попробуем как xlsx если docx не работает
    try {
      const response2 = await fetch(fileUrl)
      const arrayBuffer2 = await response2.arrayBuffer()
      const buffer2 = Buffer.from(new Uint8Array(arrayBuffer2))
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const XLSX = require('xlsx')
      const workbook = XLSX.read(buffer2, { type: 'buffer' })
      const texts: string[] = []
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) texts.push(csv)
      })
      return texts.join('\n')
    } catch {
      return ''
    }
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
    legal_review: `You are a legal expert for EPOTOS Group of Companies (ГК ЭПОТОС). The group includes: ООО Техно, ООО НПП ЭПОТОС, ООО СПТ, ООО ОС, ООО Эпотос-К. Any of these companies may appear as a party to the document - do NOT treat their absence as a risk. Analyze the following document and provide a structured analysis in JSON format. All text values in JSON must be in Russian language. If the document is not a contract (e.g. a letter, act, invoice), adapt your analysis accordingly.

Document text:
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

    passport: `You are a legal expert for EPOTOS Group of Companies (ГК ЭПОТОС). The group includes: ООО Техно, ООО НПП ЭПОТОС, ООО СПТ, ООО ОС, ООО Эпотос-К. Create a passport summary for the following contract in JSON format. All text values in JSON must be in Russian language.

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
}`,

    document_review: `You are a document analyst for EPOTOS Group of Companies (ГК ЭПОТОС). Analyze the following document and provide a structured summary in JSON format. All text values must be in Russian language.

Document text:
${text.slice(0, 8000)}

Return ONLY valid JSON without markdown:
{
  "summary": "brief document summary in 2-3 sentences in Russian",
  "purpose": "document purpose and what action is required in Russian",
  "attention_points": ["important point 1 in Russian", "important point 2 in Russian"],
  "recommendations": ["recommendation 1 in Russian", "recommendation 2 in Russian"],
  "document_type": "detected document type in Russian",
  "urgency": "high|medium|low"
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
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
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
    const { contract_id, version_id, attachment_id, file_url, file_name, analysis_type, user_name } = body

    if (!contract_id || !file_url || !analysis_type) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const { data: analysis, error: createError } = await supabase
      .from('ai_analysis')
      .insert({
        contract_id,
        version_id: version_id ?? null,
        attachment_id: attachment_id ?? null,
        type: analysis_type,
        status: 'processing',
        model_used: 'google/gemini-2.5-flash',
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
      console.log('PDF mode - sending as base64 to Claude')
      const pdfResponse = await fetch(file_url)
      const pdfBuffer = await pdfResponse.arrayBuffer()
      textOrUrl = `__PDF_BASE64__${Buffer.from(pdfBuffer).toString('base64')}`
    } else if (fileName.endsWith('.doc')) {
      return NextResponse.json({
        error: 'Формат .doc не поддерживается. Пожалуйста, конвертируйте файл в .docx или .pdf и загрузите снова.'
      }, { status: 400 })
    } else if (fileName.endsWith('.docx')) {
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

    if (!textOrUrl || (textOrUrl.length < 50 && !textOrUrl.startsWith('__PDF_BASE64__'))) {
      await supabase
        .from('ai_analysis')
        .update({ status: 'error', result_json: { error: 'Не удалось извлечь текст из документа' } })
        .eq('id', analysis.id)
      return NextResponse.json({ error: 'Не удалось извлечь текст из документа' }, { status: 400 })
    }

    let result: object
    if (textOrUrl.startsWith('__PDF_BASE64__')) {
      // PDF — отправляем напрямую в Claude как document
      const pdfBase64 = textOrUrl.replace('__PDF_BASE64__', '')
      console.log('PDF base64 size:', pdfBase64.length, 'analysis_type:', analysis_type)
      const systemPrompts: Record<string, string> = {
        legal_review: 'Ты юридический эксперт ГК ЭПОТОС. Проведи юридический анализ документа. ООО Техно, НПП ЭПОТОС, СПТ, ОС, Эпотос-К — компании группы, их присутствие не является риском. Верни ТОЛЬКО валидный JSON без markdown: {"red_flags":[{"severity":"high|medium|low","title":"название","description":"описание","recommendation":"рекомендация"}],"warnings":[{"title":"название","description":"описание"}],"positives":[{"title":"название","description":"описание"}],"overall_risk":"high|medium|low","summary":"краткий вывод"}',
        passport: 'Ты юридический эксперт ГК ЭПОТОС. Составь паспорт документа. Верни ТОЛЬКО валидный JSON без markdown: {"essence":"суть документа","parties":{"our_obligations":["обязательство"],"counterparty_obligations":["обязательство"]},"key_terms":{"amount":"сумма","payment_terms":"условия оплаты","start_date":"дата начала","end_date":"дата окончания","auto_renewal":"пролонгация"},"termination":"условия расторжения","control_points":["точка контроля"],"attention_zones":["зона внимания"]}',
        document_review: 'Ты аналитик документов ГК ЭПОТОС. Проанализируй документ. Верни ТОЛЬКО валидный JSON без markdown: {"summary":"краткое резюме","purpose":"цель документа","attention_points":["важный момент"],"recommendations":["рекомендация"],"document_type":"тип документа","urgency":"high|medium|low"}'
      }
      const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY!}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
          'X-Title': 'Epotos-YurIntel',
          'X-Anthropic-Beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [
            {
              role: 'system',
              content: 'Ты юридический эксперт ГК ЭПОТОС. Анализируй документы на русском языке. Возвращай ТОЛЬКО валидный JSON без markdown блоков.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: systemPrompts[analysis_type] ?? systemPrompts.document_review
                },
                {
                  type: 'document',
                  source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.2,
        })
      })
      const aiData = await aiRes.json()
      console.log('Claude PDF response status:', aiRes.status)
      const rawContent = aiData.choices?.[0]?.message?.content ?? ''
      console.log('Claude PDF rawContent:', typeof rawContent, String(rawContent).slice(0, 500))
      try {
        const clean = rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .replace(/'''\s*json\s*/gi, '')
          .replace(/'''\s*/g, '')
          .trim()
        const jsonMatch = clean.match(/\{[\s\S]*\}/)
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(clean)
      } catch {
        result = { error: 'Не удалось разобрать ответ AI', raw: rawContent.slice(0, 300) }
      }
    } else {
      result = await analyzeWithAI(textOrUrl, analysis_type)
    }

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
        action: analysis_type === 'legal_review' ? 'AI Legal Review выполнен' : analysis_type === 'document_review' ? 'AI Анализ документа выполнен' : 'AI Паспорт документа создан',
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