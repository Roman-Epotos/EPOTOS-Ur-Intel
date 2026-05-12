import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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