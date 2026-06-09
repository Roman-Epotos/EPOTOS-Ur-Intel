import { NextRequest, NextResponse } from 'next/server'

const BITRIX_PORTAL = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'

export async function POST(request: NextRequest) {
  try {
    const { auth_id, member_id, user_id } = await request.json()

    if (!auth_id || !member_id || !user_id) {
      return NextResponse.json({ valid: false, error: 'Не все параметры переданы' })
    }

    // Проверяем токен через Б24 REST API
    const res = await fetch(
      `https://${BITRIX_PORTAL}/rest/profile.json?auth=${auth_id}`,
      { method: 'GET' }
    )

    if (!res.ok) {
      return NextResponse.json({ valid: false, error: 'Б24 недоступен' })
    }

    const data = await res.json()

    // Проверяем что ID пользователя совпадает
    if (data.result && String(data.result.ID) === String(user_id)) {
      return NextResponse.json({ valid: true })
    }

    return NextResponse.json({ valid: false, error: 'Токен недействителен или ID не совпадает' })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ valid: false, error: message })
  }
}