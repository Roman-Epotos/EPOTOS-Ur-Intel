import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

// GET — список удалённых документов
export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  if (!bitrixUserId || !ADMIN_IDS.includes(parseInt(bitrixUserId))) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('contracts')
    .select('id, number, title, status, company_prefix, deleted_at, deleted_by_name, delete_reason, created_at, author_bitrix_id')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ contracts: data ?? [] })
}

// POST — восстановить документ
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { contract_id, bitrix_user_id, user_name } = body

  if (!ADMIN_IDS.includes(parseInt(bitrix_user_id))) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  const { error } = await supabase
    .from('contracts')
    .update({
      deleted_at: null,
      deleted_by_bitrix_id: null,
      deleted_by_name: null,
      delete_reason: null,
    })
    .eq('id', contract_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('contract_logs').insert({
    contract_id,
    action: 'Документ восстановлен',
    details: `Восстановлен администратором`,
    user_name: user_name ?? 'Администратор',
  })

  return NextResponse.json({ success: true })
}

// DELETE — безвозвратное удаление
export async function DELETE(request: NextRequest) {
  const body = await request.json()
  const { contract_id, bitrix_user_id } = body

  if (!ADMIN_IDS.includes(parseInt(bitrix_user_id))) {
    return NextResponse.json({ error: 'Нет прав' }, { status: 403 })
  }

  // Удаляем файлы из Storage
  const { data: versions } = await supabase
    .from('versions')
    .select('file_url')
    .eq('contract_id', contract_id)

  const { data: attachments } = await supabase
    .from('document_attachments')
    .select('file_url')
    .eq('contract_id', contract_id)

  const filePaths = [
    ...(versions ?? []).map((v: { file_url: string }) => v.file_url.split('/contracts/')[1]).filter(Boolean),
    ...(attachments ?? []).map((a: { file_url: string }) => a.file_url.split('/contracts/')[1]).filter(Boolean),
  ]

  if (filePaths.length > 0) {
    await supabase.storage.from('contracts').remove(filePaths)
  }

  // Физически удаляем документ (каскадно удалятся все связанные записи)
  const { error } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contract_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}