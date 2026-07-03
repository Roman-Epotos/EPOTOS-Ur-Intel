import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]
const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' }
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params
    const { participant_id, reason, user_bitrix_id, user_name, contract_id } = await request.json()

    if (!participant_id || !reason?.trim()) {
      return NextResponse.json({ error: 'participant_id и причина обязательны' }, { status: 400, headers: CORS })
    }

    const isAdmin = ADMIN_IDS.includes(parseInt(user_bitrix_id))

    // Получаем участника
    const { data: participant, error: pErr } = await supabase
      .from('approval_participants')
      .select('id, status, role, user_name, bitrix_user_id, stage')
      .eq('id', participant_id)
      .single()

    if (pErr || !participant) {
      return NextResponse.json({ error: 'Участник не найден' }, { status: 404, headers: CORS })
    }

    // Проверяем права
    const isOwnVote = parseInt(user_bitrix_id) === participant.bitrix_user_id
    if (!isAdmin && !isOwnVote) {
      return NextResponse.json({ error: 'Нет прав для отмены этого голоса' }, { status: 403, headers: CORS })
    }

    // ГД может отменить только если документ ещё не согласован
    if (!isAdmin && isOwnVote) {
      const { data: contractData } = await supabase
        .from('contracts')
        .select('status')
        .eq('id', contract_id)
        .single()

      if (contractData?.status === 'согласован') {
        return NextResponse.json({ error: 'Нельзя отменить согласование — документ уже перешёл в статус «Согласован». Обратитесь к администратору.' }, { status: 403, headers: CORS })
      }
    }

    // Запоминаем, было ли это отклонением — нужно для реактивации сессии
    const wasRejected = participant.status === 'rejected'

    // Отменяем голос — возвращаем в pending
    const { error: updateErr } = await supabase
      .from('approval_participants')
      .update({ status: 'pending', comment: null, decided_at: null })
      .eq('id', participant_id)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400, headers: CORS })
    }

    // Если документ был согласован ИЛИ отклонён — возвращаем в на_согласовании
    const { data: contractData } = await supabase
      .from('contracts')
      .select('status, title, number')
      .eq('id', contract_id)
      .single()

    if (contractData?.status === 'согласован' || wasRejected) {
      await supabase
        .from('contracts')
        .update({ status: 'на_согласовании' })
        .eq('id', contract_id)
    }

    // Если это была отмена отклонения — реактивируем сессию согласования
    if (wasRejected) {
      await supabase
        .from('approval_sessions')
        .update({ status: 'active' })
        .eq('id', sessionId)
    }

    // Сообщение в чат согласования
    const revokeText = isAdmin
      ? `🔄 Администратор ${user_name} отменил согласование участника ${participant.user_name}.\nПричина: ${reason}`
      : `🔄 ${user_name} отменил(а) своё согласование.\nПричина: ${reason}`

    await supabase.from('approval_messages').insert({
      session_id: sessionId,
      author_name: user_name,
      bitrix_user_id: parseInt(user_bitrix_id),
      message: revokeText,
      is_ai: false,
    })

    // Обновляем last_message_at
    await supabase
      .from('contracts')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', contract_id)

    // Лог
    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Согласование отменено',
      details: `${isAdmin ? `Администратор ${user_name} отменил согласование участника ${participant.user_name}` : `${user_name} отменил(а) своё согласование`}. Причина: ${reason}`,
      user_name,
    })

    return NextResponse.json({ success: true, returned_to_pending: true }, { headers: CORS })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}