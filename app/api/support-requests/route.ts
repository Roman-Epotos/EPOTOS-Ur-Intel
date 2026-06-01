import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]
const ADMIN_NAMES: Record<number, string> = {
  30: 'Пирог Роман',
  1148: 'Чащин Дмитрий',
}

// GET — список обращений + сообщения
export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  const myRequests = request.nextUrl.searchParams.get('my_requests')
  const requestId = request.nextUrl.searchParams.get('request_id')

  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  try {
    // Получить сообщения конкретного обращения
    if (requestId) {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ messages: data ?? [] })
    }

    let query = supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (myRequests === 'true') {
      query = query.eq('user_bitrix_id', userId)
    } else if (ADMIN_IDS.includes(userId)) {
      query = query.eq('admin_bitrix_id', userId)
    } else {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ requests: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST — создать обращение или отправить сообщение
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Отправка сообщения в существующий чат
    if (body.request_id) {
      const { request_id, author_bitrix_id, author_name, message, is_admin } = body
      const { error } = await supabase
        .from('support_messages')
        .insert({ request_id, author_bitrix_id, author_name, message, is_admin: is_admin ?? false })
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Обновляем updated_at обращения
      await supabase.from('support_requests').update({ status: body.status ?? 'in_progress' }).eq('id', request_id)

      // Уведомление
      const { data: req } = await supabase.from('support_requests').select('user_bitrix_id, admin_bitrix_id, subject').eq('id', request_id).single()
      if (req) {
        const notifyId = is_admin ? req.user_bitrix_id : req.admin_bitrix_id
        await fetch('https://epotos-ur-intel.vercel.app/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bitrix_user_ids: [notifyId],
            message: `💬 Новое сообщение по обращению «${req.subject}» от ${author_name}:\n\n${message}`,
          }),
        }).catch(() => {})
      }

      return NextResponse.json({ success: true })
    }

    // Создание нового обращения
    const { user_bitrix_id, user_name, admin_bitrix_id, subject, message } = body
    if (!user_bitrix_id || !user_name || !admin_bitrix_id || !subject || !message) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }

    const adminName = ADMIN_NAMES[parseInt(admin_bitrix_id)] ?? 'Администратор'

    const { data: newRequest, error } = await supabase
      .from('support_requests')
      .insert({
        user_bitrix_id: parseInt(user_bitrix_id),
        user_name,
        admin_bitrix_id: parseInt(admin_bitrix_id),
        admin_name: adminName,
        subject,
        message,
        status: 'new',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Сохраняем первое сообщение в чат
    await supabase.from('support_messages').insert({
      request_id: newRequest.id,
      author_bitrix_id: parseInt(user_bitrix_id),
      author_name: user_name,
      message,
      is_admin: false,
    })

    // Уведомление администратору
    await fetch('https://epotos-ur-intel.vercel.app/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bitrix_user_ids: [parseInt(admin_bitrix_id)],
        message: `📩 Новое обращение от ${user_name}\nТема: ${subject}\n\n${message}`,
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true, request_id: newRequest.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — изменить статус обращения (только администратор)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, admin_bitrix_id, status } = body

    if (!ADMIN_IDS.includes(parseInt(admin_bitrix_id))) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const { error } = await supabase
      .from('support_requests')
      .update({ status, replied_at: new Date().toISOString(), replied_by: ADMIN_NAMES[parseInt(admin_bitrix_id)] })
      .eq('id', request_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Уведомление пользователю при закрытии
    if (status === 'resolved') {
      const { data: req } = await supabase.from('support_requests').select('user_bitrix_id, subject').eq('id', request_id).single()
      if (req) {
        await fetch('https://epotos-ur-intel.vercel.app/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bitrix_user_ids: [req.user_bitrix_id],
            message: `✅ Ваше обращение «${req.subject}» отмечено как решённое.`,
          }),
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — удалить обращение безвозвратно (только администратор)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, admin_bitrix_id } = body

    if (!ADMIN_IDS.includes(parseInt(admin_bitrix_id))) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const { error } = await supabase.from('support_requests').delete().eq('id', request_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}