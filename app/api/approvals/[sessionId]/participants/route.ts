import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendBitrixNotify, addUserToBitrixChat, sendBitrixChatMessage } from '@/app/lib/notify'

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
      .select('id, status, initiated_by_bitrix_id')
      .eq('id', sessionId)
      .single()

    if (!session || (session.status !== 'active' && session.status !== 'completed')) {
      return NextResponse.json({ error: 'Сессия согласования не активна' }, { status: 400 })
    }

    // Запрещаем добавлять инициатора документа как участника согласования
    let authorBitrixId: number | null = null
    if (contract_id) {
      const { data: contractData } = await supabase
        .from('contracts')
        .select('author_bitrix_id')
        .eq('id', contract_id)
        .single()
      authorBitrixId = contractData?.author_bitrix_id ?? null
    }
    if (bitrix_user_id && (bitrix_user_id === session.initiated_by_bitrix_id || bitrix_user_id === authorBitrixId)) {
      return NextResponse.json({ error: 'Нельзя добавить инициатора документа как участника согласования' }, { status: 400 })
    }

    // Запрещаем добавлять уже существующего участника
    if (bitrix_user_id) {
      const { data: existing } = await supabase
        .from('approval_participants')
        .select('id')
        .eq('session_id', sessionId)
        .eq('bitrix_user_id', bitrix_user_id)
        .limit(1)
      if (existing && existing.length > 0) {
        return NextResponse.json({ error: 'Этот сотрудник уже добавлен в согласование' }, { status: 400 })
      }
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
        status: role === 'observer' ? 'observing' : 'pending',
      })

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    const roleLabel = role === 'observer' ? 'Наблюдатель' : role === 'optional' ? 'Для информирования' : 'Обязательный'

    // Сообщение в чат
    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: `➕ ${added_by_name} добавил участника: ${user_name} (${roleLabel})`,
        author_name: 'Система',
        is_ai: false,
      })

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Добавлен участник согласования',
        details: `${user_name} — ${roleLabel.toLowerCase()}`,
        user_name: added_by_name ?? 'Система',
      })

    // Уведомляем добавленного участника (наблюдателю push «требуется решение» не нужен)
    if (bitrix_user_id && contract_id && role !== 'observer') {
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number')
        .eq('id', contract_id)
        .single()

      if (contractData) {
        await sendBitrixNotify({
          recipients: [bitrix_user_id],
          type: 'approval_required',
          document_id: contract_id,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
        })
      }
    }

    // Добавляем нового участника в чат Битрикс24
    if (bitrix_user_id) {
      const { data: sessionWithChat } = await supabase
        .from('approval_sessions')
        .select('bitrix_chat_id')
        .eq('id', sessionId)
        .single()

      if (sessionWithChat?.bitrix_chat_id) {
        await addUserToBitrixChat(sessionWithChat.bitrix_chat_id, bitrix_user_id)
        await sendBitrixChatMessage(
          sessionWithChat.bitrix_chat_id,
          `➕ Добавлен новый участник согласования: ${user_name}`
        )
      }
    }

    // Если сессия завершена — возвращаем статусы на активные (наблюдатель согласование НЕ переоткрывает)
    if (session.status === 'completed' && role !== 'observer') {
      await supabase
        .from('approval_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId)

      await supabase
        .from('contracts')
        .update({ status: 'на_согласовании' })
        .eq('id', contract_id)

      await supabase
        .from('contract_logs')
        .insert({
          contract_id,
          action: 'Согласование возобновлено',
          details: `Добавлен новый участник: ${user_name}. Документ возвращён на согласование.`,
          user_name: added_by_name ?? 'Система',
        })
    }

    // Добавление участника НИКОГДА не должно само завершать согласование —
    // это может произойти только при реальном голосовании (route approve).
    // Раньше здесь был ошибочно скопирован блок из обработчика удаления
    // участника — он немедленно закрывал документ обратно, если новый
    // участник был не обязательным (его статус не входит в проверку по
    // обязательным, а старые обязательные уже были согласованы).

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
      .select('user_name, role, bitrix_user_id')
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

    // Уведомляем исключённого участника
    if (participant.bitrix_user_id && contract_id) {
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number')
        .eq('id', contract_id)
        .single()

      if (contractData) {
        await sendBitrixNotify({
          recipients: [participant.bitrix_user_id],
          type: 'document_approved',
          document_id: contract_id,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
          extra: `ℹ️ Вы исключены из списка согласующих по документу ${contractData.number}. Инициатор: ${admin_name}`,
        })
      }
    }

    const deletedRoleLabel = participant.role === 'observer' ? 'Наблюдатель' : participant.role === 'optional' ? 'Для информирования' : 'Обязательный'

    // Сообщение в чат
    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: `❌ ${admin_name} удалил участника: ${participant.user_name} (${deletedRoleLabel})`,
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

    // Добавление участника НИКОГДА не должно само завершать согласование —
    // это может произойти только при реальном голосовании (route approve).
    // Раньше здесь был ошибочно скопирован блок из обработчика удаления
    // участника — он немедленно закрывал документ обратно, если новый
    // участник был не обязательным (его статус не входит в проверку по
    // обязательным, а старые обязательные уже были согласованы).

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}