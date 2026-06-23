import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendBitrixNotify } from '@/app/lib/notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Находим договоры в статусе на_подписи_в_эдо
    // где ГД одобрил ЭДО, но подписанный файл ещё не загружен
    // и прошло более 3 дней с момента одобрения ГД
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const { data: sessions } = await supabase
      .from('approval_sessions')
      .select(`
        id,
        contract_id,
        initiated_by_bitrix_id,
        edo_requested_by_id,
        edo_director_decided_at,
        contracts!inner(
          id, number, title, status, author_bitrix_id
        )
      `)
      .eq('edo_director_decision', 'approved')
      .eq('signing_method', 'edo')
      .eq('contracts.status', 'на_подписи_в_эдо')
      .lt('edo_director_decided_at', threeDaysAgo.toISOString())
      .not('edo_director_decided_at', 'is', null)

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, reminded: 0 })
    }

    let reminded = 0

    for (const session of sessions) {
      const contract = Array.isArray(session.contracts)
        ? session.contracts[0]
        : session.contracts as { id: string, number: string, title: string, status: string, author_bitrix_id: number | null }

      if (!contract) continue

      // Проверяем что подписанный документ действительно не загружен
      const { data: signedDocs } = await supabase
        .from('signed_documents')
        .select('id')
        .eq('contract_id', contract.id)
        .limit(1)

      if (signedDocs && signedDocs.length > 0) continue // уже загружен

      // Собираем получателей: инициатор + автор + бухгалтеры из согласования
      const { data: participants } = await supabase
        .from('approval_participants')
        .select('bitrix_user_id, stage')
        .eq('session_id', session.id)
        .in('stage', ['accounting', 'finance'])
        .not('bitrix_user_id', 'is', null)

      const accountingIds = participants?.map(p => p.bitrix_user_id).filter(Boolean) ?? []

      const recipients = [...new Set([
        ...(session.initiated_by_bitrix_id ? [session.initiated_by_bitrix_id] : []),
        ...(session.edo_requested_by_id ? [session.edo_requested_by_id] : []),
        ...(contract.author_bitrix_id ? [contract.author_bitrix_id] : []),
        ...accountingIds,
      ])]

      if (recipients.length === 0) continue

      await sendBitrixNotify({
        recipients,
        type: 'edo_reminder',
        document_id: contract.id,
        document_title: contract.title ?? '',
        document_number: contract.number ?? '',
        extra: 'Не забудьте загрузить подписанный через ЭДО документ в систему',
      })

      reminded++
    }

    return NextResponse.json({ success: true, reminded })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}