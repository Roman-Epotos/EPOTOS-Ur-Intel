// Вспомогательная функция для отправки уведомлений Битрикс24
// Используется из других API роутов

const baseUrl = 'https://epotos-ur-intel.vercel.app'

export type NotifyType =
  | 'document_created'
  | 'sent_for_approval'
  | 'approval_required'
  | 'document_approved'
  | 'document_rejected'
  | 'documents_uploaded'
  | 'checklist_generated'
  | 'checklist_deadline'

interface NotifyOptions {
  recipients: number[]        // Битрикс24 ID получателей
  type: NotifyType
  document_id: string
  document_title: string
  document_number: string
  extra?: string
}

function buildMessage(type: NotifyType, documentTitle: string, documentNumber: string, documentId: string, extra?: string): string {
  const bitrixPortal = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'
  const link = `https://${bitrixPortal}/marketplace/app/248/?contract_id=${documentId}`
  const doc = `${documentNumber} — ${documentTitle} [${link}]`

  const messages: Record<NotifyType, string> = {
    document_created:    `📄 Создан новый документ: ${doc}`,
    sent_for_approval:   `📨 Документ отправлен на согласование: ${doc}`,
    approval_required:   `⚡ Требуется ваше согласование: ${doc}`,
    document_approved:   `✅ Документ согласован: ${doc}`,
    document_rejected:   `❌ Документ отклонён: ${doc}${extra ? `\nПричина: ${extra}` : ''}`,
    documents_uploaded:  `📎 Загружены подписанные документы: ${doc}`,
    checklist_generated: `📋 Сгенерирован чек-лист исполнения: ${doc}`,
    checklist_deadline:  `⏰ Дедлайн пункта чек-листа: ${extra ?? ''}\nДокумент: ${doc}`,
  }
  return messages[type] ?? `Уведомление по документу: ${doc}`
}

export async function sendBitrixNotify(opts: NotifyOptions): Promise<void> {
  if (!opts.recipients || opts.recipients.length === 0) return

  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('BITRIX_WEBHOOK_URL не задан')
    return
  }

  const message = buildMessage(opts.type, opts.document_title, opts.document_number, opts.document_id, opts.extra)

  await Promise.all(
    opts.recipients.map(async (userId) => {
      try {
        const url = `${webhookUrl}im.notify.system.add.json`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            USER_ID: userId,
            MESSAGE: message,
          }),
        })
        const data = await res.json()
        if (data.error) {
          console.error(`Bitrix notify error for user ${userId}:`, data.error)
        }
      } catch (err) {
        console.error(`sendBitrixNotify error for user ${userId}:`, err)
      }
    })
  )
}