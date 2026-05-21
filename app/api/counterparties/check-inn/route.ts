import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const inn = request.nextUrl.searchParams.get('inn')
    if (!inn) return NextResponse.json({ error: 'ИНН обязателен' }, { status: 400 })

    if (!/^\d{10}$|^\d{12}$/.test(inn)) {
      return NextResponse.json({ error: 'ИНН должен содержать 10 или 12 цифр' }, { status: 400 })
    }

    const apiKey = process.env.DADATA_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'DADATA_API_KEY не задан' }, { status: 500 })

    const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${apiKey}`,
      },
      body: JSON.stringify({ query: inn, count: 1 }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Ошибка обращения к DaData' }, { status: 502 })
    }

    const data = await response.json()

    if (!data.suggestions || data.suggestions.length === 0) {
      return NextResponse.json({ found: false, message: 'Организация не найдена' })
    }

    const org = data.suggestions[0]
    const d = org.data

    return NextResponse.json({
      found: true,
      data: {
        inn: d.inn ?? inn,
        kpp: d.kpp ?? null,
        ogrn: d.ogrn ?? null,
        full_name: d.name?.full_with_opf ?? org.value ?? null,
        short_name: d.name?.short_with_opf ?? null,
        legal_address: d.address?.value ?? null,
        status: d.state?.status === 'ACTIVE' ? 'активный'
          : d.state?.status === 'LIQUIDATED' ? 'ликвидирован'
          : d.state?.status === 'REORGANIZING' ? 'в_реорганизации'
          : 'приостановлен',
        director_name: d.management?.name ?? null,
        director_title: d.management?.post ?? 'Генеральный директор',
      }
    })

  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Ошибка проверки ИНН'
    }, { status: 500 })
  }
}