import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY

// ── Извлечение текста из файлов ─────────────────────────────────────────────

async function extractTextFromPdf(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const { extractText } = await import('unpdf')
    const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
    return text
  } catch { return '' }
}

async function extractTextFromDocx(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl, { headers: { 'Accept': 'application/octet-stream' } })
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } catch { return '' }
}

async function extractTextFromXlsx(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(new Uint8Array(arrayBuffer))
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const texts: string[] = []
    workbook.SheetNames.forEach((sheetName: string) => {
      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet)
      if (csv.trim()) texts.push(csv)
    })
    return texts.join('\n')
  } catch { return '' }
}

// ── AI генерация чек-листа ──────────────────────────────────────────────────

interface ChecklistItemInput {
  item_order: number
  category: string
  title: string
  description?: string
  due_date?: string | null
  responsible?: string | null
}

async function generateChecklistWithAI(text: string): Promise<ChecklistItemInput[]> {
  const prompt = `You are a legal expert for EPOTOS Group of Companies (ГК ЭПОТОС).
Analyze the following contract and extract all obligations, deadlines, payment terms, deliverables, and important milestones that need to be tracked during contract execution.

Contract text:
${text.slice(0, 10000)}

Return ONLY valid JSON array without markdown, no preamble:
[
  {
    "item_order": 1,
    "category": "payment|delivery|deadline|document|obligation|other",
    "title": "Краткое название пункта на русском (до 80 символов)",
    "description": "Подробное описание обязательства на русском",
    "due_date": "YYYY-MM-DD или null если срок не указан",
    "responsible": "наша сторона|контрагент|обе стороны|null"
  }
]

Rules:
- Extract 5-15 most important items
- All text must be in Russian
- Focus on: payments, deliveries, document submissions, deadlines, reporting obligations
- due_date must be ISO date string or null
- responsible must be one of: "наша сторона", "контрагент", "обе стороны", or null
- category must be one of: payment, delivery, deadline, document, obligation, other`

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://epotos-ur-intel.vercel.app',
        'X-Title': 'Epotos-YurIntel',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    })
    const data = await response.json()
    const content = data.choices?.[0]?.message?.content ?? '[]'
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : []
  } catch (err) {
    console.error('AI checklist error:', err)
    return []
  }
}

// ── GET — загрузить чек-лист ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const contractId = request.nextUrl.searchParams.get('contract_id')
  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contract_checklist')
    .select('*')
    .eq('contract_id', contractId)
    .order('item_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ items: data ?? [] })
}

// ── POST — все действия с чек-листом ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      action, contract_id, file_url, file_name, user_name,
      item_id, is_done, bitrix_user_id,
      title, description, category, due_date, responsible,
    } = body

    // ── Отметить выполненным / снять отметку ──────────────────────────────
    if (action === 'toggle') {
      if (!item_id) return NextResponse.json({ error: 'item_id обязателен' }, { status: 400 })

      const updateData = is_done
        ? { is_done: true, done_at: new Date().toISOString(), done_by_name: user_name ?? 'Система', done_by_bitrix_id: bitrix_user_id ?? null }
        : { is_done: false, done_at: null, done_by_name: null, done_by_bitrix_id: null }

      const { error } = await supabase
        .from('contract_checklist')
        .update(updateData)
        .eq('id', item_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      if (contract_id) {
        await supabase.from('contract_logs').insert({
          contract_id,
          action: is_done ? 'Пункт чек-листа выполнен' : 'Отметка выполнения снята',
          details: `Пункт: ${title ?? item_id}`,
          user_name: user_name ?? 'Система',
        })
      }
      return NextResponse.json({ success: true })
    }

    // ── Добавить пункт вручную ─────────────────────────────────────────────
    if (action === 'add_item') {
      if (!contract_id || !title) {
        return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
      }

      const { data: existing } = await supabase
        .from('contract_checklist')
        .select('item_order')
        .eq('contract_id', contract_id)
        .order('item_order', { ascending: false })
        .limit(1)

      const maxOrder = existing?.[0]?.item_order ?? 0

      const { data: newItem, error } = await supabase
        .from('contract_checklist')
        .insert({
          contract_id,
          item_order: maxOrder + 1,
          category: category ?? 'other',
          title,
          description: description ?? null,
          due_date: due_date ?? null,
          responsible: responsible ?? null,
        })
        .select('*')
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Добавлен пункт чек-листа вручную',
        details: title,
        user_name: user_name ?? 'Система',
      })

      return NextResponse.json({ success: true, item: newItem })
    }

    // ── Удалить пункт ──────────────────────────────────────────────────────
    if (action === 'delete_item') {
      if (!item_id) return NextResponse.json({ error: 'item_id обязателен' }, { status: 400 })

      const { error } = await supabase
        .from('contract_checklist')
        .delete()
        .eq('id', item_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      if (contract_id) {
        await supabase.from('contract_logs').insert({
          contract_id,
          action: 'Удалён пункт чек-листа',
          details: title ?? item_id,
          user_name: user_name ?? 'Система',
        })
      }
      return NextResponse.json({ success: true })
    }

    // ── Генерация чек-листа через AI ──────────────────────────────────────
    if (!contract_id || !file_url || !file_name) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Удаляем старый чек-лист
    await supabase.from('contract_checklist').delete().eq('contract_id', contract_id)

    // Извлекаем текст из файла
    const fn = file_name.toLowerCase()
    let text = ''
    if (fn.endsWith('.pdf')) text = await extractTextFromPdf(file_url)
    else if (fn.endsWith('.docx')) text = await extractTextFromDocx(file_url)
    else if (fn.endsWith('.xlsx') || fn.endsWith('.xls')) text = await extractTextFromXlsx(file_url)
    else return NextResponse.json({ error: 'Неподдерживаемый формат файла' }, { status: 400 })

    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Не удалось извлечь текст из документа' }, { status: 400 })
    }

    // Генерируем пункты через AI
    const items = await generateChecklistWithAI(text)

    if (items.length === 0) {
      return NextResponse.json({ error: 'AI не смог извлечь пункты чек-листа' }, { status: 400 })
    }

    // Сохраняем пункты в БД
    const rows = items.map((item, idx) => ({
      contract_id,
      item_order: item.item_order ?? idx + 1,
      category: item.category ?? 'other',
      title: item.title,
      description: item.description ?? null,
      due_date: item.due_date && item.due_date !== 'null' ? item.due_date : null,
      responsible: item.responsible && item.responsible !== 'null' ? item.responsible : null,
    }))

    const { error: insertError } = await supabase
      .from('contract_checklist')
      .insert(rows)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })

    // Меняем статус контракта на на_исполнении
    await supabase
      .from('contracts')
      .update({ status: 'на_исполнении' })
      .eq('id', contract_id)

    // Лог
    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'AI чек-лист исполнения сгенерирован',
      details: `Извлечено ${items.length} пунктов. Статус → на_исполнении`,
      user_name: user_name ?? 'Система',
    })

    return NextResponse.json({ success: true, items_count: items.length })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}