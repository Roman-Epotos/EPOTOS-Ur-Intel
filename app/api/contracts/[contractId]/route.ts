import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('id', contractId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ contract })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> }
) {
  try {
    const { contractId } = await params
    const body = await request.json()
    const { admin_bitrix_id, reason } = body

    // Проверяем права администратора
    const { data: admin } = await supabase
      .from('system_admins')
      .select('id')
      .eq('bitrix_user_id', admin_bitrix_id)
      .single()

    if (!admin) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    // Записываем в лог перед удалением
    await supabase
      .from('contract_logs')
      .insert({
        contract_id: contractId,
        action: 'Договор удалён администратором',
        details: reason ? `Причина: ${reason}` : 'Причина не указана',
        user_name: body.user_name ?? 'Администратор',
      })

    // Удаляем договор (каскадно удалятся все связанные записи)
    const { error } = await supabase
      .from('contracts')
      .delete()
      .eq('id', contractId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}