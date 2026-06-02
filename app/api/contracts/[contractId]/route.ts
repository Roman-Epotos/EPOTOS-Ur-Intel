import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ contract })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params
    const body = await request.json()
    const { admin_bitrix_id, reason } = body

    // Проверяем права администратора
    const { data: admin } = await supabase
      .from('system_admins')
      .select('id')
      .eq('bitrix_user_id', admin_bitrix_id)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    // Проверяем что причина указана (обязательно)
    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'Необходимо указать причину удаления' }, { status: 400 })
    }

    // Мягкое удаление — помечаем документ как удалённый
    const { error } = await supabase
      .from('contracts')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by_bitrix_id: admin_bitrix_id,
        deleted_by_name: body.user_name ?? 'Администратор',
        delete_reason: reason.trim(),
      })
      .eq('id', contractId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id: contractId,
        action: 'Документ удалён',
        details: `Причина: ${reason.trim()}`,
        user_name: body.user_name ?? 'Администратор',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params
    const body = await request.json()
    const { field, value, user_name, old_value } = body

    const ALLOWED_FIELDS = ['title', 'counterparty', 'amount', 'start_date', 'end_date', 'customer_number']
    if (!ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Поле не разрешено для редактирования' }, { status: 400 })
    }

    const { data: contract } = await supabase
      .from('contracts')
      .select('status')
      .eq('id', contractId)
      .single()

    const LOCKED_STATUSES = ['согласован', 'загружен_частично', 'подписан', 'на_исполнении']
    if (contract && LOCKED_STATUSES.includes(contract.status)) {
      return NextResponse.json({ error: 'Документ заблокирован для редактирования' }, { status: 403 })
    }

    const updateValue = field === 'amount'
      ? (value ? parseFloat(value) : null)
      : (value || null)

    const { error } = await supabase
      .from('contracts')
      .update({ [field]: updateValue })
      .eq('id', contractId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const fieldLabels: Record<string, string> = {
      title: 'Название',
      counterparty: 'Контрагент',
      amount: 'Сумма',
      start_date: 'Дата начала',
      end_date: 'Дата окончания',
      customer_number: 'Номер заказчика',
    }

    await supabase.from('contract_logs').insert({
      contract_id: contractId,
      action: `Изменено поле «${fieldLabels[field] ?? field}»`,
      details: `Было: ${old_value ?? '—'} → Стало: ${value || '—'}`,
      user_name: user_name ?? 'Пользователь',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}