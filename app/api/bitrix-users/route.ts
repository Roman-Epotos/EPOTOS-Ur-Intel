import { NextRequest, NextResponse } from 'next/server'

const WEBHOOK = process.env.BITRIX_WEBHOOK_URL!

// Карта префикс компании → ID отделов Битрикс24
const COMPANY_DEPARTMENTS: Record<string, number[]> = {
  'ТХ':  [206, 38, 246, 260, 262, 264, 198, 188, 202, 18, 32, 22, 236, 28, 270, 272, 274, 230, 14, 184, 276, 278, 280, 3, 66, 240, 266, 268, 190, 282, 226],
  'НПП': [208],
  'СПТ': [5, 48, 64, 72, 62, 44, 54, 52, 50, 56, 58, 46, 42, 60, 160],
  'ОС':  [26, 140, 146, 142, 144, 148, 150],
  'Э-К': [10, 88, 98, 90, 222, 86, 284, 224, 102, 96, 94, 108, 164, 166, 162, 128, 172, 176, 174, 116, 250, 252, 254, 256],
}

export async function GET(request: NextRequest) {
  const prefix = request.nextUrl.searchParams.get('prefix')

  if (!prefix || !COMPANY_DEPARTMENTS[prefix]) {
    return NextResponse.json({ error: 'Неверный префикс компании' }, { status: 400 })
  }

  const deptIds = COMPANY_DEPARTMENTS[prefix]

  try {
    // Загружаем активных пользователей по отделам
    const url = `${WEBHOOK}user.get.json`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          ACTIVE: true,
          UF_DEPARTMENT: deptIds,
        },
        select: ['ID', 'NAME', 'LAST_NAME', 'SECOND_NAME', 'WORK_POSITION'],
        order: { 'LAST_NAME': 'ASC' },
      }),
    })

    const data = await resp.json()

    if (data.error) {
      return NextResponse.json({ error: data.error_description }, { status: 400 })
    }

    const users = (data.result ?? []).map((u: {
      ID: string
      NAME: string
      LAST_NAME: string
      SECOND_NAME?: string
      WORK_POSITION?: string
    }) => ({
      id: parseInt(u.ID),
      name: `${u.LAST_NAME} ${u.NAME}${u.SECOND_NAME ? ' ' + u.SECOND_NAME : ''}`.trim(),
      position: u.WORK_POSITION ?? '',
    }))

    return NextResponse.json({ users })

  } catch (err) {
    console.error('bitrix-users error:', err)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}