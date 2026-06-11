import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url')
    if (!url) return NextResponse.json({ error: 'url не указан' }, { status: 400 })

    // Разрешаем только наш Supabase bucket
    const allowed = [
      'qmzyybisajjmneydekoo.supabase.co',
    ]
    const parsed = new URL(url)
    if (!allowed.some(domain => parsed.hostname.includes(domain))) {
      return NextResponse.json({ error: 'Недопустимый источник' }, { status: 403 })
    }

    const response = await fetch(url, {
      headers: { 'Accept': '*/*' },
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Файл не найден' }, { status: response.status })
    }

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const contentDisposition = response.headers.get('content-disposition') ?? ''
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition || 'inline',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}