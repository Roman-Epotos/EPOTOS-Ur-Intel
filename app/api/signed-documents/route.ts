import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { sendBitrixNotify, sendBitrixMessage } from '@/app/lib/notify'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]
const GC_MANAGER_IDS = [1, 246, 504]
// Владимиров Вячеслав (Э-К), Виноградова Анна (СПТ, ОС, НПП)
const SPECIAL_SIGNERS: Record<number, string[]> = {
  782: ['Э-К'],
  152: ['СПТ', 'ОС', 'НПП'],
}

function canUploadSigned(
  userId: number,
  authorId: number | null,
  initiatorId: number | null,
  companyPrefix: string
): boolean {
  if (ADMIN_IDS.includes(userId)) return true
  if (GC_MANAGER_IDS.includes(userId)) return true
  if (authorId === userId) return true
  if (initiatorId === userId) return true
  for (const [id, prefixes] of Object.entries(SPECIAL_SIGNERS)) {
    if (parseInt(id) === userId && prefixes.includes(companyPrefix)) return true
  }
  return false
}

// Получить список подписанных документов
export async function GET(request: NextRequest) {
  const contract_id = request.nextUrl.searchParams.get('contract_id')
  if (!contract_id) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('signed_documents')
    .select('*')
    .eq('contract_id', contract_id)
    .order('created_at')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ documents: data ?? [] })
}

