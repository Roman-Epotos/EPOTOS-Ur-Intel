import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
    if (!bitrixUserId) return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
    const userId = parseInt(bitrixUserId)

    // 1. Документы требующие моего согласования
    const { data: myApprovals } = await supabase
      .from('approval_participants')
      .select(`
        id, role, status, stage,
        approval_sessions!inner (
          id, deadline, initiated_by_name,
          contracts!inner (
            id, number, title, counterparty, status, amount
          )
        )
      `)
      .eq('bitrix_user_id', userId)
      .eq('status', 'pending')
      .eq('role', 'required')

    // 2. Пункты чек-листа с дедлайном в ближайшие 3 дня
    const today = new Date()
    const in3days = new Date()
    in3days.setDate(today.getDate() + 3)
    const { data: deadlineItems } = await supabase
      .from('contract_checklist')
      .select(`
        id, title, due_date, contract_id,
        contracts!inner ( id, number, title )
      `)
      .eq('is_done', false)
      .is('bitrix_task_id', null)
      .gte('due_date', today.toISOString().slice(0, 10))
      .lte('due_date', in3days.toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
      .limit(10)

    // 3. Мои черновики
    const { data: myDrafts } = await supabase
      .from('contracts')
      .select('id, number, title, counterparty, created_at, type')
      .eq('author_bitrix_id', userId)
      .eq('status', 'черновик')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5)

    // 4. Мои активные согласования (где я инициатор)
    const { data: myInitiated } = await supabase
      .from('approval_sessions')
      .select(`
        id, deadline, created_at,
        contracts!inner ( id, number, title, counterparty, status )
      `)
      .eq('initiated_by_bitrix_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5)

    // 5. Контрагенты с высоким риском у которых есть активные документы
    const { data: highRiskCounterparties } = await supabase
      .from('counterparties')
      .select('id, full_name, short_name, inn, risk_level, status')
      .eq('risk_level', 'высокий')
      .eq('status', 'активный')
      .limit(5)

    // 6. Статистика документов
    const { count: totalDocs } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })

    const { count: onApproval } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'на_согласовании')

    const { count: onExecution } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'на_исполнении')

    const { count: totalCounterparties } = await supabase
      .from('counterparties')
      .select('*', { count: 'exact', head: true })

    // Проверяем доступ к дашбордам напрямую из БД
    const { data: sysRole } = await supabase
      .from('system_roles')
      .select('role')
      .eq('bitrix_user_id', userId)
      .single()

    const GC_ROLES = ['developer', 'admin', 'gc_manager', 'finance_gc', 'finance_company', 'legal_gc']
    const isGC = userId === 30 || (sysRole && GC_ROLES.includes(sysRole.role))

    const { data: legalSetting } = await supabase
      .from('approval_settings')
      .select('id').eq('bitrix_user_id', userId)
      .eq('stage', 'legal').eq('is_active', true).limit(1)

    const { data: financeSetting } = await supabase
      .from('approval_settings')
      .select('id').eq('bitrix_user_id', userId)
      .in('stage', ['finance', 'accounting']).eq('is_active', true).limit(1)

    const { data: directorSetting } = await supabase
      .from('approval_settings')
      .select('id').eq('bitrix_user_id', userId)
      .eq('stage', 'director').eq('is_active', true).limit(1)

    const legalAccess = isGC || (legalSetting ?? []).length > 0 || (directorSetting ?? []).length > 0
    const financeAccess = isGC || (financeSetting ?? []).length > 0 || (directorSetting ?? []).length > 0

    return NextResponse.json({
      my_approvals: myApprovals ?? [],
      deadline_items: deadlineItems ?? [],
      my_drafts: myDrafts ?? [],
      my_initiated: myInitiated ?? [],
      high_risk_counterparties: highRiskCounterparties ?? [],
      has_dashboard_access: legalAccess || financeAccess,
      legal_dashboard_access: legalAccess,
      finance_dashboard_access: financeAccess,
      stats: {
        total_docs: totalDocs ?? 0,
        on_approval: onApproval ?? 0,
        on_execution: onExecution ?? 0,
        total_counterparties: totalCounterparties ?? 0,
      }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}