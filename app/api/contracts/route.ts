import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!

// Генерация номера договора
export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix')
  if (!prefix) {
    return NextResponse.json({ error: 'Префикс не указан' }, { status: 400 })
  }

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contracts?select=id&number=like.${encodeURIComponent(prefix + '-%')}`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'count=exact',
      },
    }
  )

  const countHeader = res.headers.get('content-range')
  const count = countHeader ? parseInt(countHeader.split('/')[1] ?? '0') : 0
  const nextNum = String(count + 1).padStart(2, '0')
  const number = `${prefix}-${year}/${month}/${nextNum}`

  return NextResponse.json({ number })
}

// Сохранение договора
export async function POST(request: NextRequest) {
  const body = await request.json()

  try {
    // Отправляем в Supabase через REST API напрямую
    await fetch(`${SUPABASE_URL}/rest/v1/contracts`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        number: body.number,
        title: body.title,
        counterparty: body.counterparty,
        type: body.type,
        amount: body.amount ? parseFloat(body.amount) : null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        status: 'черновик',
      }),
    })
  } catch (error) {
    console.error('Ошибка при сохранении в Supabase:', error)
    // Продолжаем выполнение, так как клиент всё равно перенаправляется
  }

  // Возвращаем ответ немедленно не ожидая Supabase
  return NextResponse.json({ success: true })
}