import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, version_id, file_url, file_name, question, user_name, bitrix_user_id } = body

    if (!contract_id || !question) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Сохраняем вопрос пользователя
    await supabase.from('ai_chats').insert({
      contract_id,
      version_id: version_id ?? null,
      role: 'user',
      message: question,
      user_name: user_name ?? 'Пользователь',
      bitrix_user_id: bitrix_user_id ?? null,
    })

    // Получаем историю чата
    const { data: history } = await supabase
      .from('ai_chats')
      .select('role, message')
      .eq('contract_id', contract_id)
      .order('created_at', { ascending: true })
      .limit(20)

    // Извлекаем текст документа если есть файл
    let documentContext = ''
    if (file_url && file_name) {
      try {
        const fileName = file_name.toLowerCase()
        if (fileName.endsWith('.pdf')) {
          const { extractText } = await import('unpdf')
          const response = await fetch(file_url)
          const arrayBuffer = await response.arrayBuffer()
          const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
          documentContext = text.slice(0, 6000)
        } else if (fileName.endsWith('.docx')) {
          const response = await fetch(file_url)
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(new Uint8Array(arrayBuffer))
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer })
          documentContext = result.value.slice(0, 6000)
        } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const XLSX = require('xlsx')
          const response = await fetch(file_url)
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(new Uint8Array(arrayBuffer))
          const workbook = XLSX.read(buffer, { type: 'buffer' })
          const texts: string[] = []
          workbook.SheetNames.forEach((sheetName: string) => {
            const sheet = workbook.Sheets[sheetName]
            texts.push(XLSX.utils.sheet_to_csv(sheet))
          })
          documentContext = texts.join('\n').slice(0, 6000)
        }
      } catch (err) {
        console.error('Document extraction error:', err)
      }
    }

    // Формируем сообщения для AI
    const systemPrompt = `You are EpotosGPT, a legal assistant for EPOTOS Group of Companies (ГК ЭПОТОС). The group includes: ООО Техно, ООО НПП ЭПОТОС, ООО СПТ, ООО ОС, ООО Эпотос-К. Answer questions about the document in Russian language. Be concise and helpful.${documentContext ? `\n\nDocument content:\n${documentContext}` : ''}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history ?? []).slice(0, -1).map((h: { role: string; message: string }) => ({
        role: h.role,
        content: h.message,
      })),
      { role: 'user', content: question },
    ]

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
        messages,
        max_tokens: 1000,
        temperature: 0.3,
      }),
    })

    const data = await response.json()
    const answer = data.choices?.[0]?.message?.content ?? 'Не удалось получить ответ'

    // Сохраняем ответ AI
    await supabase.from('ai_chats').insert({
      contract_id,
      version_id: version_id ?? null,
      role: 'assistant',
      message: answer,
      user_name: 'EpotosGPT',
    })

    return NextResponse.json({ success: true, answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id')

  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('ai_chats')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ messages: data ?? [] })
}