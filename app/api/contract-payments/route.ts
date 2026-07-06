import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

const CORS = { 'Access-Control-Allow-Origin': '*' }

async function canRecordPayment(
  userId: number,
  companyPrefix: string,
  authorId: number | null
): Promise<boolean> {
  if (ADMIN_IDS.includes(userId)) return true
  if (authorId && authorId === userId) return true

  const { data } = await supabase
    .from('approval_settings')
    .select('id')
    .eq('bitrix_user_id', userId)
    .in('stage', ['director', 'finance', 'accounting'])
    .eq('company_prefix', companyPrefix)
    .eq('is_active', true)
    .limit(1)

  return !!(data && data.length > 0)
}

// GET — список оплат по договору + сводка (оплачено/остаток)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contractId = searchParams.get('contract_id')

    if (!contractId) {
      return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400, headers: CORS })
    }

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('amount')
      .eq('id', contractId)
      .single()

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 400, headers: CORS })
    }

    const { data: payments, error: paymentsError } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('payment_date', { ascending: false })

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 400, headers: CORS })
    }

    const paidTotal = (payments ?? []).reduce((sum, p) => sum + Number(p.amount), 0)
    const contractAmount = Number(contract?.amount ?? 0)
    const remaining = contractAmount - paidTotal

    return NextResponse.json({
      payments: payments ?? [],
      summary: {
        contract_amount: contractAmount,
        paid_total: paidTotal,
        remaining,
      },
    }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

// POST — добавить факт оплаты
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contract_id,
      amount,
      payment_date,
      payment_type,
      comment,
      user_name,
      user_bitrix_id,
    } = body

    if (!contract_id || !amount || !payment_date || !payment_type) {
      return NextResponse.json(
        { error: 'contract_id, amount, payment_date, payment_type обязательны' },
        { status: 400, headers: CORS }
      )
    }

    const userId = parseInt(user_bitrix_id ?? '0')

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('company_prefix, number, author_bitrix_id')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404, headers: CORS })
    }

    const companyPrefix = contract.company_prefix?.startsWith('Э-К')
      ? 'Э-К'
      : (contract.company_prefix ?? contract.number?.split('-')[0] ?? '')

    const allowed = await canRecordPayment(userId, companyPrefix, contract.author_bitrix_id)
    if (!allowed) {
      return NextResponse.json({ error: 'Нет прав на внесение оплаты по этому договору' }, { status: 403, headers: CORS })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('contract_payments')
      .insert({
        contract_id,
        amount,
        payment_date,
        payment_type,
        comment: comment || null,
        created_by_name: user_name ?? 'Система',
        created_by_bitrix_id: userId || null,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400, headers: CORS })
    }

    const typeLabels: Record<string, string> = {
      'аванс': 'Аванс',
      'частичная_оплата': 'Частичная оплата',
      'окончательный_расчет': 'Окончательный расчёт',
    }

    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Внесён факт оплаты',
      details: `${typeLabels[payment_type] ?? payment_type}: ${amount} руб. (${payment_date})${comment ? '. ' + comment : ''}`,
      user_name: user_name ?? 'Система',
    })

    return NextResponse.json({ success: true, payment: inserted }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

// DELETE — удалить факт оплаты (админ или тот, кто вносил)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('id')
    const userBitrixId = searchParams.get('user_bitrix_id')
    const userName = searchParams.get('user_name')

    if (!paymentId) {
      return NextResponse.json({ error: 'id обязателен' }, { status: 400, headers: CORS })
    }

    const userId = parseInt(userBitrixId ?? '0')

    const { data: payment, error: fetchError } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('id', paymentId)
      .single()

    if (fetchError || !payment) {
      return NextResponse.json({ error: 'Запись не найдена' }, { status: 404, headers: CORS })
    }

    const isOwn = payment.created_by_bitrix_id === userId
    if (!ADMIN_IDS.includes(userId) && !isOwn) {
      return NextResponse.json({ error: 'Нет прав на удаление этой записи' }, { status: 403, headers: CORS })
    }

    const { error: deleteError } = await supabase
      .from('contract_payments')
      .delete()
      .eq('id', paymentId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400, headers: CORS })
    }

    await supabase.from('contract_logs').insert({
      contract_id: payment.contract_id,
      action: 'Удалён факт оплаты',
      details: `${payment.amount} руб. от ${payment.payment_date}`,
      user_name: userName ?? 'Система',
    })

    return NextResponse.json({ success: true }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS })
}