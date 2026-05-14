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
  source_document?: string | null
}

async function generateChecklistWithAI(text: string, datesHint = '', sources: string[] = []): Promise<ChecklistItemInput[]> {
  const datesSection = datesHint
    ? `\nКлючевые даты для расчёта относительных сроков:\n${datesHint}\n`
    : '\nКлючевые даты не указаны — для относительных сроков (например "в течение 5 дней") оставляй due_date null и указывай срок в description.\n'

  const sourcesSection = sources.length > 0
    ? `\nДокументы для анализа: ${sources.join(', ')}\n`
    : ''

  const prompt = `You are a legal expert for EPOTOS Group of Companies (ГК ЭПОТОС).
Analyze the following contract documents and extract all obligations, deadlines, payment terms, deliverables, and important milestones that need to be tracked during contract execution.
${sourcesSection}${datesSection}
CRITICAL INSTRUCTIONS FOR DATE CALCULATION:
You MUST calculate absolute dates for ALL relative time expressions found in the contract.
Use the key dates provided above as reference points.

Examples of how to calculate dates:
- Contract says "within 5 days after signing" + signing date is 2026-05-14 → due_date = "2026-05-19"
- Contract says "within 10 calendar days from contract date" + contract date is 2026-05-14 → due_date = "2026-05-24"
- Contract says "30 days after delivery" + delivery date is 2026-06-01 → due_date = "2026-07-01"
- Contract says "until the 15th of each month" → due_date = nearest upcoming 15th from signing date
- Contract says "within 3 business days" → calculate adding ~3-4 calendar days
- Contract says "quarterly" → due_date = 3 months from signing date
- Contract says "annually" → due_date = 1 year from signing date
- If NO reference date available for calculation → due_date = null, describe relative term in description

ALWAYS prefer to calculate a concrete date rather than leaving null.
Only use null if it is truly impossible to calculate any reasonable date.

Contract text:
${text.slice(0, 12000)}

Return ONLY valid JSON array without markdown, no preamble:
[
  {
    "item_order": 1,
    "category": "payment|delivery|deadline|document|obligation|other",
    "title": "Краткое название пункта на русском (до 80 символов)",
    "description": "Подробное описание обязательства на русском, включая исходную формулировку срока из договора",
    "due_date": "YYYY-MM-DD или null только если расчёт невозможен",
    "responsible": "наша сторона|контрагент|обе стороны|null",
    "source_document": "название источника из которого извлечён пункт"
  }
]

Rules:
- Extract 5-20 most important items across ALL documents
- All text must be in Russian
- Focus on: payments, deliveries, document submissions, deadlines, reporting obligations
- ALWAYS calculate absolute due_date using the key dates provided — this is mandatory
- In description field always include the original deadline wording from the contract
- responsible must be: "наша сторона", "контрагент", "обе стороны", or null
- category must be: payment, delivery, deadline, document, obligation, other
- source_document must match one of the document names provided`

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
  const history = request.nextUrl.searchParams.get('history')

  if (!contractId) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  // История изменений чек-листа из contract_logs
  if (history === 'true') {
    const { data, error } = await supabase
      .from('contract_logs')
      .select('id, action, details, user_name, created_at')
      .eq('contract_id', contractId)
      .or('action.ilike.%чек-лист%,action.ilike.%Чек-лист%,action.ilike.%чек_лист%')
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ logs: data ?? [] })
  }

  // Список пунктов чек-листа
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

    // ── Редактировать пункт ────────────────────────────────────────────────
    if (action === 'edit_item') {
      if (!item_id) return NextResponse.json({ error: 'item_id обязателен' }, { status: 400 })

      const { error } = await supabase
        .from('contract_checklist')
        .update({
          title,
          description: description ?? null,
          category: category ?? 'other',
          due_date: due_date ?? null,
          responsible: responsible ?? null,
        })
        .eq('id', item_id)

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })

      if (contract_id) {
        await supabase.from('contract_logs').insert({
          contract_id,
          action: 'Пункт чек-листа отредактирован',
          details: title,
          user_name: user_name ?? 'Система',
        })
      }
      return NextResponse.json({ success: true })
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
    const hasFiles = (body.files && body.files.length > 0) || (file_url && file_name)
    if (!contract_id || !hasFiles) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Удаляем старый чек-лист (предварительно сохраняем в архив)
    const { data: existingItems } = await supabase
      .from('contract_checklist')
      .select('*')
      .eq('contract_id', contract_id)

    if (existingItems && existingItems.length > 0) {
      // Сохраняем в архив (удаляем старый архив, пишем новый)
      await supabase.from('contract_checklist_archive').delete().eq('contract_id', contract_id)
      const archiveRows = existingItems.map(item => ({ ...item, id: undefined, original_id: item.id }))
      await supabase.from('contract_checklist_archive').insert(archiveRows)
    }

    await supabase.from('contract_checklist').delete().eq('contract_id', contract_id)

    // Извлекаем текст из всех файлов
    const files: Array<{ file_url: string; file_name: string; source: string }> = body.files ?? []

    // Обратная совместимость — если передан один файл
    if (files.length === 0 && file_url && file_name) {
      files.push({ file_url, file_name, source: 'Основной документ' })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Не переданы файлы для анализа' }, { status: 400 })
    }

    // Собираем текст из всех файлов с указанием источника
    const textParts: string[] = []
    for (const f of files) {
      const fn = f.file_name.toLowerCase()
      let text = ''
      if (fn.endsWith('.pdf')) text = await extractTextFromPdf(f.file_url)
      else if (fn.endsWith('.docx')) text = await extractTextFromDocx(f.file_url)
      else if (fn.endsWith('.xlsx') || fn.endsWith('.xls')) text = await extractTextFromXlsx(f.file_url)

      if (text && text.length > 50) {
        textParts.push(`=== ДОКУМЕНТ: ${f.source} ===\n${text}`)
      }
    }

    if (textParts.length === 0) {
      return NextResponse.json({ error: 'Не удалось извлечь текст ни из одного документа' }, { status: 400 })
    }

    const combinedText = textParts.join('\n\n')

    // Даты для расчёта относительных сроков
    const signedDate: string | null = body.signed_date ?? null
    const effectiveDate: string | null = body.effective_date ?? null
    const customDateLabel: string | null = body.custom_date_label ?? null
    const customDateValue: string | null = body.custom_date_value ?? null

    // Формируем подсказку по датам
    const datesHint = [
      signedDate ? `Дата подписания: ${signedDate}` : null,
      effectiveDate ? `Дата вступления в силу: ${effectiveDate}` : null,
      customDateLabel && customDateValue ? `${customDateLabel}: ${customDateValue}` : null,
    ].filter(Boolean).join('\n')

    // Генерируем пункты через AI
    const items = await generateChecklistWithAI(combinedText, datesHint, files.map(f => f.source))

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
      source_document: item.source_document ?? null,
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