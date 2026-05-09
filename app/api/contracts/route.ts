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
  'другое': 'ДОК',
}

// Генерация номера договора
export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix')
  const type = request.nextUrl.searchParams.get('type') ?? ''
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
  const nextNum = String(maxNum + 1).padStart(2, '0')
  const number = `${fullPrefix}-${year}/${month}/${nextNum}`

  return NextResponse.json({ number })
}

// Сохранение договора
export async function POST(request: NextRequest) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

  try {
    const body = await request.json()
    const userName = body.user_name ?? 'Система'

    // Сохраняем договор
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        number: body.number,
        title: body.title,
        counterparty: body.counterparty,
        type: body.type,
        amount: body.amount ? parseFloat(body.amount) : null,
        start_date: body.start_date || null,
        end_date: body.end_date || null,
        status: 'черновик',
        author_bitrix_id: body.user_bitrix_id ? parseInt(body.user_bitrix_id) : null,
        document_category: body.document_category ?? 'contract',
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