// Загрузить подписанный документ
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const contract_id = formData.get('contract_id') as string
    const user_name = formData.get('user_name') as string
    const user_bitrix_id = formData.get('user_bitrix_id') as string
    const confirm_all = formData.get('confirm_all') === 'true'

    if (!contract_id || !user_bitrix_id) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const userId = parseInt(user_bitrix_id)
    const status_only = formData.get('status_only') === 'true'
    const temp_upload = formData.get('temp_upload') === 'true'
    const confirm_upload = formData.get('confirm_upload') === 'true'
    const temp_file_url = formData.get('temp_file_url') as string
    const temp_file_name = formData.get('temp_file_name') as string
    const has_discrepancies = formData.get('has_discrepancies') === 'true'
    const discrepancy_comment = formData.get('discrepancy_comment') as string
    const discrepancy_summary = formData.get('discrepancy_summary') as string

    // Временная загрузка — просто сохраняем файл и возвращаем URL
    if (temp_upload && file) {
      const fileExt = file.name.split('.').pop()
      const tempPath = `temp/${contract_id}/${Date.now()}.${fileExt}`
      const fileBuffer = await file.arrayBuffer()
      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .upload(tempPath, fileBuffer, { contentType: file.type, upsert: true })
      if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(tempPath)
      return NextResponse.json({ success: true, temp_url: urlData.publicUrl })
    }

    // Подтверждение загрузки — сохраняем уже загруженный файл как подписанный
    if (confirm_upload && temp_file_url) {
      // Перемещаем из temp в постоянное хранилище
      const fileExt = temp_file_name.split('.').pop()
      const finalPath = `signed/${contract_id}/${Date.now()}.${fileExt}`
      const tempPath = temp_file_url.split('/contracts/')[1]

      // Копируем файл
      const { error: copyError } = await supabase.storage
        .from('contracts')
        .copy(tempPath, finalPath)

      if (copyError) {
        // Если copy не работает — скачиваем и перезаливаем
        const fileRes = await fetch(temp_file_url)
        const fileBuffer = await fileRes.arrayBuffer()
        await supabase.storage.from('contracts').upload(finalPath, fileBuffer, { upsert: true })
      }

      // Удаляем временный файл
      await supabase.storage.from('contracts').remove([tempPath])

      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(finalPath)
      const finalUrl = urlData.publicUrl

      // Сохраняем в БД
      await supabase.from('signed_documents').insert({
        contract_id,
        file_url: finalUrl,
        file_name: temp_file_name,
        uploaded_by_name: user_name,
        uploaded_by_bitrix_id: userId,
        signed_date: formData.get('signed_date') || null,
        has_discrepancies,
        discrepancy_comment: has_discrepancies ? discrepancy_comment : null,
      })

      // Лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: has_discrepancies ? 'Загружен подписанный документ с расхождениями' : 'Загружен подписанный документ',
        details: has_discrepancies
          ? `Расхождения: ${discrepancy_summary}. Причина загрузки: ${discrepancy_comment}`
          : `Файл: ${temp_file_name}`,
        user_name: user_name ?? 'Пользователь',
      })

      // Обновляем статус договора
      const { data: currentDocs } = await supabase
        .from('signed_documents')
        .select('id')
        .eq('contract_id', contract_id)

      const docsCount = (currentDocs?.length ?? 0)
      const newStatus = docsCount >= 2 ? 'подписан' : 'загружен_частично'
      await supabase.from('contracts').update({ status: newStatus }).eq('id', contract_id)

      // Уведомляем всех участников согласования о загрузке подписанного документа
      const { data: lastSession2 } = await supabase
        .from('approval_sessions')
        .select('id, initiated_by_bitrix_id')
        .eq('contract_id', contract_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (lastSession2) {
        const { data: participantsData2 } = await supabase
          .from('approval_participants')
          .select('bitrix_user_id')
          .eq('session_id', lastSession2.id)
          .not('bitrix_user_id', 'is', null)
        const participantIds2 = participantsData2?.map(p => p.bitrix_user_id).filter(Boolean) ?? []
        const { data: contractData2 } = await supabase
          .from('contracts')
          .select('title, number, author_bitrix_id')
          .eq('id', contract_id)
          .single()
        if (contractData2) {
          const recipients2 = [...new Set([
            ...(contractData2.author_bitrix_id ? [contractData2.author_bitrix_id] : []),
            ...(lastSession2.initiated_by_bitrix_id ? [lastSession2.initiated_by_bitrix_id] : []),
            ...participantIds2,
          ])]
          await sendBitrixNotify({
            recipients: recipients2,
            type: 'documents_uploaded',
            document_id: contract_id,
            document_title: contractData2.title ?? '',
            document_number: contractData2.number ?? '',
          })
        }
      }

      return NextResponse.json({ success: true })
    }

    // Если только обновление статуса — файл не нужен
    if (!status_only && !file) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })
    }

    // Получаем контракт
    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .select('id, status, author_bitrix_id, number')
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: `Документ не найден: ${contractError?.message ?? 'нет данных'}` }, { status: 404 })
    }

    // Извлекаем префикс компании из номера документа (ТХ-ДОГ-2026/... → ТХ)
    const companyPrefix = contract.number?.split('-')[0] ?? ''

    // Получаем инициатора согласования
    const { data: session } = await supabase
      .from('approval_sessions')
      .select('initiated_by_bitrix_id')
      .eq('contract_id', contract_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const initiatorId = session?.initiated_by_bitrix_id ?? null

    // Проверяем права
    if (!canUploadSigned(userId, contract.author_bitrix_id, initiatorId, companyPrefix)) {
      return NextResponse.json({ error: 'Нет прав для загрузки подписанного документа' }, { status: 403 })
    }

    // Если только обновление статуса без загрузки файла — делаем это сразу
    if (status_only && confirm_all) {
      await supabase
        .from('contracts')
        .update({
          status: 'подписан',
          signed_at: new Date().toISOString(),
          signed_by_name: user_name,
          signed_by_bitrix_id: userId,
        })
        .eq('id', contract_id)

      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Все подписанные документы загружены',
        details: 'Статус изменён на "Подписанные документы загружены"',
        user_name: user_name || 'Система',
      })

      // Уведомляем автора и gc_manager
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number, author_bitrix_id')
        .eq('id', contract_id)
        .single()

      if (contractData) {
        // Получаем участников последней сессии согласования
        const { data: lastSession } = await supabase
          .from('approval_sessions')
          .select('id')
          .eq('contract_id', contract_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        let participantIds: number[] = []
        if (lastSession) {
          const { data: participantsData } = await supabase
            .from('approval_participants')
            .select('bitrix_user_id')
            .eq('session_id', lastSession.id)
            .not('bitrix_user_id', 'is', null)
          participantIds = participantsData?.map(p => p.bitrix_user_id).filter(Boolean) ?? []
        }

        const gcManagerIds = [1, 246, 504]
        const recipients = [...new Set([
          ...(contractData.author_bitrix_id ? [contractData.author_bitrix_id] : []),
          ...gcManagerIds,
          ...participantIds,
        ])]
        await sendBitrixNotify({
          recipients,
          type: 'documents_uploaded',
          document_id: contract_id,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
        })
        
      }

      return NextResponse.json({ success: true, status: 'подписан' })
    }

    // Транслитерация имени файла
    const safeFileName = file.name
      .replace(/№/g, 'N')
      .replace(/[а-яёА-ЯЁ\s]/g, (char) => {
      const map: Record<string, string> = {
        'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
        'й':'j','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
        'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
        'э':'e','ю':'yu','я':'ya',' ':'_',
        'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'Zh','З':'Z','И':'I',
        'Й':'J','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T',
        'У':'U','Ф':'F','Х':'H','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Sch','Ъ':'','Ы':'Y','Ь':'',
        'Э':'E','Ю':'Yu','Я':'Ya'
      }
      return map[char] ?? '_'
    })

    const filePath = `signed/${contract_id}/${Date.now()}_${safeFileName}`
    const arrayBuffer = await file.arrayBuffer()

    // Загружаем файл в Storage
    const { error: uploadError } = await supabase.storage
      .from('contracts')
      .upload(filePath, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: urlData } = supabase.storage
      .from('contracts')
      .getPublicUrl(filePath)

    // Сохраняем запись в БД
    const { error: dbError } = await supabase
      .from('signed_documents')
      .insert({
        contract_id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        uploaded_by_name: user_name,
        uploaded_by_bitrix_id: userId,
      })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // Если только обновление статуса без загрузки файла
    if (status_only && confirm_all) {
      await supabase
        .from('contracts')
        .update({
          status: 'подписан',
          signed_at: new Date().toISOString(),
          signed_by_name: user_name,
          signed_by_bitrix_id: userId,
        })
        .eq('id', contract_id)

      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Все подписанные документы загружены',
        details: 'Статус изменён на "Подписанные документы загружены"',
        user_name: user_name || 'Система',
      })

      // Уведомляем автора и gc_manager
      const { data: contractData } = await supabase
        .from('contracts')
        .select('title, number, author_bitrix_id')
        .eq('id', contract_id)
        .single()

      if (contractData) {
        const gcManagerIds = [1, 246, 504]
        const recipients = [...new Set([
          ...(contractData.author_bitrix_id ? [contractData.author_bitrix_id] : []),
          ...gcManagerIds,
        ])]
        await sendBitrixNotify({
          recipients,
          type: 'documents_uploaded',
          document_id: contract_id,
          document_title: contractData.title ?? '',
          document_number: contractData.number ?? '',
        })
        
      }

      return NextResponse.json({ success: true, status: 'подписан' })
    }

    // Определяем новый статус
    let newStatus = 'загружен_частично'
    let logAction = 'Загружен подписанный экземпляр'

    if (confirm_all) {
      newStatus = 'подписан'
      logAction = 'Все подписанные документы загружены'

      await supabase
        .from('contracts')
        .update({
          status: 'подписан',
          signed_at: new Date().toISOString(),
          signed_by_name: user_name,
          signed_by_bitrix_id: userId,
        })
        .eq('id', contract_id)
    } else {
      await supabase
        .from('contracts')
        .update({ status: 'загружен_частично' })
        .eq('id', contract_id)
    }

    // Записываем в лог
    await supabase.from('contract_logs').insert({
      contract_id,
      action: logAction,
      details: `Файл: ${file.name}`,
      user_name: user_name || 'Система',
    })

    return NextResponse.json({ success: true, status: newStatus })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Удалить подписанный документ
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, file_url, contract_id, user_name, user_bitrix_id } = body

    if (!id || !user_bitrix_id) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const userId = parseInt(user_bitrix_id)

    // Только admin и gc_manager могут удалять
    if (!ADMIN_IDS.includes(userId) && !GC_MANAGER_IDS.includes(userId)) {
      return NextResponse.json({ error: 'Нет прав для удаления' }, { status: 403 })
    }

    // Удаляем файл из Storage
    if (file_url) {
      const filePath = file_url.split('/contracts/')[1]
      if (filePath) {
        await supabase.storage.from('contracts').remove([filePath])
      }
    }

    // Удаляем запись из БД
    await supabase.from('signed_documents').delete().eq('id', id)

    // Проверяем остались ли ещё файлы
    const { count } = await supabase
      .from('signed_documents')
      .select('*', { count: 'exact', head: true })
      .eq('contract_id', contract_id)

    // Если файлов не осталось — возвращаем статус согласован
    if (count === 0) {
      await supabase
        .from('contracts')
        .update({ status: 'согласован' })
        .eq('id', contract_id)
    }

    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Удалён подписанный экземпляр',
      details: '',
      user_name: user_name || 'Система',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}