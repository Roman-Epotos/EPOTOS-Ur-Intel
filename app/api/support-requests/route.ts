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

// GET — список обращений (для администратора)
export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  const myRequests = request.nextUrl.searchParams.get('my_requests')

  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  try {
    let query = supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (myRequests === 'true') {
      // Пользователь видит свои обращения
      query = query.eq('user_bitrix_id', userId)
    } else if (ADMIN_IDS.includes(userId)) {
      // Администратор видит обращения адресованные ему
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

// POST — создать обращение
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { user_bitrix_id, user_name, admin_bitrix_id, subject, message } = body

    if (!user_bitrix_id || !user_name || !admin_bitrix_id || !subject || !message) {
      return NextResponse.json({ error: 'Все поля обязательны' }, { status: 400 })
    }

    const adminName = ADMIN_NAMES[parseInt(admin_bitrix_id)] ?? 'Администратор'

    const { error } = await supabase
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

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Уведомление администратору в Битрикс24
    const notifyUrl = 'https://epotos-ur-intel.vercel.app/api/notify'
    await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bitrix_user_ids: [parseInt(admin_bitrix_id)],
        message: `📩 Новое обращение от ${user_name}\nТема: ${subject}\n\n${message}`,
      }),
    }).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PATCH — ответить на обращение (только администратор)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { request_id, admin_bitrix_id, admin_reply, status } = body

    if (!ADMIN_IDS.includes(parseInt(admin_bitrix_id))) {
      return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
    }

    const adminName = ADMIN_NAMES[parseInt(admin_bitrix_id)] ?? 'Администратор'

    const { data: req } = await supabase
      .from('support_requests')
      .select('user_bitrix_id, user_name, subject')
      .eq('id', request_id)
      .single()

    const { error } = await supabase
      .from('support_requests')
      .update({
        admin_reply,
        status: status ?? 'resolved',
        replied_at: new Date().toISOString(),
        replied_by: adminName,
      })
      .eq('id', request_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Уведомление пользователю
    if (req) {
      await fetch('https://epotos-ur-intel.vercel.app/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bitrix_user_ids: [req.user_bitrix_id],
          message: `✅ Ответ на ваше обращение «${req.subject}» от ${adminName}:\n\n${admin_reply}`,
        }),
      }).catch(() => {})
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}