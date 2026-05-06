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
      return text.slice(0, 12000)
    } else if (fileName.toLowerCase().endsWith('.docx')) {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value.slice(0, 12000)
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
        templateContext = text
        templateUsed = true
      }
    }

    // Генерируем документ
    const companyDetails: Record<string, string> = {
      'ТХ': 'ООО «Техно», ИНН: [ИНН ТХ], КПП: [КПП ТХ], Адрес: [адрес ТХ], р/с: [р/с ТХ] в Банк ВТБ (ПАО), БИК: [БИК], к/с: [к/с]',
      'НПП': 'ООО «НПП ЭПОТОС», ИНН: [ИНН НПП], КПП: [КПП НПП], Адрес: [адрес НПП], р/с: [р/с НПП] в Банк ВТБ (ПАО), БИК: [БИК], к/с: [к/с]',
      'СПТ': 'ООО «СПТ», ИНН: [ИНН СПТ], КПП: [КПП СПТ], Адрес: [адрес СПТ], р/с: [р/с СПТ] в Банк ВТБ (ПАО), БИК: [БИК], к/с: [к/с]',
      'ОС': 'ООО «ОС», ИНН: [ИНН ОС], КПП: [КПП ОС], Адрес: [адрес ОС], р/с: [р/с ОС] в Банк ВТБ (ПАО), БИК: [БИК], к/с: [к/с]',
      'Э-К': 'ООО «Эпотос-К», ИНН: [ИНН ЭК], КПП: [КПП ЭК], Адрес: [адрес ЭК], р/с: [р/с ЭК] в Банк ВТБ (ПАО), БИК: [БИК], к/с: [к/с]',
    }
    const companyNames: Record<string, string> = {
      'ТХ': 'ООО «Техно»',
      'НПП': 'ООО «НПП ЭПОТОС»',
      'СПТ': 'ООО «СПТ»',
      'ОС': 'ООО «ОС»',
      'Э-К': 'ООО «Эпотос-К»',
    }
    const companyName = companyNames[company_prefix ?? ''] ?? 'ГК ЭПОТОС'
    const companyRequisites = companyDetails[company_prefix ?? ''] ?? 'ГК ЭПОТОС, реквизиты уточнить'

    const systemPrompt = `Ты опытный корпоративный юрист компании ${companyName}, входящей в Группу компаний ЭПОТОС (производство и обслуживание противопожарного оборудования). Твоя задача — составлять полные, профессиональные юридические документы на русском языке в соответствии с законодательством РФ. Документы должны быть готовы к подписанию без дополнительного редактирования.`

    const templateInstruction = templateContext
      ? `КРИТИЧЕСКИ ВАЖНО: Ниже приведён корпоративный шаблон документа. Ты ОБЯЗАН:
1. Сохранить ВСЕ разделы и пункты шаблона без исключения
2. Сохранить нумерацию и структуру разделов точно как в шаблоне
3. Сохранить ВСЕ условия, формулировки и специальные оговорки из шаблона
4. Только заменить: наименования сторон, реквизиты, предмет договора и конкретные параметры сделки
5. НЕ упрощать, НЕ сокращать, НЕ удалять разделы шаблона

ШАБЛОН ДОКУМЕНТА:
---
${templateContext}
---
Конец шаблона. Создай документ строго по этой структуре с учётом параметров задачи.`
      : `Создай полный профессиональный документ по стандартной структуре для данного типа по законодательству РФ. Включи все стандартные разделы без сокращений.`

    const userPrompt = `Составь ${document_type} со следующими параметрами:

СТОРОНЫ:
- Сторона 1 (наша компания): ${companyRequisites}
- Сторона 2 (контрагент): ${counterparty ?? 'указать наименование'} (реквизиты указать в квадратных скобках)
- Регион применения: ${region ?? 'Российская Федерация'}

ЗАДАЧА:
${prompt}

${templateInstruction}

ТРЕБОВАНИЯ К ДОКУМЕНТУ:
1. Используй реквизиты компании ЭПОТОС ТОЧНО как указано выше — не заменяй банк и не выдумывай реквизиты
2. Сохраняй сквозную нумерацию пунктов без пропусков (1.1, 1.2, 1.3... 2.1, 2.2...)
3. Включи ВСЕ разделы — не обрывай документ, доведи до подписей
4. Реквизиты контрагента указывай в квадратных скобках [заполнить]
5. Документ должен быть полным и готовым к подписанию

Выводи только текст документа без пояснений и комментариев.`

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
        max_tokens: 8000,
        temperature: 0.1,
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