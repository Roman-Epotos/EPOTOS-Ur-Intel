import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const WEBHOOK = process.env.BITRIX_WEBHOOK_URL!

// Постановщик = ГД компании по префиксу
const COMPANY_DIRECTORS: Record<string, number> = {
  'ТХ':  1,    // Чащина Елена — Ген. директор ООО Техно
  'НПП': 592,  // директор НПП
  'СПТ': 6,    // Валюк Андрей — ГД СПТ/ОС
  'ОС':  6,
  'Э-К': 954,  // директор Э-К
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      checklist_item_id,   // id пункта чек-листа (или null при создании всех)
      contract_id,
      contract_number,
      contract_title,
      company_prefix,
      item_title,
      item_description,
      due_date,
      responsible_bitrix_id,  // исполнитель (по умолчанию = автор документа)
      // Для создания всех задач сразу
      items,  // массив {id, title, description, due_date} если bulk
    } = body

    if (!contract_id || !company_prefix) {
      return NextResponse.json({ error: 'Не переданы обязательные поля' }, { status: 400 })
    }

    const directorId = COMPANY_DIRECTORS[company_prefix] ?? 1

    // Функция создания одной задачи в Битрикс24
    const createBitrixTask = async (
      title: string,
      description: string | null,
      deadline: string | null,
      responsibleId: number,
      itemId: string
    ): Promise<{ bitrix_task_id: string | null; error?: string }> => {
      
      // Формируем описание задачи
      const contractRef = `📄 Документ: ${contract_number} — ${contract_title}`
      const noDeadlineNote = !deadline 
        ? '\n\n⚠️ Срок не установлен. Необходимо задать срок исполнения!' 
        : ''
      const fullDescription = `${description || title}\n\n${contractRef}${noDeadlineNote}`

      const fields: Record<string, unknown> = {
        TITLE: title,
        DESCRIPTION: fullDescription,
        DESCRIPTION_IN_BBCODE: 'Y',
        RESPONSIBLE_ID: String(responsibleId),
        CREATED_BY: String(directorId),  // постановщик = ГД компании
        PRIORITY: '1',
      }

      if (deadline) {
        // Конвертируем дату в формат Битрикс (ISO 8601)
        fields.DEADLINE = new Date(deadline).toISOString()
      }

      const url = `${WEBHOOK}tasks.task.add.json`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })

      const data = await resp.json()

      if (data.error) {
        return { bitrix_task_id: null, error: data.error_description ?? data.error }
      }

      const taskId = String(data.result?.task?.id)

      // Сохраняем bitrix_task_id в Supabase
      await supabase
        .from('contract_checklist')
        .update({ bitrix_task_id: taskId })
        .eq('id', itemId)

      return { bitrix_task_id: taskId }
    }

    // === BULK: создать все задачи ===
    if (items && Array.isArray(items)) {
      const results = []
      for (const item of items) {
        // Пропускаем уже созданные
        if (item.bitrix_task_id) {
          results.push({ id: item.id, skipped: true, bitrix_task_id: item.bitrix_task_id })
          continue
        }
        const result = await createBitrixTask(
          item.title,
          item.description,
          item.due_date,
          responsible_bitrix_id,
          item.id
        )
        results.push({ id: item.id, ...result })
        // Пауза между запросами чтобы не превысить лимит Битрикс
        await new Promise(r => setTimeout(r, 300))
      }
      return NextResponse.json({ success: true, results })
    }

    // === SINGLE: создать одну задачу ===
    if (!checklist_item_id || !item_title) {
      return NextResponse.json({ error: 'Не переданы item данные' }, { status: 400 })
    }

    const result = await createBitrixTask(
      item_title,
      item_description,
      due_date,
      responsible_bitrix_id,
      checklist_item_id
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, bitrix_task_id: result.bitrix_task_id })

  } catch (err) {
    console.error('bitrix-tasks error:', err)
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 })
  }
}