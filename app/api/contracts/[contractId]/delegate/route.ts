import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params
    const body = await request.json()
    const { allow_others_to_approve, user_name } = body

    const { error } = await supabase
      .from('contracts')
      .update({ allow_others_to_approve })
      .eq('id', contractId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id: contractId,
        action: allow_others_to_approve
          ? 'Делегировано право запуска согласования'
          : 'Право запуска согласования отозвано',
        details: allow_others_to_approve
          ? 'Любой сотрудник может запустить согласование'
          : 'Только автор и администраторы могут запустить согласование',
        user_name: user_name ?? 'Система',
      })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}