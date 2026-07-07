import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

async function canConfirmStorage(userId: number, companyPrefix: string): Promise<boolean> {
  if (ADMIN_IDS.includes(userId)) return true

  const { data: sysRole } = await supabase
    .from('system_roles')
    .select('role')
    .eq('bitrix_user_id', userId)
    .single()

  if (sysRole?.role === 'legal_gc') return true

  const { data: legalSetting } = await supabase
    .from('approval_settings')
    .select('id')
    .eq('bitrix_user_id', userId)
    .eq('stage', 'legal')
    .eq('company_prefix', companyPrefix)
    .eq('is_active', true)
    .limit(1)

  return !!(legalSetting && legalSetting.length > 0)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { user_name, user_bitrix_id } = body

    const userId = parseInt(user_bitrix_id ?? '0')

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('company_prefix, number, title, status')
      .eq('id', id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404 })
    }

    const companyPrefix = contract.company_prefix?.startsWith('Э-К')
      ? 'Э-К'
      : (contract.company_prefix ?? contract.number?.split('-')[0] ?? '')

    const allowed = await canConfirmStorage(userId, companyPrefix)
    if (!allowed) {
      return NextResponse.json({ error: 'Нет прав на приём документа на хранение' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        storage_confirmed_at: new Date().toISOString(),
        storage_confirmed_by_name: user_name ?? 'Система',
        storage_confirmed_by_bitrix_id: userId,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabase.from('contract_logs').insert({
      contract_id: id,
      action: 'Оригинал документа принят на хранение',
      details: `Принял: ${user_name ?? 'Система'}`,
      user_name: user_name ?? 'Система',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — отменить отметку (на случай ошибки)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const userBitrixId = searchParams.get('user_bitrix_id')
    const userName = searchParams.get('user_name')

    const userId = parseInt(userBitrixId ?? '0')

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('company_prefix, number')
      .eq('id', id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404 })
    }

    const companyPrefix = contract.company_prefix?.startsWith('Э-К')
      ? 'Э-К'
      : (contract.company_prefix ?? contract.number?.split('-')[0] ?? '')

    const allowed = await canConfirmStorage(userId, companyPrefix)
    if (!allowed) {
      return NextResponse.json({ error: 'Нет прав на отмену отметки' }, { status: 403 })
    }

    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        storage_confirmed_at: null,
        storage_confirmed_by_name: null,
        storage_confirmed_by_bitrix_id: null,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabase.from('contract_logs').insert({
      contract_id: id,
      action: 'Отменена отметка о приёме на хранение',
      details: `Отменил: ${userName ?? 'Система'}`,
      user_name: userName ?? 'Система',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}