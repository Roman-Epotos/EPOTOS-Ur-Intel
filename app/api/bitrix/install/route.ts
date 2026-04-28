import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const domain = body.get('DOMAIN') as string
    const memberId = body.get('member_id') as string
    const authId = body.get('AUTH_ID') as string
    const refreshId = body.get('REFRESH_ID') as string

    const appUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Эпотос-ЮрИнтел</title>
  <script src="https://api.bitrix24.com/api/v1/"></script>
</head>
<body>
  <script>
    BX24.init(function() {
      BX24.installFinish();
    });
  </script>
  <p>Установка завершена. Перенаправление...</p>
  <script>
    window.location.href = '${appUrl}?domain=${domain}&member_id=${memberId}&auth_id=${authId}&refresh_id=${refreshId}';
  </script>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch {
    return NextResponse.json({ error: 'Install error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Bitrix24 install endpoint' })
}