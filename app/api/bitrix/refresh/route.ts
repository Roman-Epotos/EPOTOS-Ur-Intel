import { NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/app/lib/fetchWithTimeout'

export async function POST(request: NextRequest) {
  try {
    const { refresh_id } = await request.json()

    if (!refresh_id) {
      return NextResponse.json({ error: 'refresh_id обязателен' }, { status: 400 })
    }

    const clientId = process.env.BITRIX_CLIENT_ID
    const clientSecret = process.env.BITRIX_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'BITRIX_CLIENT_ID/SECRET не заданы на сервере' }, { status: 500 })
    }

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh_id,
    })

    const res = await fetchWithTimeout(`https://oauth.bitrix24.tech/oauth/token/?${params.toString()}`, {
      label: 'bitrix-refresh',
      timeoutMs: 10000,
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      return NextResponse.json(
        { error: data.error_description ?? data.error ?? 'Не удалось обновить токен' },
        { status: 400 }
      )
    }

    // Bitrix24 при рефреше выдаёт НОВУЮ пару auth_id/refresh_id (старая инвалидируется)
    return NextResponse.json({
      success: true,
      auth_id: data.access_token,
      refresh_id: data.refresh_token,
      member_id: data.member_id,
      domain: data.domain,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}