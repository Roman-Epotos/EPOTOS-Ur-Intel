import { NextRequest, NextResponse } from 'next/server'

const APP_URL = 'https://epotos-ur-intel.vercel.app'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()

    const authId = body.get('AUTH_ID') as string
    const refreshId = body.get('REFRESH_ID') as string
    const memberId = body.get('member_id') as string
    const serverEndpoint = body.get('SERVER_ENDPOINT') as string

    if (!authId || !memberId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Извлекаем домен из SERVER_ENDPOINT
    // https://oauth.bitrix24.tech/rest/ -> gkepotos.bitrix24.ru
    const domain = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'

    const params = new URLSearchParams({
      auth_id: authId,
      refresh_id: refreshId ?? '',
      member_id: memberId,
      domain,
      server_endpoint: serverEndpoint ?? '',
    })

    return NextResponse.redirect(
      `${APP_URL}/?${params.toString()}`,
      { status: 302 }
    )
  } catch {
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const authId = searchParams.get('auth_id') ?? ''
  const memberId = searchParams.get('member_id') ?? ''

  if (authId && memberId) {
    return NextResponse.redirect(
      `${APP_URL}/?${searchParams.toString()}`,
      { status: 302 }
    )
  }

  return NextResponse.redirect(`${APP_URL}/`, { status: 302 })
}