import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const CORS = { 'Access-Control-Allow-Origin': '*' }

export async function OPTIONS() {
  return new NextResponse(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
}

export async function GET(request: NextRequest) {
  try {
    const inns = request.nextUrl.searchParams.get('inns')
    if (!inns) return NextResponse.json({ risks: {} }, { headers: CORS })

    const innList = inns.split(',').filter(Boolean).slice(0, 100)

    const { data } = await supabase
      .from('counterparty_checks')
      .select('inn, risk_level, expires_at')
      .in('inn', innList)
      .gt('expires_at', new Date().toISOString())
      .order('checked_at', { ascending: false })

    // Берём последний актуальный результат по каждому ИНН
    const risks: Record<string, string> = {}
    for (const row of data ?? []) {
      if (!risks[row.inn]) risks[row.inn] = row.risk_level
    }

    return NextResponse.json({ risks }, { headers: CORS })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500, headers: CORS })
  }
}