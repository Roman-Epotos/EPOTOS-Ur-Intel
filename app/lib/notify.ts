export type NotifyType =
  | 'document_created'
  | 'sent_for_approval'
  | 'approval_required'
  | 'document_approved'
  | 'document_rejected'
  | 'documents_uploaded'
  | 'checklist_generated'
  | 'checklist_deadline'
  | 'edo_reminder'

interface NotifyOptions {
  recipients: number[]
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
    edo_reminder:        `📋 Напоминание: загрузите подписанный через ЭДО документ в систему.\nДокумент: ${doc}`,
  }
  return messages[type] ?? `Уведомление по документу: ${doc}`
}

// Колокольчик (im.notify.system.add)
export async function sendBitrixNotify(opts: NotifyOptions): Promise<void> {
  if (!opts.recipients || opts.recipients.length === 0) return
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) { console.error('BITRIX_WEBHOOK_URL не задан'); return }
  const message = buildMessage(opts.type, opts.document_title, opts.document_number, opts.document_id, opts.extra)
  await Promise.all(opts.recipients.map(async (userId) => {
    try {
      const res = await fetch(`${webhookUrl}im.notify.system.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ USER_ID: userId, MESSAGE: message }),
      })
      const data = await res.json()
      if (data.error) console.error(`Bitrix notify error for user ${userId}:`, data.error)
    } catch (err) { console.error(`sendBitrixNotify error for user ${userId}:`, err) }
  }))
}

// Личное сообщение (im.message.add)
export async function sendBitrixMessage(opts: NotifyOptions): Promise<void> {
  if (!opts.recipients || opts.recipients.length === 0) return
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) { console.error('BITRIX_WEBHOOK_URL не задан'); return }
  const message = buildMessage(opts.type, opts.document_title, opts.document_number, opts.document_id, opts.extra)
  await Promise.all(opts.recipients.map(async (userId) => {
    try {
      const res = await fetch(`${webhookUrl}im.message.add.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ DIALOG_ID: userId, USER_ID: userId, MESSAGE: message }),
      })
      const data = await res.json()
      if (data.error) console.error(`Bitrix message error for user ${userId}:`, data.error)
    } catch (err) { console.error(`sendBitrixMessage error for user ${userId}:`, err) }
  }))
}

// Создать групповой чат Битрикс24
export async function createBitrixChat(opts: {
  document_number: string
  document_title: string
  member_ids: number[]
  contract_id?: string
}): Promise<number | null> {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) return null
  try {
    const title = `Чат согласования ${opts.document_number} — ${opts.document_title}`
    const res = await fetch(`${webhookUrl}im.chat.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TYPE: 'OPEN', TITLE: title, USERS: opts.member_ids }),
    })
    const data = await res.json()
    if (data.error) { console.error('Bitrix chat create error:', data.error); return null }
    const chatId = data.result
    const bitrixPortal = process.env.BITRIX_PORTAL ?? 'gkepotos.bitrix24.ru'
    const link = opts.contract_id
      ? `https://${bitrixPortal}/marketplace/app/248/?contract_id=${opts.contract_id}`
      : null
    const docRef = link
      ? `[URL=${link}]${opts.document_number} — ${opts.document_title}[/URL]`
      : `${opts.document_number} — ${opts.document_title}`
    await fetch(`${webhookUrl}im.message.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        DIALOG_ID: `chat${chatId}`,
        MESSAGE: `📄 Это автоматический чат уведомлений по документу: ${docRef}\n\nВсе важные события согласования будут отображаться здесь.\nДля обсуждения документа используйте чат внутри системы ЮрИнтел.`,
      }),
    })
    return chatId
  } catch (err) { console.error('createBitrixChat error:', err); return null }
}

// Добавить участника в чат Битрикс24
export async function addUserToBitrixChat(chatId: number, userId: number): Promise<void> {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    await fetch(`${webhookUrl}im.chat.user.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ CHAT_ID: chatId, USERS: [userId] }),
    })
  } catch (err) { console.error('addUserToBitrixChat error:', err) }
}

// Отправить сообщение в групповой чат Битрикс24
export async function sendBitrixChatMessage(chatId: number, message: string): Promise<void> {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL
  if (!webhookUrl) return
  try {
    const res = await fetch(`${webhookUrl}im.message.add.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ DIALOG_ID: `chat${chatId}`, MESSAGE: message }),
    })
    const data = await res.json()
    if (data.error) console.error('Bitrix chat message error:', data.error)
  } catch (err) { console.error('sendBitrixChatMessage error:', err) }
}