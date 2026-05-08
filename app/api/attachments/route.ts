import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(request: NextRequest) {
  const contract_id = request.nextUrl.searchParams.get('contract_id')
  if (!contract_id) {
    return NextResponse.json({ error: 'contract_id обязателен' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('document_attachments')
    .select('*')
    .eq('contract_id', contract_id)
    .order('attachment_type')
    .order('number')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ attachments: data ?? [] })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const contract_id = formData.get('contract_id') as string
    const attachment_type = formData.get('attachment_type') as string
    const title = formData.get('title') as string
    const comment = formData.get('comment') as string
    const user_name = formData.get('user_name') as string
    const user_bitrix_id = formData.get('user_bitrix_id') as string

    if (!file || !contract_id || !attachment_type) {
      return NextResponse.json({ error: 'Не все параметры переданы' }, { status: 400 })
    }

    // Получаем следующий номер для данного типа
    const { count } = await supabase
      .from('document_attachments')
      .select('*', { count: 'exact', head: true })
      .eq('contract_id', contract_id)
      .eq('attachment_type', attachment_type)

    const nextNumber = (count ?? 0) + 1

    // Транслитерация имени файла
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

    const safeType = attachment_type.replace(/[а-яёА-ЯЁ\s]/g, (char) => {
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
    const filePath = `attachments/${contract_id}/${safeType}_${nextNumber}_${Date.now()}_${safeFileName}`
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

    const { error: dbError } = await supabase
      .from('document_attachments')
      .insert({
        contract_id,
        attachment_type,
        number: nextNumber,
        title: title || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        comment: comment || null,
        uploaded_by_name: user_name || null,
        uploaded_by_bitrix_id: user_bitrix_id ? parseInt(user_bitrix_id) : null,
      })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    // Записываем в лог
    await supabase.from('contract_logs').insert({
      contract_id,
      action: `Загружено: ${attachment_type} №${nextNumber}`,
      details: `Файл: ${file.name}${comment ? '. ' + comment : ''}`,
      user_name: user_name || 'Система',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, file_url, contract_id, user_name } = body

    if (!id) {
      return NextResponse.json({ error: 'id обязателен' }, { status: 400 })
    }

    // Удаляем файл из Storage
    if (file_url) {
      const filePath = file_url.split('/contracts/')[1]
      if (filePath) {
        await supabase.storage.from('contracts').remove([filePath])
      }
    }

    const { error } = await supabase
      .from('document_attachments')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await supabase.from('contract_logs').insert({
      contract_id,
      action: 'Дополнительный материал удалён',
      details: `Файл удалён`,
      user_name: user_name || 'Система',
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}