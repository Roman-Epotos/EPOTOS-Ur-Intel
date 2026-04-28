import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.formData()
    const domain = body.get('DOMAIN') as string
    const memberId = body.get('member_id') as string
    const authId = body.get('AUTH_ID') as string
    const refreshId = body.get('REFRESH_ID') as string

    if (!domain || !memberId || !authId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    // Получаем данные пользователя из Битрикс24
    const userResponse = await fetch(
      `https://${domain}/rest/user.current?auth=${authId}`
    )
    const userData = await userResponse.json()

    if (!userData.result) {
      return NextResponse.json({ error: 'Failed to get user data' }, { status: 400 })
    }

    const user = userData.result
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!
    )

    // Создаём или обновляем пользователя в базе
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('bitrix_user_id', user.ID)
      .single()

    if (existingUser) {
      await supabase
        .from('users')
        .update({
          bitrix_token: authId,
          full_name: `${user.LAST_NAME} ${user.NAME}`.trim(),
          email: user.EMAIL,
          department: user.UF_DEPARTMENT?.[0]?.toString() ?? null,
          avatar_url: user.PERSONAL_PHOTO ?? null,
        })
        .eq('bitrix_user_id', user.ID)
    } else {
      await supabase
        .from('users')
        .insert({
          email: user.EMAIL || `user_${user.ID}@epotos.ru`,
          full_name: `${user.LAST_NAME} ${user.NAME}`.trim(),
          bitrix_user_id: parseInt(user.ID),
          bitrix_token: authId,
          department: user.UF_DEPARTMENT?.[0]?.toString() ?? null,
          avatar_url: user.PERSONAL_PHOTO ?? null,
          role: 'user',
        })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.ID,
        name: `${user.LAST_NAME} ${user.NAME}`.trim(),
        email: user.EMAIL,
        avatar: user.PERSONAL_PHOTO,
        auth_id: authId,
        refresh_id: refreshId,
        domain,
        member_id: memberId,
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Bitrix24 callback endpoint' })
}