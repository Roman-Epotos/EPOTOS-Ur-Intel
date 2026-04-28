import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const domain = body.get('DOMAIN') as string
    const memberId = body.get('member_id') as string
    const authId = body.get('AUTH_ID') as string
    const refreshId = body.get('REFRESH_ID') as string
    const authExpires = body.get('AUTH_EXPIRES') as string

    if (!domain || !memberId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const params = new URLSearchParams({
      domain,
      member_id: memberId,
      auth_id: authId,
      refresh_id: refreshId,
      auth_expires: authExpires,
    })

    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    return NextResponse.redirect(
      `${appUrl}/?${params.toString()}`,
      { status: 302 }
    )
  } catch {
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Bitrix24 auth endpoint' })
}