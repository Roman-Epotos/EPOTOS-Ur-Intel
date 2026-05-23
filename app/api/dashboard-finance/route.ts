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
    const prefixes = companyPrefix ? companyPrefix.split(',') : null

    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    const fromDateStr = fromDate.toISOString()

    // Фильтр по компании
    const filterByCompany = <T extends { number?: string; company_prefix?: string }>(items: T[]): T[] => {
      if (!prefixes) return items
      return items.filter(c =>
        prefixes.some(p => c.number?.startsWith(`${p}-`) || c.company_prefix === p)
      )
    }

    // 1. Все договоры (не архив, с суммой)
    const { data: rawContracts } = await supabase
      .from('contracts')
      .select('id, number, title, counterparty, status, amount, company_prefix, end_date, created_at')
      .neq('status', 'архив')

    const allContracts = filterByCompany(rawContracts ?? [])

    // Суммы и кол-во по статусам
    const statsSums: Record<string, number> = {}
    const statsCount: Record<string, number> = {}
    allContracts.forEach(c => {
      if (c.amount) {
        statsSums[c.status] = (statsSums[c.status] ?? 0) + c.amount
        statsCount[c.status] = (statsCount[c.status] ?? 0) + 1
      }
    })

    // 2. Дебиторская задолженность
    const debtContracts = allContracts
      .filter(c => c.status === 'на_исполнении' && c.amount)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
      .slice(0, 10)

    const totalDebt = debtContracts.reduce((sum, c) => sum + (c.amount ?? 0), 0)

    // 3. Договоры без суммы (не черновик, не архив)
    const noAmountContracts = (rawContracts ?? [])
      .filter(c => !c.amount && c.status !== 'черновик')
      .filter(c => !prefixes || prefixes.some(p => c.number?.startsWith(`${p}-`)))
      .slice(0, 10)

    // 4. Топ контрагентов
    const counterpartyMap: Record<string, number> = {}
    allContracts.forEach(c => {
      if (c.counterparty && c.amount) {
        counterpartyMap[c.counterparty] = (counterpartyMap[c.counterparty] ?? 0) + c.amount
      }
    })
    const topCounterparties = Object.entries(counterpartyMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, total]) => ({ name, total }))

    // 5. Динамика за период
    const periodContracts = allContracts.filter(c =>
      c.created_at && new Date(c.created_at) >= new Date(fromDateStr) && c.amount
    )
    const companyAmounts: Record<string, number> = {}
    periodContracts.forEach(c => {
      if (c.company_prefix) {
        companyAmounts[c.company_prefix] = (companyAmounts[c.company_prefix] ?? 0) + (c.amount ?? 0)
      }
    })
    const totalPeriodAmount = periodContracts.reduce((sum, c) => sum + (c.amount ?? 0), 0)

    return NextResponse.json({
      stats_sums: statsSums,
      stats_count: statsCount,
      debt_contracts: debtContracts,
      total_debt: totalDebt,
      no_amount_contracts: noAmountContracts,
      top_counterparties: topCounterparties,
      company_amounts: companyAmounts,
      total_period_amount: totalPeriodAmount,
      period_days: days,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}