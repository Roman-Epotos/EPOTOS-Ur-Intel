import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendBitrixNotify, sendBitrixMessage, sendBitrixChatMessage } from '@/app/lib/notify'

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
    const isRejected = body.is_rejected === true

    // Обновляем статус участника
    const { error: updateError } = await supabase
      .from('approval_participants')
      .update({
        status: isAcknowledge ? 'acknowledged' : isRejected ? 'rejected' : 'approved',
        comment: comment || null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', participant_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    // При отклонении — меняем статус контракта и сессии
    if (isRejected) {
      const { data: sessionData } = await supabase
        .from('approval_sessions')
        .select('contract_id')
        .eq('id', sessionId)
        .single()

      const actualContractId = sessionData?.contract_id ?? contract_id

      await supabase.from('contracts').update({ status: 'отклонён' }).eq('id', actualContractId)
      await supabase.from('approval_sessions').update({ status: 'cancelled' }).eq('id', sessionId)

      // Уведомляем автора
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number, author_bitrix_id')
        .eq('id', actualContractId)
        .single()

      if (contractData) {
        const { data: participantsData } = await supabase
          .from('approval_participants')
          .select('bitrix_user_id')
          .eq('session_id', sessionId)
          .not('bitrix_user_id', 'is', null)

        const participantIds = participantsData?.map(p => p.bitrix_user_id).filter(Boolean) ?? []
        const rejectedRecipients = [...new Set([
          ...(contractData.author_bitrix_id ? [contractData.author_bitrix_id] : []),
          ...participantIds,
        ])]

        await sendBitrixNotify({
          recipients: rejectedRecipients,
          type: 'document_rejected',
          document_id: actualContractId,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
          extra: comment ?? undefined,
        })
        

        // Сообщение в групповой чат Битрикс24
        const { data: sessionInfo } = await supabase
          .from('approval_sessions')
          .select('bitrix_chat_id')
          .eq('id', sessionId)
          .single()
        if (sessionInfo?.bitrix_chat_id) {
          const bitrixPortal = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'
          const link = `https://${bitrixPortal}/marketplace/app/252/?contract_id=${actualContractId}`
          await sendBitrixChatMessage(
            sessionInfo.bitrix_chat_id,
            `❌ Документ отклонён: ${contractData.number} — ${contractData.title} [${link}]${comment ? `\nПричина: ${comment}` : ''}`
          )
        }
      }
    }

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: isAcknowledge ? 'Ознакомлен' : isRejected ? 'Отклонено' : 'Согласовано',
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
          : isRejected
            ? `❌ ${user_name} отклонил(а) документ${comment ? `. Причина: «${comment}»` : ''}`
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
      // Получаем contract_id из сессии напрямую для надёжности
      const { data: sessionData } = await supabase
        .from('approval_sessions')
        .select('contract_id')
        .eq('id', sessionId)
        .single()

      const actualContractId = sessionData?.contract_id ?? contract_id

      const { error: contractUpdateError } = await supabase
        .from('contracts')
        .update({ status: 'согласован' })
        .eq('id', actualContractId)

      if (contractUpdateError) {
        console.error('Contract status update error:', contractUpdateError)
      }

      await supabase
        .from('approval_sessions')
        .update({ status: 'completed' })
        .eq('id', sessionId)

      await supabase
        .from('contract_logs')
        .insert({
          contract_id: actualContractId,
          action: 'Согласование завершено',
          details: 'Все обязательные участники согласовали документ. Договор готов к подписанию.',
          user_name: 'Система',
        })

      // Уведомляем автора + всех участников о полном согласовании
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number, author_bitrix_id')
        .eq('id', actualContractId)
        .single()

      if (contractData) {
        const { data: participantsData } = await supabase
          .from('approval_participants')
          .select('bitrix_user_id')
          .eq('session_id', sessionId)
          .not('bitrix_user_id', 'is', null)

        const participantIds = participantsData?.map(p => p.bitrix_user_id).filter(Boolean) ?? []
        const gcManagerIds = [1, 246, 504]

        const recipients = [...new Set([
          ...(contractData.author_bitrix_id ? [contractData.author_bitrix_id] : []),
          ...gcManagerIds,
          ...participantIds,
        ])]

        await sendBitrixNotify({
          recipients,
          type: 'document_approved',
          document_id: actualContractId,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
        })
        

        // Сообщение в групповой чат Битрикс24
        const { data: approvedSessionInfo } = await supabase
          .from('approval_sessions')
          .select('bitrix_chat_id')
          .eq('id', sessionId)
          .single()
        if (approvedSessionInfo?.bitrix_chat_id) {
          const bitrixPortal = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'
          const link = `https://${bitrixPortal}/marketplace/app/252/?contract_id=${actualContractId}`
          await sendBitrixChatMessage(
            approvedSessionInfo.bitrix_chat_id,
            `✅ Документ согласован: ${contractData.number} — ${contractData.title} [${link}]`
          )
        }
      }
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