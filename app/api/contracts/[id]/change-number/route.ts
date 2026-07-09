import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

const LOCKED_STATUSES_FOR_NUMBER = [
  'согласован', 'на_подписи_в_эдо', 'загружен_частично', 'подписан', 'на_исполнении'
]

async function canChangeNumber(
  userId: number,
  contract: { author_bitrix_id: number | null; status: string; id: string }
): Promise<boolean> {
  if (ADMIN_IDS.includes(userId)) return true

  // После "Согласован" и далее — только администратор/разработчик
  if (LOCKED_STATUSES_FOR_NUMBER.includes(contract.status)) return false

  if (contract.author_bitrix_id === userId) return true

  // Юрист-участник последней сессии согласования этого документа
  const { data: session } = await supabase
    .from('approval_sessions')
    .select('id, initiated_by_bitrix_id')
    .eq('contract_id', contract.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) return false

  if (session.initiated_by_bitrix_id === userId) return true

  const { data: participant } = await supabase
    .from('approval_participants')
    .select('id')
    .eq('session_id', session.id)
    .eq('bitrix_user_id', userId)
    .in('stage', ['legal', 'legal_gc'])
    .limit(1)

  return !!(participant && participant.length > 0)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { new_number, comment, user_name, user_bitrix_id } = body

    if (!new_number?.trim() || !comment?.trim()) {
      return NextResponse.json({ error: 'Новый номер и комментарий обязательны' }, { status: 400 })
    }

    const userId = parseInt(user_bitrix_id ?? '0')

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, number, status, author_bitrix_id')
      .eq('id', id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: 'Договор не найден' }, { status: 404 })
    }

    if (contract.number === new_number.trim()) {
      return NextResponse.json({ error: 'Новый номер совпадает с текущим' }, { status: 400 })
    }

    const allowed = await canChangeNumber(userId, contract)
    if (!allowed) {
      return NextResponse.json({ error: 'Нет прав на изменение номера документа' }, { status: 403 })
    }

    // Проверяем уникальность нового номера
    const { data: duplicate } = await supabase
      .from('contracts')
      .select('id')
      .eq('number', new_number.trim())
      .neq('id', id)
      .limit(1)

    if (duplicate && duplicate.length > 0) {
      return NextResponse.json({ error: 'Такой номер уже используется другим документом' }, { status: 400 })
    }

    const oldNumber = contract.number

    const { error: updateError } = await supabase
      .from('contracts')
      .update({ number: new_number.trim() })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    await supabase.from('contract_logs').insert({
      contract_id: id,
      action: 'Изменён номер документа',
      details: `${oldNumber} → ${new_number.trim()}. Причина: ${comment.trim()}`,
      user_name: user_name ?? 'Система',
    })

    // Если есть сессия согласования — сообщаем в её чат
    const { data: session } = await supabase
      .from('approval_sessions')
      .select('id')
      .eq('contract_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (session) {
      await supabase.from('approval_messages').insert({
        session_id: session.id,
        message: `🔢 ${user_name} изменил(а) номер документа: ${oldNumber} → ${new_number.trim()}\nПричина: ${comment.trim()}`,
        author_name: 'Система',
        is_ai: false,
      })
    }

    return NextResponse.json({ success: true, number: new_number.trim() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}