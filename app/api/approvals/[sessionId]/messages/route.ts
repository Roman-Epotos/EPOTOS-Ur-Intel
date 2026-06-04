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
    const { message, author_name, bitrix_user_id, file_url, file_name, file_type } = body

    if (!message?.trim() && !file_url) {
      return NextResponse.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
    }

    const { reply_to_id, reply_to_author, reply_to_text } = body

    const { error } = await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: message?.trim() ?? '',
        author_name: author_name ?? 'Система',
        bitrix_user_id: bitrix_user_id ?? null,
        is_ai: false,
        file_url: file_url ?? null,
        file_name: file_name ?? null,
        file_type: file_type ?? null,
        reply_to_id: reply_to_id ?? null,
        reply_to_author: reply_to_author ?? null,
        reply_to_text: reply_to_text ?? null,
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
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    await params
    const body = await request.json()
    const { message_id, bitrix_user_id } = body

    if (!message_id || !bitrix_user_id) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Проверяем что сообщение принадлежит пользователю
    const { data: existing } = await supabase
      .from('approval_messages')
      .select('bitrix_user_id, created_at, session_id')
      .eq('id', message_id)
      .single()

    if (!existing || existing.bitrix_user_id !== bitrix_user_id) {
      return NextResponse.json({ error: 'Нет прав на удаление' }, { status: 403 })
    }

    // Проверяем 5-минутное окно
    const diffMin = (Date.now() - new Date(existing.created_at).getTime()) / 60000
    if (diffMin > 5) {
      return NextResponse.json({ error: 'Время на удаление истекло (5 минут)' }, { status: 403 })
    }

    // Проверяем что после этого сообщения нет сообщений от других
    const { data: after } = await supabase
      .from('approval_messages')
      .select('id')
      .eq('session_id', existing.session_id)
      .neq('bitrix_user_id', bitrix_user_id)
      .gt('created_at', existing.created_at)
      .limit(1)

    if (after && after.length > 0) {
      return NextResponse.json({ error: 'Нельзя удалить — другие уже ответили' }, { status: 403 })
    }

    const { error } = await supabase
      .from('approval_messages')
      .delete()
      .eq('id', message_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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