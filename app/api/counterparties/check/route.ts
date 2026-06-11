import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const DADATA_API_KEY = process.env.DADATA_API_KEY!
const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}

// Проверка через DaData
async function checkDadata(inn: string) {
  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Token ${DADATA_API_KEY}` },
      body: JSON.stringify({ query: inn, count: 1 }),
    })
    const data = await res.json()
    const company = data.suggestions?.[0]?.data
    if (!company) return { found: false }
    return {
      found: true,
      name: company.name?.short_with_opf ?? company.name?.full_with_opf,
      status: company.state?.status, // ACTIVE, LIQUIDATING, LIQUIDATED, BANKRUPT, REORGANIZING
      status_date: company.state?.actuality_date,
      director: company.management?.name,
      director_post: company.management?.post,
      address: company.address?.value,
      registration_date: company.state?.registration_date,
      capital: company.finance?.ustavcap,
    }
  } catch { return { found: false, error: 'Ошибка DaData' } }
}

// Проверка через ФССП
async function checkFSSP(inn: string, name: string) {
  try {
    const res = await fetch(`https://api-ip.fssprus.ru/api/v1.0/search?type=ip&query=${encodeURIComponent(name)}&region=0`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return { found: false, count: 0 }
    const data = await res.json()
    const items = data.response?.result ?? []
    const total = data.response?.total ?? items.length
    return {
      found: total > 0,
      count: total,
      items: items.slice(0, 3).map((i: Record<string, string>) => ({
        subject: i.name,
        amount: i.amount,
        details: i.details,
      })),
    }
  } catch { return { found: false, count: 0, error: 'Ошибка ФССП' } }
}

// Проверка банкротства через ЕФРСБ
async function checkBankrupt(inn: string) {
  try {
    const res = await fetch(`https://bankrot.fedresurs.ru/api/v1/companies?inn=${inn}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return { found: false }
    const data = await res.json()
    const items = data.data ?? []
    return {
      found: items.length > 0,
      count: items.length,
      items: items.slice(0, 2).map((i: Record<string, string>) => ({
        status: i.publisherStatus,
        case: i.caseNumber,
        date: i.publishDate,
      })),
    }
  } catch { return { found: false, error: 'Ошибка ЕФРСБ' } }
}

// Проверка реестра недобросовестных поставщиков (РНП ФАС)
async function checkRNP(inn: string) {
  try {
    const res = await fetch(`https://rnp.fas.gov.ru/api/v1/violations?inn=${inn}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return { found: false }
    const data = await res.json()
    const items = data.data ?? []
    return {
      found: items.length > 0,
      count: items.length,
      items: items.slice(0, 2).map((i: Record<string, string>) => ({
        name: i.supplierName,
        reason: i.reason,
        date: i.inclusionDate,
        expires: i.exclusionDate,
      })),
    }
  } catch { return { found: false, error: 'Ошибка РНП' } }
}

// Определяем уровень риска
function calcRiskLevel(dadata: Record<string, unknown>, fssp: Record<string, unknown>, bankrupt: Record<string, unknown>, rnp: Record<string, unknown>): 'low' | 'medium' | 'high' {
  if (rnp.found || bankrupt.found) return 'high'
  const badStatus = ['LIQUIDATING', 'LIQUIDATED', 'BANKRUPT', 'REORGANIZING']
  if (dadata.status && badStatus.includes(dadata.status as string)) return 'high'
  if (fssp.found && (fssp.count as number) > 3) return 'high'
  if (fssp.found || dadata.status === 'REORGANIZING') return 'medium'
  return 'low'
}

export async function POST(request: NextRequest) {
  try {
    const { inn, counterparty_id, name } = await request.json()
    if (!inn) return NextResponse.json({ error: 'ИНН обязателен' }, { status: 400, headers: CORS })

    // Проверяем кэш
    const { data: cached } = await supabase
      .from('counterparty_checks')
      .select('*')
      .eq('inn', inn)
      .gt('expires_at', new Date().toISOString())
      .order('checked_at', { ascending: false })
      .limit(1)
      .single()

    if (cached) {
      return NextResponse.json({ ...cached, from_cache: true }, { headers: CORS })
    }

    // Запускаем все проверки параллельно
    const [dadata, fssp, bankrupt, rnp] = await Promise.all([
      checkDadata(inn),
      checkFSSP(inn, name ?? inn),
      checkBankrupt(inn),
      checkRNP(inn),
    ])

    const risk_level = calcRiskLevel(
      dadata as Record<string, unknown>,
      fssp as Record<string, unknown>,
      bankrupt as Record<string, unknown>,
      rnp as Record<string, unknown>
    )

    // Формируем краткое резюме
    const issues: string[] = []
    if (rnp.found) issues.push(`включён в РНП ФАС (${rnp.count} записей)`)
    if (bankrupt.found) issues.push(`банкротство (${bankrupt.count} дел)`)
    if (fssp.found) issues.push(`исполнительные производства (${fssp.count})`)
    const badStatus: Record<string, string> = { LIQUIDATING: 'в процессе ликвидации', LIQUIDATED: 'ликвидирован', BANKRUPT: 'банкрот', REORGANIZING: 'в реорганизации' }
    if (dadata.status && badStatus[dadata.status as string]) issues.push(badStatus[dadata.status as string])

    const summary = issues.length > 0
      ? `Выявлены риски: ${issues.join(', ')}.`
      : 'Серьёзных рисков не выявлено.'

    // Сохраняем в кэш
    const { data: saved } = await supabase
      .from('counterparty_checks')
      .insert({
        counterparty_id: counterparty_id ?? null,
        inn,
        risk_level,
        dadata,
        fssp,
        bankrupt,
        rnp,
        summary,
      })
      .select()
      .single()

    return NextResponse.json({ ...(saved ?? {}), from_cache: false }, { headers: CORS })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}