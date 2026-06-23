import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export const maxDuration = 60

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const path = formData.get('path') as string | null

    if (!file || !bucket || !path) {
      return NextResponse.json({ error: 'file, bucket и path обязательны' }, { status: 400, headers: CORS })
    }

    const allowedBuckets = ['counterparty-docs', 'contracts']
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Недопустимый bucket' }, { status: 403, headers: CORS })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500, headers: CORS })
    }

    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return NextResponse.json({
      success: true,
      public_url: publicData.publicUrl,
    }, { headers: CORS })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}