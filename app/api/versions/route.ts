import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
  const contractId = request.nextUrl.searchParams.get('contract_id')
  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }
  const { data: versions, error } = await supabase
    .from('versions')
    .select('*')
    .eq('contract_id', contractId)
    .order('version_number', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ versions: versions ?? [] })
}

export async function POST(request: NextRequest) {
  console.log('=== versions API called ===')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const contentType = request.headers.get('content-type') ?? ''
    let contractId: string
    let comment: string
    let userName: string
    let fileUrl: string
    let fileName: string

    if (contentType.includes('application/json')) {
      // Файл уже загружен через uploadFileDirect — получаем только метаданные
      const json = await request.json()
      contractId = json.contract_id
      comment = json.comment ?? ''
      userName = json.user_name ?? 'Система'
      fileUrl = json.file_url
      fileName = json.file_name

      if (!contractId || !fileUrl || !fileName) {
        return NextResponse.json({ error: 'contract_id, file_url и file_name обязательны' }, { status: 400 })
      }
    } else {
      // Старый путь через FormData (файлы до 4.5 МБ)
      const formData = await request.formData()
      const file = formData.get('file') as File
      contractId = formData.get('contract_id') as string
      comment = formData.get('comment') as string ?? ''
      userName = formData.get('user_name') as string ?? 'Система'

      if (!file || !contractId) {
        return NextResponse.json({ error: 'Файл и ID договора обязательны' }, { status: 400 })
      }

      const { count } = await supabase
        .from('versions')
        .select('*', { count: 'exact', head: true })
        .eq('contract_id', contractId)

      const versionNumber = (count ?? 0) + 1
      const fileExt = file.name.split('.').pop()
      const filePath = `${contractId}/v${versionNumber}_${Date.now()}.${fileExt}`
      const arrayBuffer = await file.arrayBuffer()
      const fileBuffer = new Uint8Array(arrayBuffer)

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(filePath, fileBuffer, { contentType: file.type, upsert: false })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 400 })
      }

      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(filePath)
      fileUrl = urlData.publicUrl
      fileName = file.name
    }

    // Получаем номер версии
    const { count: vCount } = await supabase
      .from('versions')
      .select('*', { count: 'exact', head: true })
      .eq('contract_id', contractId)
    const versionNumber = (vCount ?? 0) + 1

    const { error: versionError } = await supabase
      .from('versions')
      .insert({
        contract_id: contractId,
        version_number: versionNumber,
        file_url: fileUrl,
        file_name: fileName,
        comment: comment || null,
      })

    console.log('version insert:', versionError ? versionError.message : 'success')

    if (versionError) {
      return NextResponse.json({ error: versionError.message }, { status: 400 })
    }

    await supabase
      .from('contract_logs')
      .insert({
        contract_id: contractId,
        action: `Загружена версия документа v${versionNumber}`,
        details: `Файл: ${fileName}${comment ? '. Комментарий: ' + comment : ''}`,
        user_name: 'Система',
      })

    console.log('=== versions API success ===')
    return NextResponse.json({ success: true, version: versionNumber })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    console.error('versions API error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )

  try {
    const body = await request.json()
    const { version_id, file_path, contract_id, user_name } = body

    if (!version_id) {
      return NextResponse.json({ error: 'version_id обязателен' }, { status: 400 })
    }

    // Удаляем файл из Storage
    if (file_path) {
      await supabase.storage
        .from('contracts')
        .remove([file_path])
    }

    // Удаляем запись из базы
    const { error } = await supabase
      .from('versions')
      .delete()
      .eq('id', version_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Версия документа удалена',
        details: `Удалена версия документа`,
        user_name: user_name ?? 'Система',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}