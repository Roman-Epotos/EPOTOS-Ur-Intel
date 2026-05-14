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

export async function sendBitrixNotify(opts: NotifyOptions): Promise<void> {
  if (!opts.recipients || opts.recipients.length === 0) return

  try {
    await fetch(`${baseUrl}/api/bitrix-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    })
  } catch (err) {
    // Уведомления не критичны — логируем и продолжаем
    console.error('sendBitrixNotify error:', err)
  }
}