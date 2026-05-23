import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const DEVELOPER_ID = 30
const ALL_COMPANIES = ['ТХ', 'НПП', 'СПТ', 'ОС', 'Э-К']

// Иерархия ролей (чем меньше число — тем выше роль)
const ROLE_PRIORITY: Record<string, number> = {
  developer:  1,
  admin:      2,
  gc_manager: 3,
  finance_gc: 4,
  legal_gc:   5,
  director:   6,
  legal:      7,
  finance:    8,
  user:       9,
}

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')
  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }
  const userId = parseInt(bitrixUserId)

  // Собираем все роли пользователя
  const roles: { role: string; companies: string[] }[] = []

  // 1. Разработчик — жёстко в коде
  if (userId === DEVELOPER_ID) {
    roles.push({ role: 'developer', companies: ALL_COMPANIES })
  }

  // 2. Роли ГК из таблицы system_roles
  const { data: systemRole } = await supabase
    .from('system_roles')
    .select('role')
    .eq('bitrix_user_id', userId)
    .single()

  if (systemRole) {
    roles.push({ role: systemRole.role, companies: ALL_COMPANIES })
  }

  // 3. Директор компании из approval_settings
  const { data: directorSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .eq('stage', 'director')
    .eq('is_active', true)

  if (directorSettings && directorSettings.length > 0) {
    const companies = directorSettings
      .map((s: { company_prefix: string | null }) => s.company_prefix)
      .filter(Boolean) as string[]
    if (companies.length > 0) {
      roles.push({ role: 'director', companies })
    }
  }

  // 4. Юрист компании из approval_settings
  const { data: legalSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .eq('stage', 'legal')
    .eq('is_active', true)

  if (legalSettings && legalSettings.length > 0) {
    const companies = legalSettings
      .map((s: { company_prefix: string | null }) => s.company_prefix)
      .filter(Boolean) as string[]
    if (companies.length > 0) {
      roles.push({ role: 'legal', companies })
    }
  }

  // 5. Финансист компании из approval_settings
  const { data: financeSettings } = await supabase
    .from('approval_settings')
    .select('company_prefix')
    .eq('bitrix_user_id', userId)
    .in('stage', ['finance', 'accounting'])
    .eq('is_active', true)

  if (financeSettings && financeSettings.length > 0) {
    const companies = [...new Set(
      financeSettings
        .map((s: { company_prefix: string | null }) => s.company_prefix)
        .filter(Boolean) as string[]
    )]
    if (companies.length > 0) {
      roles.push({ role: 'finance', companies })
    }
  }

  // Если нет ни одной роли — обычный пользователь
  if (roles.length === 0) {
    return NextResponse.json({ role: 'user', companies: [] })
  }

  // Применяем наивысшую роль
  roles.sort((a, b) => (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99))
  const best = roles[0]

  return NextResponse.json({
    role: best.role,
    companies: best.companies,
  })
}