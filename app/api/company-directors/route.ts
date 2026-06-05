import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_prefix = searchParams.get('company_prefix')

    let query = supabase
      .from('company_directors')
      .select('*')
      .order('company_prefix')
      .order('is_default', { ascending: false })

    if (company_prefix) {
      query = query.eq('company_prefix', company_prefix)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ directors: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { company_prefix, bitrix_user_id, user_name, position, is_default } = body

    if (!company_prefix || !bitrix_user_id || !user_name) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('company_directors')
      .insert({ company_prefix, bitrix_user_id, user_name, position: position ?? 'Генеральный директор', is_default: is_default ?? false })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, director: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID не указан' }, { status: 400 })

    const { error } = await supabase
      .from('company_directors')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}