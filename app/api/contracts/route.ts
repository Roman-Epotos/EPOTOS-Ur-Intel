import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!

const TYPE_CODES: Record<string, string> = {
  'поставка': 'ДОГ',
  'услуги': 'ДОГ',
  'аренда': 'ДОГ',
  'подряд': 'ДОГ',
  'купля-продажа': 'ДОГ',
  'агентский': 'ДОГ',
  'дилерский': 'ДОГ',
  'лицензионный': 'ДОГ',
  'сервисный': 'ДОГ',
  'доп-соглашение': 'ДОП',
  'nda': 'КОНФ',
  'эдо': 'ЭДО',
  'протокол-разногласий': 'ПРТ',
  'претензия': 'ПРЗ',
  'исковое': 'ИСК',
  'ответ-претензию': 'ПРЗ',
  'положение': 'ОРД',
  'инструкция': 'ОРД',
  'служебная-записка': 'ОРД',
  'доверенность': 'ДОВ',
  'персданные': 'СПД',
  'акт': 'АКТ',
  'заключение': 'ПРВ',
  'справка': 'СПР',
  'устав': 'УСТ',
  'учредительный': 'ДОГ',
  'письмо': 'ПСМ',
  'счет': 'СЧТ',
  'спецификация': 'СПЕЦ',
  'другое': 'ДОК',
}

// Генерация номера договора
export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix')
  const type = request.nextUrl.searchParams.get('type') ?? ''
  const childNumber = request.nextUrl.searchParams.get('child_number')
  const parentId = request.nextUrl.searchParams.get('parent_id')
  const childType = request.nextUrl.searchParams.get('child_type') ?? ''

  // Генерация номера дочернего документа
  if (childNumber === 'true' && parentId) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
    const { data: parent } = await supabase
      .from('contracts')
      .select('number')
      .eq('id', parentId)
      .single()

    if (!parent) return NextResponse.json({ error: 'Родительский документ не найден' }, { status: 404 })

    // Считаем сколько дочерних документов уже есть
    const { data: children } = await supabase
      .from('contracts')
      .select('child_number')
      .eq('parent_contract_id', parentId)
      .order('child_number', { ascending: false })
      .limit(1)

    const nextChildNum = children && children.length > 0 ? (children[0].child_number ?? 0) + 1 : 1
    const childTypeCode = TYPE_CODES[childType] ?? 'ДОК'

    // Берём номер родителя и меняем код типа
    // ТХ-ДОГ-2026/06/1 → ТХ-СПЕЦ-2026/06/1-1
    const parentParts = parent.number.split('-')
    parentParts[1] = childTypeCode
    const baseNumber = parentParts.join('-')
    const number = `${baseNumber}-${nextChildNum}`

    return NextResponse.json({ number })
  }

  if (!prefix) {
    return NextResponse.json({ error: 'Префикс не указан' }, { status: 400 })
  }

  const typeCode = TYPE_CODES[type] ?? 'ДОГ'
  const fullPrefix = `${prefix}-${typeCode}`

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contracts?select=number&number=like.${encodeURIComponent(fullPrefix + '-' + year + '/%')}&order=number.desc&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = await res.json()
  let maxNum = 0
  if (data && data.length > 0) {
    const lastNumber = data[0].number as string
    const parts = lastNumber.split('/')
    const lastSeq = parseInt(parts[parts.length - 1] ?? '0')
    if (!isNaN(lastSeq)) maxNum = lastSeq
  }
  const nextNum = String(maxNum + 1)
  const number = `${fullPrefix}-${year}/${month}/${nextNum}`

  return NextResponse.json({ number })
}

// Сохранение договора
export async function POST(request: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const body = await request.json()
    const { is_child, parent_contract_id, parent_contract_external, child_number: childNum } = body
    const userName = body.user_name ?? 'Система'

    // Сохраняем договор
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        number: body.number,
        title: body.title,
        counterparty: body.counterparty,
        counterparty_id: body.counterparty_id ?? null,
        type: body.type,
        amount: body.amount ? parseFloat(body.amount) : null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        status: 'черновик',
        author_bitrix_id: body.user_bitrix_id ? parseInt(body.user_bitrix_id) : null,
        document_category: body.document_category ?? 'contract',
        is_child: body.is_child ?? false,
        parent_contract_id: body.parent_contract_id ?? null,
        parent_contract_external: body.parent_contract_external ?? null,
      })
      .select('id')
      .single()

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 400 })
    }

    // Записываем в лог с именем пользователя
    await supabase
      .from('contract_logs')
      .insert({
        contract_id: contract.id,
        action: 'Документ создан',
        details: `Договор "${body.title}" создан. Контрагент: ${body.counterparty}. Сумма: ${body.amount ? Number(body.amount).toLocaleString('ru-RU') + ' ₽' : 'не указана'}.`,
        user_name: userName,
      })

    return NextResponse.json({ success: true, id: contract.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}