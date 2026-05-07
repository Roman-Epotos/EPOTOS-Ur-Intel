import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const version_id = request.nextUrl.searchParams.get('version_id')

    if (!version_id) {
      return NextResponse.json({ error: 'version_id обязателен' }, { status: 400 })
    }

    const { data: version } = await supabase
      .from('versions')
      .select('*')
      .eq('id', version_id)
      .single()

    if (!version) {
      return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 })
    }

    // Скачиваем файл из Supabase и проксируем
    const fileResponse = await fetch(version.file_url)
    const arrayBuffer = await fileResponse.arrayBuffer()

    const contentType = version.file_name.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(version.file_name)}"`,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}