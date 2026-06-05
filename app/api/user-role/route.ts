import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const DEVELOPER_ID = 30
const ALL_COMPANIES = ['ТХ', 'НПП', 'СПТ', 'ОС', 'Э-К']

const GC_ROLE_PRIORITY: Record<string, number> = {
  developer:       1,
  admin:           2,
  gc_manager:      3,
  finance_gc:      4,
  finance_company: 5,
  legal_gc:        6,
}

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }
  const userId = parseInt(bitrixUserId)

  // 1. Проверяем роль ГК (наивысшая из найденных)
  let gcRole: string | null = null

  if (userId === DEVELOPER_ID) {
    gcRole = 'developer'
  } else {
    const { data: systemRole } = await supabase
      .from('system_roles')
      .select('role')
      .eq('bitrix_user_id', userId)
      .single()
    if (systemRole) gcRole = systemRole.role
  }

  // Если есть роль ГК — возвращаем сразу (все компании + все роли согласующих не важны)
  if (gcRole) {
    // Но всё равно собираем роли из согласующих для all_roles
    const approvalRoles: string[] = []

    const { data: dirSettings } = await supabase
      .from('approval_settings')
      .select('id')
      .eq('bitrix_user_id', userId)
      .eq('stage', 'director')
      .eq('is_active', true)
      .limit(1)
    if (dirSettings && dirSettings.length > 0) approvalRoles.push('director')

    const { data: legalSettings } = await supabase
      .from('approval_settings')
      .select('id')
      .eq('bitrix_user_id', userId)
      .eq('stage', 'legal')
      .eq('is_active', true)
      .limit(1)
    if (legalSettings && legalSettings.length > 0) approvalRoles.push('legal')

    const { data: finSettings } = await supabase
      .from('approval_settings')
      .select('id')
      .eq('bitrix_user_id', userId)
      .in('stage', ['finance', 'accounting'])
      .eq('is_active', true)
      .limit(1)
    if (finSettings && finSettings.length > 0) approvalRoles.push('finance')

    return NextResponse.json({
      role: gcRole,
      companies: ALL_COMPANIES,
      all_roles: [gcRole, ...approvalRoles],
    })
  }

  // 2. Нет роли ГК — проверяем роли из согласующих (все одноранговые)
  const approvalRoles: string[] = []
  const companiesMap: Record<string, string[]> = {}

  // Директор
  const { data: dirSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .eq('stage', 'director')
    .eq('is_active', true)

  if (dirSettings && dirSettings.length > 0) {
    const companies = dirSettings.map((s: { company_prefix: string | null }) => s.company_prefix).filter(Boolean) as string[]
    if (companies.length > 0) { approvalRoles.push('director'); companiesMap['director'] = companies }
  }

  // Юрист
  const { data: legalSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .eq('stage', 'legal')
    .eq('is_active', true)

  if (legalSettings && legalSettings.length > 0) {
    const companies = legalSettings.map((s: { company_prefix: string | null }) => s.company_prefix).filter(Boolean) as string[]
    if (companies.length > 0) { approvalRoles.push('legal'); companiesMap['legal'] = companies }
  }

  // Финансист
  const { data: finSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .in('stage', ['finance', 'accounting'])
    .eq('is_active', true)

  if (finSettings && finSettings.length > 0) {
    const companies = [...new Set(finSettings.map((s: { company_prefix: string | null }) => s.company_prefix).filter(Boolean) as string[])]
    if (companies.length > 0) { approvalRoles.push('finance'); companiesMap['finance'] = companies }
  }

  if (approvalRoles.length === 0) {
    return NextResponse.json({ role: 'user', companies: [], all_roles: ['user'] })
  }

  // Объединяем все компании из всех ролей согласующих
  const allCompanies = [...new Set(Object.values(companiesMap).flat())]

  // Основная роль — первая в списке приоритетов: director > legal > finance
  const primaryRole = ['director', 'legal', 'finance'].find(r => approvalRoles.includes(r)) ?? approvalRoles[0]

  return NextResponse.json({
    role: primaryRole,
    companies: allCompanies,
    all_roles: approvalRoles,
  })
}