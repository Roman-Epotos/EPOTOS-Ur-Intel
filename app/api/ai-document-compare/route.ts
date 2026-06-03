import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

// Извлекаем текст из файла по URL
async function extractText(fileUrl: string, fileName: string): Promise<string> {
  const response = await fetch(fileUrl)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (fileName.toLowerCase().endsWith('.pdf')) {
    // Возвращаем base64 для прямой передачи в Gemini
    return `__PDF_BASE64__${Buffer.from(bytes).toString('base64')}`
  }

  if (fileName.toLowerCase().endsWith('.docx')) {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(bytes)
    const xml = await zip.file('word/document.xml')?.async('text') ?? ''
    return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  return ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, signed_file_url, signed_file_name, compare_file_id, compare_file_type } = body

    // Получаем URL файла для сравнения
    let compareFileUrl = ''
    let compareFileName = ''

    if (compare_file_type === 'version') {
      const { data } = await supabase.from('versions').select('file_url, file_name').eq('id', compare_file_id).single()
      compareFileUrl = data?.file_url ?? ''
      compareFileName = data?.file_name ?? ''
    } else if (compare_file_type === 'attachment') {
      const { data } = await supabase.from('document_attachments').select('file_url, file_name').eq('id', compare_file_id).single()
      compareFileUrl = data?.file_url ?? ''
      compareFileName = data?.file_name ?? ''
    }

    if (!compareFileUrl) {
      return NextResponse.json({ error: 'Файл для сравнения не найден' }, { status: 404 })
    }

    // Извлекаем текст из обоих документов параллельно
    const [signedText, compareText] = await Promise.all([
      extractText(signed_file_url, signed_file_name),
      extractText(compareFileUrl, compareFileName),
    ])

    if (!signedText || !compareText) {
      return NextResponse.json({
        error: `Не удалось извлечь текст. Подписанный: ${signedText.length} симв., Согласованный: ${compareText.length} симв.`
      }, { status: 400 })
    }

    // Формируем контент для AI
    const isPdfBase64 = signedText.startsWith('__PDF_BASE64__')
    const pdfBase64 = isPdfBase64 ? signedText.replace('__PDF_BASE64__', '') : null

    const userContent = isPdfBase64
      ? [
          {
            type: 'text',
            text: `Сравни два документа по содержанию. СОГЛАСОВАННЫЙ ДОКУМЕНТ (текст из DOCX):\n\n${compareText.slice(0, 15000)}\n\nПОДПИСАННЫЙ ДОКУМЕНТ — смотри прикреплённый PDF файл. Верни ТОЛЬКО JSON без markdown блоков.`
          },
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64
            }
          }
        ]
      : `СОГЛАСОВАННЫЙ ДОКУМЕНТ (DOCX):\n${compareText.slice(0, 12000)}\n\n---\n\nПОДПИСАННЫЙ ДОКУМЕНТ:\n${signedText.slice(0, 12000)}`

    // AI сравнение — используем Claude через OpenRouter (лучше следует JSON формату)
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'Epotos-YurIntel',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-5',
        messages: [
          {
            role: 'system',
            content: `Ты юридический эксперт-юрист с опытом проверки договоров.

Твоя задача: определить есть ли ЮРИДИЧЕСКИ ЗНАЧИМЫЕ расхождения между согласованным договором (DOCX) и подписанным договором (PDF).

ЮРИДИЧЕСКИ ЗНАЧИМОЕ РАСХОЖДЕНИЕ — это когда изменяется смысл условия:
- изменена сумма, процент, срок, количество дней
- изменено право или обязанность стороны (было "обязан" стало "вправе")
- добавлен или удалён целый пункт с условием
- изменено наименование стороны или предмет договора

НЕ ЯВЛЯЕТСЯ РАСХОЖДЕНИЕМ:
- разные пробелы, переносы строк, форматирование
- пустые строки для подписей "___________"
- незаполненные поля реквизитов (факс, банк контрагента)
- колонтитулы, нумерация страниц
- текст из соседнего пункта попавший из-за разрыва страницы PDF
- одно и то же предложение написанное чуть иначе но с тем же смыслом
- разница в одном-двух словах не меняющая смысл

Если все условия договора совпадают по смыслу — это ИДЕНТИЧНЫЕ документы, даже если есть технические отличия форматирования.

Верни ТОЛЬКО валидный JSON без markdown:
{"match":true/false,"summary":"Краткий вывод","discrepancies":[{"section":"номер пункта","type":"изменение/добавление/удаление","agreed_text":"точный текст из согласованного","signed_text":"точный текст из подписанного","severity":"высокая/средняя/низкая"}]}`
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      })
    })

    const aiData = await aiRes.json()
    const rawContent = aiData.choices?.[0]?.message?.content ?? ''

    if (!rawContent) {
      return NextResponse.json({ error: 'AI не вернул ответ' }, { status: 500 })
    }

    // убрано логирование

    let result
    try {
      // Агрессивная очистка от markdown
      let clean = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*json\s*/i, '')
        .trim()

      // Находим первый JSON объект в тексте
      const startIdx = clean.indexOf('{')
      const endIdx = clean.lastIndexOf('}')
      if (startIdx !== -1 && endIdx !== -1) {
        clean = clean.slice(startIdx, endIdx + 1)
      }

      result = JSON.parse(clean)

      // Проверяем структуру
      if (typeof result.match !== 'boolean') {
        result.match = false
      }
      if (!Array.isArray(result.discrepancies)) {
        result.discrepancies = []
      }
    } catch {
      // Если парсинг не удался — пробуем извлечь match из текста
      const isMatch = rawContent.toLowerCase().includes('"match": true') ||
                      rawContent.toLowerCase().includes('"match":true')
      return NextResponse.json({
        success: true,
        result: {
          match: isMatch,
          summary: isMatch
            ? 'Документы соответствуют друг другу'
            : 'Не удалось разобрать ответ AI. Рекомендуем проверить документы вручную.',
          discrepancies: [],
        }
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}