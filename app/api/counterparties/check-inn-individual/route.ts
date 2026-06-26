import { NextRequest, NextResponse } from 'next/server'

const DADATA_API_KEY = process.env.DADATA_API_KEY!

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const inn = searchParams.get('inn')?.trim()

  if (!inn || inn.length !== 12 || !/^\d{12}$/.test(inn)) {
    return NextResponse.json({ found: false, message: 'ИНН физлица должен содержать 12 цифр' })
  }

  try {
    const res = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/individual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${DADATA_API_KEY}`,
      },
      body: JSON.stringify({ query: inn }),
    })

    if (!res.ok) {
      return NextResponse.json({ found: false, message: 'Ошибка запроса к DaData' })
    }

    const data = await res.json()
    const suggestion = data.suggestions?.[0]

    if (!suggestion) {
      return NextResponse.json({ found: false, message: 'Физлицо с таким ИНН не найдено' })
    }

    const d = suggestion.data
    // Формируем ФИО
    const fullName = [d.surname, d.name, d.patronymic].filter(Boolean).join(' ')
    // Дата рождения: DaData возвращает в формате YYYY-MM-DD
    const birthDate = d.birthdate ?? null

    return NextResponse.json({
      found: true,
      data: {
        full_name: fullName || null,
        birth_date: birthDate,
      }
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ found: false, message })
  }
}