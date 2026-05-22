import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendBitrixNotify, createBitrixChat } from '@/app/lib/notify'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

// Запуск согласования
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      contract_id,
      participants,
      deadline,
      initiated_by_name,
      initiated_by_bitrix_id,
    } = body

    if (!contract_id || !participants || !deadline) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Создаём сессию согласования
    const { data: session, error: sessionError } = await supabase
      .from('approval_sessions')
      .insert({
        contract_id,
        deadline,
        initiated_by_name: initiated_by_name ?? 'Система',
        initiated_by_bitrix_id: initiated_by_bitrix_id ?? null,
        status: 'active',
      })
      .select('id')
      .single()

    if (sessionError) {
      return NextResponse.json({ error: sessionError.message }, { status: 400 })
    }

    // Дедупликация — убираем дубли по bitrix_user_id (оставляем первого)
    const seenUserIds = new Set<number>()
    const uniqueParticipants = participants.filter((p: { bitrix_user_id?: number }) => {
      if (!p.bitrix_user_id) return true
      if (seenUserIds.has(p.bitrix_user_id)) return false
      seenUserIds.add(p.bitrix_user_id)
      return true
    })

    // Добавляем участников
    const participantsToInsert = uniqueParticipants.map((p: {
      user_name: string
      bitrix_user_id?: number
      department?: string
      role: string
      stage: string
    }) => ({
      session_id: session.id,
      user_name: p.user_name,
      bitrix_user_id: p.bitrix_user_id ?? null,
      department: p.department ?? null,
      role: p.role,
      stage: p.stage,
      status: 'pending',
    }))

    const { error: participantsError } = await supabase
      .from('approval_participants')
      .insert(participantsToInsert)

    if (participantsError) {
      return NextResponse.json({ error: participantsError.message }, { status: 400 })
    }

    // Обновляем статус договора
    await supabase
      .from('contracts')
      .update({ status: 'на_согласовании' })
      .eq('id', contract_id)

    // Записываем в лог
    await supabase
      .from('contract_logs')
      .insert({
        contract_id,
        action: 'Согласование запущено',
        details: `Запущено согласование. Участников: ${participants.length}. Дедлайн: ${deadline}.`,
        user_name: initiated_by_name ?? 'Система',
      })

    // Получаем данные договора
    const { data: contractInfo } = await supabase
      .from('contracts')
      .select('title, number, author_bitrix_id')
      .eq('id', contract_id)
      .single()

    // Создаём групповой чат Битрикс24
    const chatMemberIds = [...new Set([
      ...(contractInfo?.author_bitrix_id ? [contractInfo.author_bitrix_id] : []),
      ...participants
        .filter((p: { bitrix_user_id?: number }) => p.bitrix_user_id)
        .map((p: { bitrix_user_id: number }) => p.bitrix_user_id),
    ])]
    if (chatMemberIds.length > 0 && contractInfo) {
      const chatId = await createBitrixChat({
        document_number: contractInfo.number ?? '',
        document_title: contractInfo.title ?? '',
        member_ids: chatMemberIds,
      })
      if (chatId) {
        await supabase
          .from('approval_sessions')
          .update({ bitrix_chat_id: chatId })
          .eq('id', session.id)
      }
    }

    // Уведомляем участников о необходимости согласования
    const participantIds = participants
      .filter((p: { bitrix_user_id?: number }) => p.bitrix_user_id)
      .map((p: { bitrix_user_id: number }) => p.bitrix_user_id)

    if (participantIds.length > 0 && contractInfo) {
      await sendBitrixNotify({
        recipients: participantIds,
        type: 'approval_required',
        document_id: contract_id,
        document_title: contractInfo.title ?? '',
        document_number: contractInfo.number ?? '',
      })
    }

    return NextResponse.json({ success: true, session_id: session.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Получение сессии согласования
export async function GET(request: NextRequest) {
  try {
    const contractId = request.nextUrl.searchParams.get('contract_id')
    if (!contractId) {
      return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
    }

    const { data: session, error } = await supabase
      .from('approval_sessions')
      .select(`
        *,
        approval_participants (*),
        approval_messages (created_at, id, author_name, bitrix_user_id, message, is_ai, session_id, file_url, file_name, file_type)
      `)
      .eq('contract_id', contractId)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ session: session ?? null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}