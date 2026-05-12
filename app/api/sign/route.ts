import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]
const GC_MANAGER_IDS = [1, 246, 504]

// Перевод документа в статус "подписан"
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const contract_id = formData.get('contract_id') as string
    const user_name = formData.get('user_name') as string
    const user_bitrix_id = formData.get('user_bitrix_id') as string
    const action = formData.get('action') as string // 'sign' или 'upload'
    const file = formData.get('file') as File | null

    if (!contract_id || !user_name || !user_bitrix_id) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    const userId = parseInt(user_bitrix_id)

    // Получаем контракт
    const { data: contract } = await supabase
      .from('contracts')
      .select('id, status, author_bitrix_id, initiated_by_bitrix_id')
      .eq('id', contract_id)
      .single()

    if (!contract) {
      return NextResponse.json({ error: 'Документ не найден' }, { status: 404 })
    }

    // Проверяем права: автор, инициатор, admin, gc_manager
    const isAdmin = ADMIN_IDS.includes(userId)
    const isGcManager = GC_MANAGER_IDS.includes(userId)
    const isAuthor = contract.author_bitrix_id === userId

    // Получаем сессию согласования для проверки инициатора
    const { data: session } = await supabase
      .from('approval_sessions')
      .select('initiated_by_bitrix_id')
      .eq('contract_id', contract_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const isInitiator = session?.initiated_by_bitrix_id === userId

    if (!isAdmin && !isGcManager && !isAuthor && !isInitiator) {
      return NextResponse.json({ error: 'Нет прав для подписания документа' }, { status: 403 })
    }

    if (action === 'sign') {
      // Переводим в статус "подписан"
      const { error } = await supabase
        .from('contracts')
        .update({
          status: 'подписан',
          signed_at: new Date().toISOString(),
          signed_by_name: user_name,
          signed_by_bitrix_id: userId,
        })
        .eq('id', contract_id)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      // Записываем в лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Документ подписан',
        details: `Статус изменён на "Подписан"`,
        user_name,
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'upload' && file) {
      // Загружаем подписанный экземпляр
      const safeFileName = file.name.replace(/[а-яёА-ЯЁ\s]/g, (char) => {
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

      const { error: updateError } = await supabase
        .from('contracts')
        .update({
          signed_file_url: urlData.publicUrl,
          signed_file_name: file.name,
          signed_file_uploaded_at: new Date().toISOString(),
          signed_file_uploaded_by: user_name,
        })
        .eq('id', contract_id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 })
      }

      // Записываем в лог
      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Загружен подписанный экземпляр',
        details: `Файл: ${file.name}`,
        user_name,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}