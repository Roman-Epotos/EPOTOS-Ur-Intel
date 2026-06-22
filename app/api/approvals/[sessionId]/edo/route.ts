import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
const baseNotifyUrl = 'https://epotos-ur-intel.vercel.app'

async function sendEdoNotify(recipients: number[], type: string, document_id: string, document_number: string, extra_message: string) {
  try {
    await fetch(`${baseNotifyUrl}/api/bitrix-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipients, type: 'document_approved', document_id, document_title: extra_message, document_number }),
    })
  } catch { /* игнорируем ошибки уведомлений */ }
}

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
    const { action, bitrix_user_id, user_name, contract_id, contract_number } = body

    // Получаем сессию
    const { data: session } = await supabase
      .from('approval_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (!session) return NextResponse.json({ error: 'Сессия не найдена' }, { status: 404 })

    // --- Запрос разрешения у ГД ---
    if (action === 'request') {
      const { edo_director_bitrix_id, edo_director_name } = body

      const { error } = await supabase
        .from('approval_sessions')
        .update({
          edo_requested: true,
          edo_requested_by_id: bitrix_user_id,
          edo_requested_by_name: user_name,
          edo_requested_at: new Date().toISOString(),
          edo_director_bitrix_id,
          edo_director_name,
        })
        .eq('id', sessionId)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Сообщение в чат
      await supabase.from('approval_messages').insert({
        session_id: sessionId,
        message: `📧 ${user_name} запросил разрешение на подписание через ЭДО у ${edo_director_name}`,
        author_name: 'Система',
        is_ai: false,
      })

      // Уведомление ГД
      await sendEdoNotify([edo_director_bitrix_id], 'edo_request', contract_id, contract_number ?? '', `${user_name} запрашивает разрешение на подписание документа ${contract_number} через ЭДО. Откройте карточку документа.`)

      // Лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Запрос на ЭДО',
        details: `${user_name} запросил разрешение на ЭДО у ${edo_director_name}`,
        user_name,
      })

      return NextResponse.json({ success: true })
    }

    // --- Решение ГД ---
    if (action === 'director_decision') {
      const { decision } = body

      const { error } = await supabase
        .from('approval_sessions')
        .update({
          edo_director_decision: decision,
          edo_director_decided_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      const decisionText = decision === 'approved' ? 'разрешил подписание через ЭДО' : 'отклонил подписание через ЭДО'

      // Сообщение в чат
      await supabase.from('approval_messages').insert({
        session_id: sessionId,
        message: `${decision === 'approved' ? '✅' : '❌'} ${user_name} ${decisionText}`,
        author_name: 'Система',
        is_ai: false,
      })

      // Персональное уведомление инициатору запроса
      if (session.edo_requested_by_id) {
        const approvedText = decision === 'approved'
          ? `✅ ГД разрешил подписание через ЭДО\nДокумент: ${contract_number}\nРешение принято: ${user_name}`
          : `❌ ГД отказал в подписании через ЭДО\nДокумент: ${contract_number}\nРешение принято: ${user_name}`
        await sendEdoNotify(
          [session.edo_requested_by_id],
          'edo_decision',
          contract_id,
          contract_number ?? '',
          approvedText
        )
      }

      // Уведомление остальным участникам
      const { data: participants } = await supabase
        .from('approval_participants')
        .select('bitrix_user_id')
        .eq('session_id', sessionId)
        .not('bitrix_user_id', 'is', null)

      const recipientIds = (participants ?? [])
        .map(p => p.bitrix_user_id)
        .filter((id): id is number => id !== null && id !== session.edo_requested_by_id)

      if (session.initiated_by_bitrix_id && session.initiated_by_bitrix_id !== session.edo_requested_by_id) {
        recipientIds.push(session.initiated_by_bitrix_id)
      }

      const uniqueIds = [...new Set(recipientIds)]
      if (uniqueIds.length > 0) {
        await sendEdoNotify(
          uniqueIds,
          'edo_decision',
          contract_id,
          contract_number ?? '',
          `${decision === 'approved' ? '✅' : '❌'} ${user_name} ${decisionText} по документу ${contract_number}`
        )
      }

      // Лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: decision === 'approved' ? 'ЭДО разрешено' : 'ЭДО отклонено',
        details: `${user_name} ${decisionText}`,
        user_name,
      })

      return NextResponse.json({ success: true })
    }

    // --- Выбор метода подписания ---
    if (action === 'set_method') {
      const { method, edo_specialist_bitrix_id, edo_specialist_name } = body

      const updates: Record<string, unknown> = {
        signing_method: method,
        signing_method_set_by_id: bitrix_user_id,
        signing_method_set_by_name: user_name,
        signing_method_set_at: new Date().toISOString(),
      }

      if (method === 'edo') {
        updates.edo_specialist_bitrix_id = edo_specialist_bitrix_id
        updates.edo_specialist_name = edo_specialist_name
        updates.edo_task_sent_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('approval_sessions')
        .update(updates)
        .eq('id', sessionId)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      // Меняем статус договора на «на_подписи_в_эдо» если выбрано ЭДО
      if (method === 'edo') {
        await supabase
          .from('contracts')
          .update({ status: 'на_подписи_в_эдо' })
          .eq('id', contract_id)
      }

      const methodText = method === 'edo'
        ? `выбрал подписание через ЭДО (специалист: ${edo_specialist_name})`
        : 'выбрал простую подпись'

      // Сообщение в чат
      await supabase.from('approval_messages').insert({
        session_id: sessionId,
        message: `🖊 ${user_name} ${methodText}`,
        author_name: 'Система',
        is_ai: false,
      })

      // Уведомление специалисту ЭДО
      if (method === 'edo' && edo_specialist_bitrix_id) {
        await sendEdoNotify([edo_specialist_bitrix_id], 'edo_task', contract_id, contract_number ?? '', `Вам направлен документ ${contract_number} для подписания через ЭДО. Подписание согласовано генеральным директором.`)
      }

      // Лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: method === 'edo' ? 'Выбрано ЭДО' : 'Выбрана простая подпись',
        details: `${user_name} ${methodText}`,
        user_name,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}