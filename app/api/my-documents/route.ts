import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')

  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  try {
    // 1. Документы где я согласующий (обязательный) со статусом pending
    const { data: myApprovals } = await supabase
      .from('approval_participants')
      .select(`
        id,
        role,
        status,
        stage,
        session_id,
        approval_sessions!inner (
          id,
          contract_id,
          deadline,
          initiated_by_name,
          contracts!inner (
            id,
            number,
            title,
            counterparty,
            status,
            amount
          )
        )
      `)
      .eq('bitrix_user_id', userId)
      .eq('status', 'pending')

    // 2. Мои черновики
    const { data: myDrafts } = await supabase
      .from('contracts')
      .select('*')
      .eq('author_bitrix_id', userId)
      .eq('status', 'черновик')
      .order('created_at', { ascending: false })

    // 3. Документы где я инициатор согласования
    const { data: myInitiated } = await supabase
      .from('approval_sessions')
      .select(`
        id,
        deadline,
        status,
        created_at,
        contracts!inner (
          id,
          number,
          title,
          counterparty,
          status,
          amount
        )
      `)
      .eq('initiated_by_bitrix_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    // Разделяем на обязательных и для ознакомления
    const requiredApprovals = (myApprovals ?? []).filter(p => p.role === 'required')
    const optionalApprovals = (myApprovals ?? []).filter(p => p.role === 'optional')

    return NextResponse.json({
      required_approvals: requiredApprovals,
      optional_approvals: optionalApprovals,
      my_drafts: myDrafts ?? [],
      my_initiated: myInitiated ?? [],
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}