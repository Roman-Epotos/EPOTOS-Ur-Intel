import { NextRequest, NextResponse } from 'next/server'

// Проверка контрагента по ИНН через открытое API ФНС (egrul.nalog.ru)
export async function GET(request: NextRequest) {
  try {
    const inn = request.nextUrl.searchParams.get('inn')
    if (!inn) return NextResponse.json({ error: 'ИНН обязателен' }, { status: 400 })

    // Валидация ИНН (10 или 12 цифр)
    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      return NextResponse.json({ error: 'ИНН должен содержать 10 или 12 цифр' }, { status: 400 })
    }

    // Запрос к API dadata.ru (бесплатный план — 10000 запросов/день)
    // Используем открытый API egrul для базовой проверки
    const response = await fetch(
      `https://egrul.nalog.ru/search-new`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: inn, region: '' }),
      }
    )

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка обращения к ФНС' }, { status: 502 })
    }

    const data = await response.json()

    if (!data.rows || data.rows.length === 0) {
      return NextResponse.json({ found: false, message: 'Организация не найдена' })
    }

    const org = data.rows[0]

    return NextResponse.json({
      found: true,
      data: {
        inn: org.i ?? inn,
        kpp: org.k ?? null,
        ogrn: org.o ?? null,
        full_name: org.n ?? null,
        short_name: org.c ?? null,
        legal_address: org.a ?? null,
        status: org.e ? 'ликвидирован' : 'активный',
        director_name: org.g ?? null,
        director_title: 'Генеральный директор',
      }
    })

  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Ошибка проверки ИНН'
    }, { status: 500 })
  }
}