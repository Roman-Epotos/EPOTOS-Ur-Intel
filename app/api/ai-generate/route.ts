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
    const systemPrompt = `You are a legal document drafting expert for EPOTOS Group of Companies (ГК ЭПОТОС). The group includes: ООО Техно, ООО НПП ЭПОТОС, ООО СПТ, ООО ОС, ООО Эпотос-К. Generate professional legal documents in Russian language. Always output complete, ready-to-use documents.`

    const userPrompt = `Создай ${document_type} документ на русском языке.

Компания ЭПОТОС: ${company_prefix ?? 'не указана'}
Контрагент: ${counterparty ?? 'не указан'}
Регион: ${region ?? 'РФ'}
Описание задачи: ${prompt}
${templateContext}

Создай полный профессиональный документ с:
- Заголовком и реквизитами сторон
- Основными разделами и пунктами
- Подписями сторон
- Датой и местом заключения

Выводи только текст документа без пояснений.`

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'Epotos-YurIntel',
      },
      body: new TextEncoder().encode(JSON.stringify({
        model: 'qwen/qwen3.5-flash-02-23',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 4000,
        temperature: 0.3,
      })),
    })

    const data = await response.json()
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

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="generated_${document_type}_${Date.now()}.docx"`,
        'X-Template-Used': templateUsed ? 'true' : 'false',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}