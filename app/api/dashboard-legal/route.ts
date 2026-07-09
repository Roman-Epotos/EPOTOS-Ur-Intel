import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const WEBHOOK = process.env.BITRIX_WEBHOOK_URL!

export async function GET(request: NextRequest) {
  try {
    const period = request.nextUrl.searchParams.get('period') ?? '30'
    const days = parseInt(period)
    const companyPrefix = request.nextUrl.searchParams.get('company_prefix')
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromDateStr = fromDate.toISOString()

    // Вспомогательная функция фильтра по префиксу компании
    const prefixFilter = (prefix: string) =>
      prefix.split(',').map(p => `number.like.${p}-%`).join(',')

    // ID договоров нужной компании (используем везде)
    let companyContractIds: string[] | null = null
    if (companyPrefix) {
      const { data: filtered } = await supabase
        .from('contracts')
        .select('id')
        .or(prefixFilter(companyPrefix))
      companyContractIds = (filtered ?? []).map((c: { id: string }) => c.id)
    }

    // 1. Статистика по статусам
    let contractsQuery = supabase
      .from('contracts')
      .select('status, company_prefix')
      .neq('status', 'архив')
    if (companyPrefix) {
      contractsQuery = contractsQuery.or(prefixFilter(companyPrefix))
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
    let overdueApprovalsQuery = supabase
      .from('approval_sessions')
      .select(`
        id, deadline, initiated_by_name,
        contracts!inner ( id, number, title, counterparty, status, author_bitrix_id )
      `)
      .eq('status', 'active')
      .lt('deadline', new Date().toISOString())
      .order('deadline', { ascending: true })
      .limit(10)
    if (companyContractIds) {
      overdueApprovalsQuery = overdueApprovalsQuery.in('contract_id', companyContractIds)
    }
    const { data: overdueApprovals } = await overdueApprovalsQuery

    // 3. Согласованы но без подписанных экземпляров
    let unsignedQuery = supabase
      .from('contracts')
      .select('id, number, title, counterparty, created_at, author_bitrix_id')
      .eq('status', 'согласован')
      .order('created_at', { ascending: true })
      .limit(10)
    if (companyContractIds) {
      unsignedQuery = unsignedQuery.in('id', companyContractIds)
    }
    const { data: unsignedContracts } = await unsignedQuery

    // 4. Просроченные пункты чек-листа (без задачи Б24)
    let overdueChecklistQuery = supabase
      .from('contract_checklist')
      .select(`
        id, title, due_date, contract_id,
        contracts!inner ( id, number, title, author_bitrix_id )
      `)
      .eq('is_done', false)
      .is('bitrix_task_id', null)
      .lt('due_date', new Date().toISOString().slice(0, 10))
      .order('due_date', { ascending: true })
      .limit(10)
    if (companyContractIds) {
      overdueChecklistQuery = overdueChecklistQuery.in('contract_id', companyContractIds)
    }
    const { data: overdueChecklist } = await overdueChecklistQuery

    // 5. Динамика создания документов за период
    let recentContractsQuery = supabase
      .from('contracts')
      .select('created_at, company_prefix, status')
      .gte('created_at', fromDateStr)
      .order('created_at', { ascending: true })
    if (companyPrefix) {
      recentContractsQuery = recentContractsQuery.or(prefixFilter(companyPrefix))
    }
    const { data: recentContracts } = await recentContractsQuery

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

    // Обогащаем карточки именами инициаторов — один пакетный запрос к Bitrix
    // ВАЖНО: TypeScript типизирует contracts!inner как массив, но реально
    // Supabase отдаёт один объект (подтверждено — фронтенд уже читает
    // a.contracts.number напрямую) — приводим тип, а не подстраиваем логику
    type WithAuthor = { contracts?: { author_bitrix_id?: number } }
    const authorIds = new Set<number>()
    ;(overdueApprovals ?? []).forEach((a) => {
      const id = (a as unknown as WithAuthor).contracts?.author_bitrix_id
      if (id) authorIds.add(id)
    })
    ;(unsignedContracts ?? []).forEach((c: { author_bitrix_id?: number }) => {
      if (c.author_bitrix_id) authorIds.add(c.author_bitrix_id)
    })
    ;(overdueChecklist ?? []).forEach((item) => {
      const id = (item as unknown as WithAuthor).contracts?.author_bitrix_id
      if (id) authorIds.add(id)
    })

    const authorNames: Record<number, string> = {}
    if (authorIds.size > 0) {
      try {
        const resp = await fetch(`${WEBHOOK}user.get.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filter: { ID: Array.from(authorIds) },
            select: ['ID', 'NAME', 'LAST_NAME'],
          }),
        })
        const userData = await resp.json()
        ;(userData.result ?? []).forEach((u: { ID: string; NAME: string; LAST_NAME: string }) => {
          authorNames[parseInt(u.ID)] = `${u.LAST_NAME} ${u.NAME}`.trim()
        })
      } catch {
        // молча игнорируем — карточки просто останутся без имени инициатора
      }
    }

    const enrichedApprovals = (overdueApprovals ?? []).map((a) => {
      const contracts = (a as unknown as WithAuthor).contracts
      return {
        ...a,
        contracts: contracts ? { ...contracts, author_name: authorNames[contracts.author_bitrix_id ?? 0] ?? null } : contracts,
      }
    })
    const enrichedUnsigned = (unsignedContracts ?? []).map((c: { author_bitrix_id?: number }) => ({
      ...c,
      author_name: authorNames[c.author_bitrix_id ?? 0] ?? null,
    }))
    const enrichedChecklist = (overdueChecklist ?? []).map((item) => {
      const contracts = (item as unknown as WithAuthor).contracts
      return {
        ...item,
        contracts: contracts ? { ...contracts, author_name: authorNames[contracts.author_bitrix_id ?? 0] ?? null } : contracts,
      }
    })

    return NextResponse.json({
      status_stats: statusStats,
      company_stats: companyStats,
      overdue_approvals: enrichedApprovals,
      unsigned_contracts: enrichedUnsigned,
      overdue_checklist: enrichedChecklist,
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