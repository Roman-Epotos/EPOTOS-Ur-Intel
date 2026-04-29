import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Получить список согласующих по этапу и компании
export async function GET(request: NextRequest) {
  const stage = request.nextUrl.searchParams.get('stage')
  const company = request.nextUrl.searchParams.get('company')

  try {
    let query = supabase
      .from('approval_settings')
      .select('*')
      .eq('is_active', true)
      .order('user_name')

    if (stage) {
      query = query.eq('stage', stage)
    }

    if (company) {
      query = query.or(`company_prefix.eq.${company},company_prefix.is.null`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ participants: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Добавить согласующего (только для админов)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stage, company_prefix, bitrix_user_id, user_name, department, admin_bitrix_id } = body

    // Проверяем права администратора
    const { data: admin } = await supabase
      .from('system_admins')
      .select('id')
      .eq('bitrix_user_id', admin_bitrix_id)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    const { error } = await supabase
      .from('approval_settings')
      .insert({ stage, company_prefix, bitrix_user_id, user_name, department })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Удалить согласующего (только для админов)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, admin_bitrix_id } = body

    const { data: admin } = await supabase
      .from('system_admins')
      .select('id')
      .eq('bitrix_user_id', admin_bitrix_id)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    const { error } = await supabase
      .from('approval_settings')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}