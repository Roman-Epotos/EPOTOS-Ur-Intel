import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  })
}

export async function POST(request: NextRequest) {
  try {
    const { bucket, path } = await request.json()
    if (!bucket || !path) {
      return NextResponse.json({ error: 'bucket и path обязательны' }, { status: 400, headers: CORS })
    }

    const allowedBuckets = ['counterparty-docs', 'contracts']
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Недопустимый bucket' }, { status: 403, headers: CORS })
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path)

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Ошибка получения URL' }, { status: 500, headers: CORS })
    }

    // Также возвращаем публичный URL файла после загрузки
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      path: data.path,
      public_url: publicData.publicUrl,
    }, { headers: CORS })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}