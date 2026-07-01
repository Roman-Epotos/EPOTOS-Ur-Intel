import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendBitrixNotify, sendBitrixChatMessage } from '@/app/lib/notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET() {
  try {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)

    // Завтра
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    // 3 дня назад
    const threeDaysAgo = new Date(now)
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    const threeDaysAgoStr = threeDaysAgo.toISOString().slice(0, 10)

    // Загружаем активные сессии согласования
    const { data: sessions, error } = await supabase
      .from('approval_sessions')
      .select(`
        id,
        contract_id,
        deadline,
        initiated_by_bitrix_id,
        bitrix_chat_id,
        contracts (
          id, number, title, author_bitrix_id
        ),
        approval_participants (
          bitrix_user_id,
          status
        )
      `)
      .eq('status', 'active')
      .not('deadline', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'Нет активных сессий' })
    }

    const bitrixPortal = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'
    let notified = 0

    for (const session of sessions) {
      const contract = Array.isArray(session.contracts)
        ? session.contracts[0]
        : session.contracts
      if (!contract) continue

      const deadlineStr = session.deadline.slice(0, 10)
      const link = `https://${bitrixPortal}/marketplace/app/248/?contract_id=${contract.id}`
      const docRef = `[URL=${link}]${contract.number} — ${contract.title}[/URL]`

      // Участники, которые ещё не согласовали
      const pendingParticipants = (session.approval_participants ?? [])
        .filter((p: { status: string; bitrix_user_id: number | null }) =>
          p.status === 'pending' && p.bitrix_user_id
        )
        .map((p: { bitrix_user_id: number }) => p.bitrix_user_id)

      // Инициатор + автор документа
      const initiators = [...new Set([
        session.initiated_by_bitrix_id,
        contract.author_bitrix_id,
      ].filter(Boolean) as number[])]

      // Получатели колокольчика = те кто не согласовал + инициатор
      const notifyRecipients = [...new Set([...pendingParticipants, ...initiators])]

      // Список ожидающих для текста сообщения
      const pendingCount = pendingParticipants.length
      const pendingNote = pendingCount > 0
        ? `Ожидают решения: ${pendingCount} участник(ов).`
        : ''

      let notifyType: 'approval_deadline_soon' | 'approval_deadline_reached' | 'approval_deadline_overdue' | null = null
      let chatMessage = ''

      if (deadlineStr === tomorrowStr) {
        // За 1 день до дедлайна
        notifyType = 'approval_deadline_soon'
        chatMessage = `⚠️ Срок согласования истекает завтра!\nДокумент: ${docRef}\n${pendingNote}`
      } else if (deadlineStr === todayStr) {
        // В день дедлайна
        notifyType = 'approval_deadline_reached'
        chatMessage = `🔴 Срок согласования истёк сегодня!\nДокумент: ${docRef}\n${pendingNote}`
      } else if (deadlineStr === threeDaysAgoStr) {
        // Через 3 дня после дедлайна
        notifyType = 'approval_deadline_overdue'
        chatMessage = `🚨 Согласование просрочено на 3 дня. Рекомендуем продлить срок согласования с указанием причины.\nДокумент: ${docRef}\n${pendingNote}`
      }

      if (!notifyType) continue

      // 1. Колокольчик (pending + инициатор)
      if (notifyRecipients.length > 0) {
        await sendBitrixNotify({
          recipients: notifyRecipients,
          type: notifyType,
          document_id: contract.id,
          document_title: contract.title ?? '',
          document_number: contract.number ?? '',
          extra: pendingNote,
        })
      }

      // 2. Сообщение в чат Б24
      if (session.bitrix_chat_id) {
        await sendBitrixChatMessage(session.bitrix_chat_id, chatMessage)
      }

      // 3. Сообщение в ленту новостей Б24 (im.message.add всем участникам)
      const webhookUrl = process.env.BITRIX_WEBHOOK_URL
      if (webhookUrl && notifyRecipients.length > 0) {
        await Promise.all(notifyRecipients.map(async (userId) => {
          try {
            await fetch(`${webhookUrl}im.message.add.json`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                DIALOG_ID: userId,
                MESSAGE: chatMessage,
              }),
            })
          } catch (err) {
            console.error(`approval-reminder message error for user ${userId}:`, err)
          }
        }))
      }

      notified++
    }

    return NextResponse.json({ success: true, notified, sessions_found: sessions.length })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}