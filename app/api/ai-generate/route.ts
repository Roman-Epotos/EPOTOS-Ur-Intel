import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

async function getTemplateText(fileUrl: string, fileName: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const uint8 = new Uint8Array(arrayBuffer)
    const buffer = Buffer.from(uint8)

    if (fileName.toLowerCase().endsWith('.pdf')) {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(uint8, { mergePages: true })
      // Encode to ASCII-safe string
      return text.slice(0, 6000).replace(/[^\x00-\x7F]/g, (c) => encodeURIComponent(c))
    } else if (fileName.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value.slice(0, 6000).replace(/[^\x00-\x7F]/g, (c) => encodeURIComponent(c))
    }
    return ''
  } catch {
    return ''
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      prompt,
      document_type,
      company_prefix,
      region,
      counterparty,
      user_name,
      contract_id,
    } = body

    if (!prompt || !document_type) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    console.log('ai-generate started', { document_type, company_prefix, region })

    // Ищем подходящий шаблон
    let templateContext = ''
    let templateUsed = false

    const { data: templates } = await supabase
      .from('document_templates')
      .select('*')
      .eq('type', document_type)
      .eq('is_active', true)
      .or(`company_prefix.eq.${company_prefix},company_prefix.is.null`)
      .order('company_prefix', { ascending: false })
      .limit(1)

    if (templates && templates.length > 0) {
      const template = templates[0]
      const text = await getTemplateText(template.file_url, template.file_name)
      if (text) {
        templateContext = `\n\nИспользуй следующий шаблон как основу:\n${text}`
        templateUsed = true
      }
    }

    // Генерируем документ
    const companyNames: Record<string, string> = {
      'ТХ': 'ООО «Техно»',
      'НПП': 'ООО «НПП ЭПОТОС»',
      'СПТ': 'ООО «СПТ»',
      'ОС': 'ООО «ОС»',
      'Э-К': 'ООО «Эпотос-К»',
    }
    const companyName = companyNames[company_prefix ?? ''] ?? 'ГК ЭПОТОС'

    const systemPrompt = `Ты опытный корпоративный юрист компании ${companyName}, входящей в Группу компаний ЭПОТОС (производство и обслуживание противопожарного оборудования). Твоя задача — составлять полные, профессиональные юридические документы на русском языке в соответствии с законодательством РФ. Документы должны быть готовы к подписанию без дополнительного редактирования.`

    const templateInstruction = templateContext
      ? `ВАЖНО: Используй следующий шаблон как точную основу документа. Сохраняй структуру, нумерацию разделов и ключевые условия шаблона. Заполни реквизиты сторон и адаптируй под конкретные условия задачи:\n\n${templateContext}`
      : `Создай документ по стандартной структуре для данного типа документа по законодательству РФ.`

    const userPrompt = `Составь ${document_type} со следующими параметрами:

СТОРОНЫ:
- Сторона 1 (наша компания): ${companyName}
- Сторона 2 (контрагент): ${counterparty ?? 'указать наименование'}
- Регион применения: ${region ?? 'Российская Федерация'}

ЗАДАЧА:
${prompt}

${templateInstruction}

ТРЕБОВАНИЯ К ДОКУМЕНТУ:
1. Полные реквизиты обеих сторон (наименование, ИНН, адрес, банковские реквизиты — использовать шаблонные значения если не указаны)
2. Предмет договора с конкретным описанием
3. Права и обязанности сторон
4. Цена и порядок расчётов
5. Сроки исполнения
6. Ответственность сторон
7. Форс-мажор
8. Порядок разрешения споров
9. Заключительные положения
10. Подписи и реквизиты сторон

Выводи только текст документа. Не добавляй пояснений, комментариев или вступительных фраз.`

    console.log('calling OpenRouter...')
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'EpotosYurIntel',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        route: 'fallback',
        models: ['google/gemini-2.0-flash-001', 'anthropic/claude-haiku-4-5', 'qwen/qwen3-235b-a22b'],
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 6000,
        temperature: 0.2,
      }),
    })

    console.log('OpenRouter response status:', response.status)
    const data = await response.json()
    console.log('OpenRouter data:', JSON.stringify(data).slice(0, 300))
    const generatedText = data.choices?.[0]?.message?.content ?? ''

    if (!generatedText) {
      return NextResponse.json({ error: 'AI не вернул результат' }, { status: 400 })
    }

    // Создаём DOCX файл
    const { Document, Paragraph, TextRun, HeadingLevel, Packer } = await import('docx')

    const paragraphs = generatedText.split('\n').map((line: string) => {
      if (line.startsWith('# ')) {
        return new Paragraph({
          text: line.replace('# ', ''),
          heading: HeadingLevel.HEADING_1,
        })
      } else if (line.startsWith('## ')) {
        return new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_2,
        })
      } else if (line.trim() === '') {
        return new Paragraph({ text: '' })
      } else {
        return new Paragraph({
          children: [new TextRun({ text: line, size: 24, font: 'Times New Roman' })],
          spacing: { after: 120 },
        })
      }
    })

    const doc = new Document({
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    })

    const buffer = await Packer.toBuffer(doc)

    // Сохраняем в лог если есть contract_id
    if (contract_id) {
      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'AI генерация документа',
        details: `Тип: ${document_type}. Шаблон: ${templateUsed ? 'использован' : 'не найден'}`,
        user_name: user_name ?? 'Система',
      })
    }

    const uint8 = new Uint8Array(buffer)

    return new NextResponse(uint8, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="generated.docx"`,
        'X-Template-Used': templateUsed ? 'true' : 'false',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}