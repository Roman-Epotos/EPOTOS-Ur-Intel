import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix')

  let query = supabase
    .from('company_requisites')
    .select('*')
    .order('company_prefix')

  if (prefix) query = query.eq('company_prefix', prefix)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ requisites: data ?? [] })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { admin_bitrix_id, id, ...requisites } = body

    if (!ADMIN_IDS.includes(admin_bitrix_id)) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    // Проверяем есть ли уже запись для этой компании
    const { data: existing } = await supabase
      .from('company_requisites')
      .select('id')
      .eq('company_prefix', requisites.company_prefix)
      .single()

    let dbError
    if (existing) {
      const { error: updateError } = await supabase
        .from('company_requisites')
        .update(requisites)
        .eq('company_prefix', requisites.company_prefix)
      dbError = updateError
    } else {
      const { error: insertError } = await supabase
        .from('company_requisites')
        .insert(requisites)
      dbError = insertError
    }

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}