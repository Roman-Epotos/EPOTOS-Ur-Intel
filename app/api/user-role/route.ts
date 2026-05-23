import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]
const GC_MANAGER_IDS = [1, 246, 504]
const FINANCE_GC_IDS = [10, 154]

const DIRECTORS: Record<number, string[]> = {
  592: ['НПП'],
  6: ['СПТ', 'ОС'],
  954: ['Э-К'],
}

const LEGAL_IDS: Record<number, string[]> = {
  782: ['Э-К'],
}

export async function GET(request: NextRequest) {
  const bitrixUserId = request.nextUrl.searchParams.get('bitrix_user_id')

  if (!bitrixUserId) {
    return NextResponse.json({ error: 'bitrix_user_id обязателен' }, { status: 400 })
  }

  const userId = parseInt(bitrixUserId)

  // Проверяем администратора
  if (ADMIN_IDS.includes(userId)) {
    return NextResponse.json({
      role: 'admin',
      companies: ['ТХ', 'НПП', 'СПТ', 'ОС', 'Э-К'],
    })
  }

  // Проверяем менеджеров ГК
  if (GC_MANAGER_IDS.includes(userId)) {
    return NextResponse.json({
      role: 'gc_manager',
      companies: ['ТХ', 'НПП', 'СПТ', 'ОС', 'Э-К'],
    })
  }

  // Проверяем ГД
  if (DIRECTORS[userId]) {
    return NextResponse.json({
      role: 'director',
      companies: DIRECTORS[userId],
    })
  }

  // Проверяем юристов
  if (LEGAL_IDS[userId]) {
    return NextResponse.json({
      role: 'legal',
      companies: LEGAL_IDS[userId],
    })
  }

  // Финансисты ГК — все компании
  if (FINANCE_GC_IDS.includes(userId)) {
    return NextResponse.json({
      role: 'finance_gc',
      companies: ['ТХ', 'НПП', 'СПТ', 'ОС', 'Э-К'],
    })
  }

  // Финансисты компаний — из approval_settings (finance + accounting)
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
    return NextResponse.json({
      role: 'finance',
      companies,
    })
  }

  // Обычный сотрудник
  return NextResponse.json({
    role: 'user',
    companies: [],
  })
}