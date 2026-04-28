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
      auth_id: authId ?? '',
      refresh_id: refreshId ?? '',
      auth_expires: authExpires ?? '',
    })

    const appUrl = 'https://epotos-ur-intel.vercel.app'

    return NextResponse.redirect(
      `${appUrl}/?${params.toString()}`,
      { status: 302 }
    )
  } catch {
    return NextResponse.json({ error: 'Auth error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('DOMAIN') ?? searchParams.get('domain')
  const memberId = searchParams.get('member_id')
  const authId = searchParams.get('AUTH_ID') ?? searchParams.get('auth_id') ?? ''
  const refreshId = searchParams.get('REFRESH_ID') ?? searchParams.get('refresh_id') ?? ''

  if (domain && memberId) {
    const params = new URLSearchParams({
      domain,
      member_id: memberId,
      auth_id: authId,
      refresh_id: refreshId,
    })
    return NextResponse.redirect(
      `https://epotos-ur-intel.vercel.app/?${params.toString()}`,
      { status: 302 }
    )
  }

  return NextResponse.redirect('https://epotos-ur-intel.vercel.app/', { status: 302 })
}