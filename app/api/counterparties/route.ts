import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// GET — список контрагентов или один по id
export async function GET(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    const inn = request.nextUrl.searchParams.get('inn')
    const search = request.nextUrl.searchParams.get('search')

    if (id) {
      const { data, error } = await supabase
        .from('counterparties')
        .select('*, contracts(id, number, title, status, created_at)')
        .eq('id', id)
        .single()

      // Дополнительно загружаем документы по текстовому совпадению если counterparty_id не заполнен
      if (data && data.contracts?.length === 0) {
        const searchName = data.short_name ?? data.full_name
        const { data: extraContracts } = await supabase
          .from('contracts')
          .select('id, number, title, status, created_at')
          .ilike('counterparty', `%${searchName}%`)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
        if (extraContracts?.length) {
          data.contracts = extraContracts
        }
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ counterparty: data })
    }

    if (inn) {
      const kpp = request.nextUrl.searchParams.get('kpp')
      let query = supabase
        .from('counterparties')
        .select('*')
        .eq('inn', inn)
      if (kpp) query = query.eq('kpp', kpp)
      const { data, error } = await query.single()
      if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ counterparty: data ?? null })
    }

    let query = supabase
      .from('counterparties')
      .select('id, inn, kpp, ogrn, short_name, full_name, status, risk_level, director_name, director_title, phone, email, legal_address, signatory_name, poa_number, poa_date, created_at, is_foreign, country, registration_number')
      .order('full_name', { ascending: true })

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,short_name.ilike.%${search}%,inn.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ counterparties: data ?? [] })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

// POST — создать или обновить контрагента
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...fields } = body

    fields.updated_at = new Date().toISOString()

    if (id) {
      const { data, error } = await supabase
        .from('counterparties')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, counterparty: data })
    }

    // Защита от дублей иностранных контрагентов
    if (fields.is_foreign && fields.full_name) {
      const { data: existing } = await supabase
        .from('counterparties')
        .select('id, full_name')
        .eq('is_foreign', true)
        .ilike('full_name', fields.full_name.trim())
        .maybeSingle()
      if (existing) {
        return NextResponse.json({ error: 'Иностранный контрагент с таким названием уже существует в реестре.' }, { status: 400 })
      }
    }

    const { data, error } = await supabase
      .from('counterparties')
      .insert(fields)
      .select()
      .single()
    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('counterparties_inn_kpp_unique')) {
        return NextResponse.json({ error: 'Контрагент с таким ИНН уже добавлен в базу. Найдите его в реестре контрагентов.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true, counterparty: data })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

// DELETE — удалить контрагента
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id обязателен' }, { status: 400 })

    const { error } = await supabase
      .from('counterparties')
      .delete()
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}