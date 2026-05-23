import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') ?? '30'
    const days = parseInt(period)
    const companyPrefix = request.nextUrl.searchParams.get('company_prefix')
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromDateStr = fromDate.toISOString()

    // 1. Статистика по статусам
    let contractsQuery = supabase
      .from('contracts')
      .select('status, company_prefix')
      .neq('status', 'архив')
    if (companyPrefix) {
      contractsQuery = contractsQuery.or(
        companyPrefix.split(',').map(p => `number.like.${p}-%`).join(',')
      )
    }
    const { data: allContracts } = await contractsQuery

    const statusStats: Record<string, number> = {}
    const companyStats: Record<string, number> = {}
    ;(allContracts ?? []).forEach((c: { status: string; company_prefix?: string }) => {
      statusStats[c.status] = (statusStats[c.status] ?? 0) + 1
      if (c.company_prefix) {
        companyStats[c.company_prefix] = (companyStats[c.company_prefix] ?? 0) + 1
      }
    })

    // 2. Просроченные согласования
    const { data: overdueApprovals } = await supabase
      .from('approval_sessions')
      .select(`
        id, deadline, initiated_by_name,
        contracts!inner ( id, number, title, counterparty, status )
      `)
      .eq('status', 'active')
      .lt('deadline', new Date().toISOString())
      .order('deadline', { ascending: true })
      .limit(10)

    // 3. Согласованы но без подписанных экземпляров
    const { data: unsignedContracts } = await supabase
      .from('contracts')
      .select('id, number, title, counterparty, created_at')
      .eq('status', 'согласован')
      .order('created_at', { ascending: true })
      .limit(10)

    // 4. Просроченные пункты чек-листа (без задачи Б24)
    const { data: overdueChecklist } = await supabase
      .from('contract_checklist')
      .select(`
        id, title, due_date, contract_id,
        contracts!inner ( id, number, title )
      `)
      .eq('is_done', false)
      .is('bitrix_task_id', null)
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
      .limit(10)

    // 5. Динамика создания документов за период
    const { data: recentContracts } = await supabase
      .from('contracts')
      .select('created_at, company_prefix, status')
      .gte('created_at', fromDateStr)
      .order('created_at', { ascending: true })

    // Группируем по неделям
    const weeklyMap: Record<string, number> = {}
    ;(recentContracts ?? []).forEach((c: { created_at: string }) => {
      const date = new Date(c.created_at)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay())
      const key = weekStart.toISOString().slice(0, 10)
      weeklyMap[key] = (weeklyMap[key] ?? 0) + 1
    })

    // Группируем по компаниям за период
    const companyPeriodStats: Record<string, number> = {}
    ;(recentContracts ?? []).forEach((c: { company_prefix?: string }) => {
      if (c.company_prefix) {
        companyPeriodStats[c.company_prefix] = (companyPeriodStats[c.company_prefix] ?? 0) + 1
      }
    })

    return NextResponse.json({
      status_stats: statusStats,
      company_stats: companyStats,
      overdue_approvals: overdueApprovals ?? [],
      unsigned_contracts: unsignedContracts ?? [],
      overdue_checklist: overdueChecklist ?? [],
      weekly_dynamics: weeklyMap,
      company_period_stats: companyPeriodStats,
      total_period: recentContracts?.length ?? 0,
      period_days: days,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}