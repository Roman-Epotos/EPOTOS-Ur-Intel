import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Запуск согласования
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contract_id,
      participants,
      deadline,
      initiated_by_name,
      initiated_by_bitrix_id,
    } = body

    if (!contract_id || !participants || !deadline) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Создаём сессию согласования
    const { data: session, error: sessionError } = await supabase
      .from('approval_sessions')
      .insert({
        contract_id,
        deadline,
        initiated_by_name: initiated_by_name ?? 'Система',
        initiated_by_bitrix_id: initiated_by_bitrix_id ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 400 })
    }

    // Добавляем участников
    const participantsToInsert = participants.map((p: {
      user_name: string
      bitrix_user_id?: number
      department?: string
      role: string
      stage: string
    }) => ({
      session_id: session.id,
      user_name: p.user_name,
      bitrix_user_id: p.bitrix_user_id ?? null,
      department: p.department ?? null,
      role: p.role,
      stage: p.stage,
      status: 'pending',
    }))

    const { error: participantsError } = await supabase
      .from('approval_participants')
      .insert(participantsToInsert)

    if (participantsError) {
      return NextResponse.json({ error: participantsError.message }, { status: 400 })
    }

    // Обновляем статус договора
    await supabase
      .from('contracts')
      .update({ status: 'на_согласовании' })
      .eq('id', contract_id)

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Согласование запущено',
        details: `Запущено согласование. Участников: ${participants.length}. Дедлайн: ${deadline}.`,
        user_name: initiated_by_name ?? 'Система',
      })

    return NextResponse.json({ success: true, session_id: session.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Получить сессию согласования по договору
export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id')

  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  const { data: session, error } = await supabase
    .from('approval_sessions')
    .select(`
      *,
      approval_participants (*),
      approval_messages (*)
    `)
    .eq('contract_id', contractId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ session: session ?? null })
}