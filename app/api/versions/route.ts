import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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
    const formData = await request.formData()
    console.log('formData parsed')

    const file = formData.get('file') as File
    const contractId = formData.get('contract_id') as string
    const comment = formData.get('comment') as string

    console.log('file:', file?.name, 'contractId:', contractId)

    if (!file || !contractId) {
      return NextResponse.json({ error: 'Файл и ID договора обязательны' }, { status: 400 })
    }

    // Получаем текущий номер версии
    console.log('getting version count...')
    const { count, error: countError } = await supabase
      .from('versions')
      .select('*', { count: 'exact', head: true })
      .eq('contract_id', contractId)

    console.log('count:', count, 'countError:', countError)

    const versionNumber = (count ?? 0) + 1

    // Загружаем файл
    const fileExt = file.name.split('.').pop()
    const filePath = `${contractId}/v${versionNumber}_${Date.now()}.${fileExt}`

    console.log('uploading to path:', filePath)

    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    console.log('upload result:', uploadError ? uploadError.message : 'success')

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: urlData } = supabase.storage
      .from('contracts')
      .getPublicUrl(filePath)

    const { error: versionError } = await supabase
      .from('versions')
      .insert({
        contract_id: contractId,
        version_number: versionNumber,
        file_url: urlData.publicUrl,
        file_name: file.name,
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
        action: `Загружена версия v${versionNumber}`,
        details: `Файл: ${file.name}${comment ? '. Комментарий: ' + comment : ''}`,
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