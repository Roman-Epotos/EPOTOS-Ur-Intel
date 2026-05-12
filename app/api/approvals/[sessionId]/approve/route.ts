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
    const { participant_id, comment, user_name, contract_id } = body
    const isAcknowledge = body.is_acknowledge === true

    // Обновляем статус участника
    const { error: updateError } = await supabase
      .from('approval_participants')
      .update({
        status: isAcknowledge ? 'acknowledged' : 'approved',
        comment: comment || null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', participant_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: isAcknowledge ? 'Ознакомлен' : 'Согласовано',
        details: isAcknowledge
          ? 'Участник ознакомился(ась) с документом'
          : comment ? `Комментарий: ${comment}` : 'Без комментария',
        user_name: user_name ?? 'Система',
      })

    // Записываем сообщение в чат
    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: isAcknowledge
          ? `👁 ${user_name} ознакомлен с документом`
          : `✅ ${user_name} согласовал(а) документ${comment ? `. Комментарий: «${comment}»` : ''}`,
        author_name: 'Система',
        is_ai: false,
      })

    // Проверяем все ли обязательные согласовали
    const { data: participants } = await supabase
      .from('approval_participants')
      .select('status, role')
      .eq('session_id', sessionId)

    const required = participants?.filter(p => p.role === 'required') ?? []
    const allDone = required.every(p =>
      p.status === 'approved' || p.status === 'disabled' || p.status === 'completed_by_initiator'
    )

    if (allDone && required.length > 0) {
      await supabase
        .from('contracts')
        .update({ status: 'согласован' })
        .eq('id', contract_id)

      await supabase
        .from('approval_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      await supabase
        .from('contract_logs')
        .insert({
          contract_id,
          action: 'Согласование завершено',
          details: 'Все обязательные участники согласовали документ. Договор готов к подписанию.',
          user_name: 'Система',
        })
    }

    return NextResponse.json({ success: true, all_approved: allDone })
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
    const { reason, user_name, contract_id } = body

    if (!reason?.trim()) {
      return NextResponse.json({ error: 'Укажите причину прерывания' }, { status: 400 })
    }

    const { error: sessionError } = await supabase
      .from('approval_sessions')
      .update({ status: 'cancelled', cancel_reason: reason })
      .eq('id', sessionId)

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 400 })
    }

    await supabase
      .from('contracts')
      .update({ status: 'архив' })
      .eq('id', contract_id)

    await supabase
      .from('approval_messages')
      .insert({
        session_id: sessionId,
        message: `🚫 Согласование прервано инициатором. Причина: «${reason}»`,
        author_name: 'Система',
        is_ai: false,
      })

    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Согласование прервано',
        details: `Причина: ${reason}`,
        user_name: user_name ?? 'Система',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}