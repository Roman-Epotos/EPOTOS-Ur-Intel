import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!

// Извлекаем текст из файла по URL
async function extractTextFromUrl(fileUrl: string, fileName: string): Promise<string> {
  const response = await fetch(fileUrl)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (fileName.endsWith('.pdf')) {
    // Для PDF — отправляем как base64 в AI для извлечения текста
    const base64 = Buffer.from(bytes).toString('base64')
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
            role: 'user',
            content: [
              {
                type: 'file',
                file: { filename: fileName, file_data: `data:application/pdf;base64,${base64}` }
              },
              { type: 'text', text: 'Извлеки весь текст из этого PDF документа. Сохрани структуру: номера пунктов, разделы, реквизиты. Возвращай только текст без комментариев.' }
            ]
          }
        ],
        max_tokens: 8000,
      })
    })
    const aiData = await aiRes.json()
    return aiData.choices?.[0]?.message?.content ?? ''
  }

  if (fileName.endsWith('.docx')) {
    // Для DOCX — извлекаем XML и убираем теги
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

    // compare_file_type: 'version' | 'attachment'
    // compare_file_id: id версии или вложения

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

    // Извлекаем текст из обоих документов
    const [signedText, compareText] = await Promise.all([
      extractTextFromUrl(signed_file_url, signed_file_name),
      extractTextFromUrl(compareFileUrl, compareFileName),
    ])

    if (!signedText || !compareText) {
      return NextResponse.json({ error: 'Не удалось извлечь текст из документов' }, { status: 400 })
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
            content: `Ты юридический эксперт. Сравни два документа: согласованный и подписанный. 
Найди все расхождения в тексте — изменённые условия, добавленные или удалённые пункты, изменения в реквизитах.
Верни ТОЛЬКО JSON без markdown в формате:
{
  "match": true/false,
  "summary": "Краткий вывод (1-2 предложения)",
  "discrepancies": [
    {
      "section": "Название раздела или номер пункта",
      "type": "изменение/добавление/удаление",
      "agreed_text": "Текст в согласованном документе",
      "signed_text": "Текст в подписанном документе",
      "severity": "высокая/средняя/низкая"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `СОГЛАСОВАННЫЙ ДОКУМЕНТ:\n${compareText}\n\n---\n\nПОДПИСАННЫЙ ДОКУМЕНТ:\n${signedText}`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      })
    })

    const aiData = await aiRes.json()
    const rawContent = aiData.choices?.[0]?.message?.content ?? ''

    let result
    try {
      const clean = rawContent.replace(/```json|```/g, '').trim()
      result = JSON.parse(clean)
    } catch {
      result = { match: false, summary: 'Не удалось разобрать ответ AI', discrepancies: [] }
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}