import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

// Генеральные директора по компаниям
const DIRECTORS: Record<number, string[]> = {
  1: ['ТХ'],
  592: ['НПП'],
  6: ['СПТ', 'ОС'],
  954: ['Э-К'],
}

// Юристы по компаниям
const LEGAL_IDS: Record<number, string[]> = {
  504: ['ТХ', 'НПП'],
  246: ['ТХ', 'НПП', 'ОС', 'СПТ'],
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

  // Обычный сотрудник
  return NextResponse.json({
    role: 'user',
    companies: [],
  })
}