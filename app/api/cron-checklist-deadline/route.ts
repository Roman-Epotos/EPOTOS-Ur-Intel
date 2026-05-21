import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendBitrixNotify } from '@/app/lib/notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET() {
  try {
    // Завтрашняя дата в формате YYYY-MM-DD
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    // Находим пункты чек-листа где:
    // - due_date = завтра
    // - bitrix_task_id IS NULL (нет задачи в Б24)
    // - is_done = false
    const { data: items, error } = await supabase
      .from('contract_checklist')
      .select(`
        id,
        title,
        due_date,
        contract_id
      `)
      .eq('is_done', false)
      .is('bitrix_task_id', null)
      .gte('due_date', tomorrowStr)
      .lt('due_date', new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, notified: 0, message: 'Нет пунктов с дедлайном завтра' })
    }

    // Группируем по contract_id
    const contractIds = [...new Set(items.map(i => i.contract_id))]

    // Загружаем данные договоров + инициатора согласования + автора
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, number, title, author_bitrix_id')
      .in('id', contractIds)

    // Загружаем инициаторов согласования
    const { data: sessions } = await supabase
      .from('approval_sessions')
      .select('contract_id, initiated_by_bitrix_id')
      .in('contract_id', contractIds)
      .eq('status', 'active')

    const sessionMap: Record<string, number | null> = {}
    sessions?.forEach(s => {
      sessionMap[s.contract_id] = s.initiated_by_bitrix_id
    })

    const contractMap: Record<string, { number: string; title: string; author_bitrix_id: number | null }> = {}
    contracts?.forEach(c => {
      contractMap[c.id] = { number: c.number, title: c.title, author_bitrix_id: c.author_bitrix_id }
    })

    let notified = 0

    // Отправляем уведомления
    for (const item of items) {
      const contract = contractMap[item.contract_id]
      if (!contract) continue

      const recipients = [...new Set([
        contract.author_bitrix_id,
        sessionMap[item.contract_id],
      ].filter(Boolean) as number[])]

      if (recipients.length === 0) continue

      await sendBitrixNotify({
        recipients,
        type: 'checklist_deadline',
        document_id: item.contract_id,
        document_title: contract.title ?? '',
        document_number: contract.number ?? '',
        extra: item.title,
      })

      notified++
    }

    return NextResponse.json({
      success: true,
      notified,
      items_found: items.length,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}