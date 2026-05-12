import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { user_name, bitrix_user_id, department, role, stage, added_by_name, contract_id } = body

    if (!user_name || !role || !stage) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Проверяем что сессия активна
    const { data: session } = await supabase
      .from('approval_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single()

    if (!session || session.status !== 'active') {
      return NextResponse.json({ error: 'Сессия согласования не активна' }, { status: 400 })
    }

    // Добавляем участника
    const { error: insertError } = await supabase
      .from('approval_participants')
      .insert({
        session_id: sessionId,
        user_name,
        bitrix_user_id: bitrix_user_id ?? null,
        department: department ?? null,
        role,
        stage,
        status: 'pending',
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Сообщение в чат
    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: `➕ ${added_by_name} добавил участника: ${user_name} (${role === 'required' ? 'Обязательный' : 'Для информирования'})`,
        author_name: 'Система',
        is_ai: false,
      })

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Добавлен участник согласования',
        details: `${user_name} — ${role === 'required' ? 'обязательный' : 'для информирования'}`,
        user_name: added_by_name ?? 'Система',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const body = await request.json()
    const { participant_id, admin_name, admin_bitrix_id, contract_id } = body

    if (!participant_id) {
      return NextResponse.json({ error: 'participant_id обязателен' }, { status: 400 })
    }

    const ADMIN_IDS = [30, 1148]
    if (!ADMIN_IDS.includes(parseInt(admin_bitrix_id))) {
      return NextResponse.json({ error: 'Только администратор может удалять участников' }, { status: 403 })
    }

    // Получаем участника
    const { data: participant } = await supabase
      .from('approval_participants')
      .select('user_name, role')
      .eq('id', participant_id)
      .single()

    if (!participant) {
      return NextResponse.json({ error: 'Участник не найден' }, { status: 404 })
    }

    // Удаляем участника
    const { error } = await supabase
      .from('approval_participants')
      .delete()
      .eq('id', participant_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Сообщение в чат
    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: `❌ ${admin_name} удалил участника: ${participant.user_name} (${participant.role === 'required' ? 'Обязательный' : 'Для информирования'})`,
        author_name: 'Система',
        is_ai: false,
      })

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Удалён участник согласования',
        details: `${participant.user_name} — ${participant.role === 'required' ? 'обязательный' : 'для информирования'}`,
        user_name: admin_name ?? 'Система',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}