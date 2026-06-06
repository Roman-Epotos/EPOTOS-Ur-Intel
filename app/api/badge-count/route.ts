import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bitrix_user_id } = body
    if (!bitrix_user_id) return NextResponse.json({ success: false })

    await supabase
      .from('user_badge_seen')
      .upsert({
        bitrix_user_id,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'bitrix_user_id' })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('bitrix_user_id')
    if (!userId) return NextResponse.json({ count: 0 })

    const bitrixId = parseInt(userId)

    // 1. Документы ожидающие согласования пользователя
    const { data: pendingApprovals } = await supabase
      .from('approval_participants')
      .select('id')
      .eq('bitrix_user_id', bitrixId)
      .eq('status', 'pending')
      .eq('role', 'required')

    // 2. Новые сообщения в чатах где участвует пользователь
    // Берём сессии где пользователь участник
    const { data: userSessions } = await supabase
      .from('approval_participants')
      .select('session_id')
      .eq('bitrix_user_id', bitrixId)

    const sessionIds = (userSessions ?? []).map(s => s.session_id)

    let newMessages = 0
    if (sessionIds.length > 0) {
      // Берём время последнего визита из stored_at
      const lastSeenKey = `last_seen_${bitrixId}`
      const { data: lastSeenData } = await supabase
        .from('user_badge_seen')
        .select('last_seen_at')
        .eq('bitrix_user_id', bitrixId)
        .single()

      const lastSeenAt = lastSeenData?.last_seen_at ?? '2020-01-01T00:00:00Z'

      const { data: newMsgs } = await supabase
        .from('approval_messages')
        .select('id')
        .in('session_id', sessionIds)
        .neq('bitrix_user_id', bitrixId)
        .gt('created_at', lastSeenAt)
        .is('is_ai', false)

      newMessages = (newMsgs ?? []).length
    }

    const count = (pendingApprovals?.length ?? 0) + (newMessages > 0 ? 1 : 0)

    return NextResponse.json({ count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message, count: 0 }, { status: 500 })
  }
}