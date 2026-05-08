import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { message, author_name, bitrix_user_id } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
    }

    const { error } = await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: message.trim(),
        author_name: author_name ?? 'Система',
        bitrix_user_id: bitrix_user_id ?? null,
        is_ai: false,
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await params
    const body = await request.json()
    const { message_id, message, bitrix_user_id } = body

    if (!message?.trim() || !message_id) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Проверяем что сообщение принадлежит пользователю
    const { data: existing } = await supabase
      .from('approval_messages')
      .select('bitrix_user_id')
      .eq('id', message_id)
      .single()

    if (!existing || existing.bitrix_user_id !== bitrix_user_id) {
      return NextResponse.json({ error: 'Нет прав на редактирование' }, { status: 403 })
    }

    const { error } = await supabase
      .from('approval_messages')
      .update({ message: message.trim() + ' (изм.)' })
      .eq('id', message_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}