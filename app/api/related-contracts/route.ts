import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CAN_LINK_ROLES = ['admin', 'developer', 'gc_manager', 'legal_gc', 'legal']

// GET — получить связанные документы (родитель + дочерние)
export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id')
  if (!contractId) return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })

  try {
    // Получаем текущий документ
    const { data: contract } = await supabase
      .from('contracts')
      .select('id, number, title, type, status, created_at, counterparty, parent_contract_id, parent_contract_external, is_child')
      .eq('id', contractId)
      .single()

    if (!contract) return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })

    // Получаем родительский документ (если есть)
    let parent = null
    if (contract.parent_contract_id) {
      const { data } = await supabase
        .from('contracts')
        .select('id, number, title, type, status, created_at, counterparty')
        .eq('id', contract.parent_contract_id)
        .single()
      parent = data
    }

    // Получаем дочерние документы
    const { data: children } = await supabase
      .from('contracts')
      .select('id, number, title, type, status, created_at, counterparty')
      .eq('parent_contract_id', contractId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      parent: parent ?? null,
      children: children ?? [],
      parent_contract_external: contract.parent_contract_external ?? null,
      is_child: contract.is_child ?? false,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST — привязать документ к родителю
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, parent_contract_id, parent_contract_external, is_child } = body

    if (!contract_id) return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })

    // Считаем child_number
    let childNumber = null
    if (parent_contract_id) {
      const { data: siblings } = await supabase
        .from('contracts')
        .select('child_number')
        .eq('parent_contract_id', parent_contract_id)
        .order('child_number', { ascending: false })
        .limit(1)

      childNumber = siblings && siblings.length > 0 ? (siblings[0].child_number ?? 0) + 1 : 1
    }

    const { error } = await supabase
      .from('contracts')
      .update({
        parent_contract_id: parent_contract_id ?? null,
        parent_contract_external: parent_contract_external ?? null,
        is_child: is_child ?? true,
        child_number: childNumber,
      })
      .eq('id', contract_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Лог
    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Документ привязан к родительскому',
      details: parent_contract_id
        ? `Привязан к документу ID: ${parent_contract_id}`
        : `Привязан к внешнему документу: ${parent_contract_external}`,
      user_name: body.user_name ?? 'Пользователь',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE — отвязать документ от родителя
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { contract_id, user_name } = body

    if (!contract_id) return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })

    const { error } = await supabase
      .from('contracts')
      .update({
        parent_contract_id: null,
        parent_contract_external: null,
        is_child: false,
        child_number: null,
      })
      .eq('id', contract_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Документ отвязан от родительского',
      details: 'Связь с родительским документом удалена',
      user_name: user_name ?? 'Пользователь',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}