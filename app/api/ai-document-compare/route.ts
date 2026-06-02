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
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse')
      const data = await pdfParse(Buffer.from(bytes))
      return data.text ?? ''
    } catch {
      // Фоллбэк — извлекаем текст через regex из raw PDF
      const raw = Buffer.from(bytes).toString('latin1')
      const textMatches = raw.match(/BT[\s\S]*?ET/g) ?? []
      const text = textMatches
        .join(' ')
        .replace(/\(([^)]+)\)\s*Tj/g, '$1 ')
        .replace(/[^\x20-\x7E\u0400-\u04FF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return text || raw.replace(/[^\x20-\x7E\u0400-\u04FF\n]/g, ' ').replace(/\s+/g, ' ').trim()
    }
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

    // AI сравнение
    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'Epotos-YurIntel',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Ты юридический эксперт. Сравни два документа: согласованный (DOCX) и подписанный (PDF).

ВАЖНЫЕ ПРАВИЛА:
1. ИГНОРИРУЙ полностью: подписи, печати, штампы ЭДО, QR-коды, отметки об электронном подписании, колонтитулы с датами подписания, технические метаданные PDF, строки вида "_________________ Поставщик __________________"
2. Сравнивай ТОЛЬКО смысловое содержание: условия договора, права и обязанности сторон, суммы, сроки, реквизиты
3. Незначительные различия в форматировании, переносах строк, пробелах — НЕ расхождения
4. Если документы идентичны по содержанию — match: true, discrepancies: []
5. Если найдены реальные расхождения — ОБЯЗАТЕЛЬНО заполняй поля agreed_text и signed_text конкретным текстом из документов

Верни ТОЛЬКО валидный JSON без markdown, без \`\`\`json:
{"match":true/false,"summary":"Краткий вывод","discrepancies":[{"section":"номер пункта","type":"изменение/добавление/удаление","agreed_text":"текст из согласованного","signed_text":"текст из подписанного","severity":"высокая/средняя/низкая"}]}`
          },
          {
            role: 'user',
            content: `СОГЛАСОВАННЫЙ ДОКУМЕНТ (DOCX):\n${compareText.slice(0, 12000)}\n\n---\n\nПОДПИСАННЫЙ ДОКУМЕНТ (PDF):\n${signedText.slice(0, 12000)}`
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

    let result
    try {
      // Убираем markdown если есть
      const clean = rawContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()
      // Находим JSON объект
      const jsonMatch = clean.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(clean)
    } catch {
      // Если парсинг не удался — возвращаем как есть с флагом ошибки
      return NextResponse.json({
        success: true,
        result: {
          match: false,
          summary: 'Не удалось разобрать ответ AI. Рекомендуем проверить документы вручную.',
          discrepancies: [],
          raw: rawContent.slice(0, 500)
        }
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}