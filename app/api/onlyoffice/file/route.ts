import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const version_id = request.nextUrl.searchParams.get('version_id')
    const attachment_id = request.nextUrl.searchParams.get('attachment_id')

    if (!version_id && !attachment_id) {
      return NextResponse.json({ error: 'version_id или attachment_id обязателен' }, { status: 400 })
    }

    let fileUrl: string
    let fileName: string

    if (version_id) {
      const { data: version } = await supabase
        .from('versions')
        .select('*')
        .eq('id', version_id)
        .single()

      if (!version) {
        return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 })
      }

      fileUrl = version.file_url
      fileName = version.file_name
    } else {
      const { data: attachment } = await supabase
        .from('document_attachments')
        .select('*')
        .eq('id', attachment_id)
        .single()

      if (!attachment) {
        return NextResponse.json({ error: 'Вложение не найдено' }, { status: 404 })
      }

      fileUrl = attachment.file_url
      fileName = attachment.file_name
    }

    // Скачиваем файл из Supabase и проксируем
    const fileResponse = await fetch(fileUrl)
    const arrayBuffer = await fileResponse.arrayBuffer()

    const contentType = fileName.endsWith('.xlsx')
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}