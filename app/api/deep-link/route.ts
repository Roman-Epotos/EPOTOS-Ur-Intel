import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const DEEP_LINK_TTL_SECONDS = 20
const COOKIE_NAME = 'epotos_deep_link_id'

export async function POST(request: NextRequest) {
  let body: { id?: string; member_id?: string; contract_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Некорректный JSON' }, { status: 400 })
  }

  const { id, member_id, contract_id } = body
  if (!id || !contract_id) {
    return NextResponse.json({ error: 'Нужны id и contract_id' }, { status: 400 })
  }

  // Ленивая уборка протухшего (Вариант A).
  await supabase
    .from('pending_deep_links')
    .delete()
    .lt('created_at', new Date(Date.now() - DEEP_LINK_TTL_SECONDS * 1000).toISOString())

  const { error } = await supabase
    .from('pending_deep_links')
    .insert({ id, member_id: member_id ?? '', contract_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const res = NextResponse.json({ success: true })
  res.headers.set(
    'Set-Cookie',
    `${COOKIE_NAME}=${id}; Path=/; Max-Age=${DEEP_LINK_TTL_SECONDS}; SameSite=None; Secure`
  )
  return res
}

export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get('id')
  const cookieId = request.cookies.get(COOKIE_NAME)?.value
  const id = idParam || cookieId
  const memberId = request.nextUrl.searchParams.get('member_id')
  const cutoff = new Date(Date.now() - DEEP_LINK_TTL_SECONDS * 1000).toISOString()

  if (id) {
    const { data, error } = await supabase
      .from('pending_deep_links')
      .select('id, contract_id, created_at, member_id')
      .eq('id', id)
      .gte('created_at', cutoff)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (data) {
      if (memberId && data.member_id && data.member_id !== memberId) {
        return clearCookie(NextResponse.json({ contract_id: null }))
      }
      await supabase.from('pending_deep_links').delete().eq('id', data.id)
      return clearCookie(NextResponse.json({ contract_id: data.contract_id }))
    }
  }

  if (memberId) {
    const { data, error } = await supabase
      .from('pending_deep_links')
      .select('id, contract_id')
      .eq('member_id', memberId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (data) {
      await supabase.from('pending_deep_links').delete().eq('id', data.id)
      return clearCookie(NextResponse.json({ contract_id: data.contract_id }))
    }
  }

  return clearCookie(NextResponse.json({ contract_id: null }))
}

function clearCookie(res: NextResponse): NextResponse {
  res.headers.set('Set-Cookie', `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=None; Secure`)
  return res
}