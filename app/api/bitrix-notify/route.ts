import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK_URL = process.env.BITRIX_WEBHOOK_URL

// Типы уведомлений
export type NotifyType =
  | 'document_created'      // Создан документ
  | 'sent_for_approval'     // Отправлен на согласование
  | 'approval_required'     // Требуется согласование
  | 'document_approved'     // Документ согласован
  | 'document_rejected'     // Документ отклонён
  | 'documents_uploaded'    // Загружены подписанные документы
  | 'checklist_generated'   // Сгенерирован чек-лист
  | 'checklist_deadline'    // Дедлайн пункта чек-листа

interface NotifyParams {
  to_bitrix_id: number      // ID получателя в Битрикс24
  type: NotifyType
  document_title: string
  document_number: string
  document_id: string
  extra?: string            // Дополнительная информация
}

function buildMessage(params: NotifyParams): string {
  const link = `https://epotos-ur-intel.vercel.app/contracts/${params.document_id}`
  const doc = `[URL=${link}]${params.document_number} — ${params.document_title}[/URL]`

  const messages: Record<NotifyType, string> = {
    document_created:     `📄 Создан новый документ: ${doc}`,
    sent_for_approval:    `📨 Документ отправлен на согласование: ${doc}`,
    approval_required:    `⚡ Требуется ваше согласование: ${doc}`,
    document_approved:    `✅ Документ согласован: ${doc}`,
    document_rejected:    `❌ Документ отклонён: ${doc}${params.extra ? `\nПричина: ${params.extra}` : ''}`,
    documents_uploaded:   `📎 Загружены подписанные документы: ${doc}`,
    checklist_generated:  `📋 Сгенерирован чек-лист исполнения: ${doc}`,
    checklist_deadline:   `⏰ Дедлайн пункта чек-листа: ${params.extra ?? ''}\nДокумент: ${doc}`,
  }

  return messages[params.type] ?? `Уведомление по документу: ${doc}`
}

// Отправка одного уведомления
async function sendNotify(toId: number, message: string): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.error('BITRIX_WEBHOOK_URL не задан')
    return false
  }

  try {
    const url = `${WEBHOOK_URL}im.notify.system.add.json`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        USER_ID: toId,
        MESSAGE: message,
      }),
    })
    const data = await res.json()
    return data.result !== undefined
  } catch (err) {
    console.error('Ошибка отправки уведомления Битрикс24:', err)
    return false
  }
}

// POST — отправить уведомление
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { recipients, type, document_title, document_number, document_id, extra } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'recipients обязателен' }, { status: 400 })
    }

    if (!type || !document_id) {
      return NextResponse.json({ error: 'type и document_id обязательны' }, { status: 400 })
    }

    const results = await Promise.all(
      recipients.map(async (bitrixId: number) => {
        const message = buildMessage({
          to_bitrix_id: bitrixId,
          type,
          document_title: document_title ?? 'Документ',
          document_number: document_number ?? '',
          document_id,
          extra,
        })
        const success = await sendNotify(bitrixId, message)
        return { bitrixId, success }
      })
    )

    const failed = results.filter(r => !r.success)
    return NextResponse.json({
      success: true,
      sent: results.length - failed.length,
      failed: failed.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}