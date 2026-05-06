import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ADMIN_IDS = [30, 1148]

// Получить список шаблонов
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  const company = request.nextUrl.searchParams.get('company')

  let query = supabase
    .from('document_templates')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (type) query = query.eq('type', type)
  if (company) query = query.or(`company_prefix.eq.${company},company_prefix.is.null`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ templates: data ?? [] })
}

// Добавить шаблон (только админы)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const company_prefix = formData.get('company_prefix') as string | null
    const description = formData.get('description') as string | null
    const admin_bitrix_id = parseInt(formData.get('admin_bitrix_id') as string)

    if (!ADMIN_IDS.includes(admin_bitrix_id)) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    if (!file || !name || !type) {
      return NextResponse.json({ error: 'Не все поля заполнены' }, { status: 400 })
    }

    // Загружаем файл в Storage
    const fileExt = file.name.split('.').pop()
    const safeFileName = file.name
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
        return map[char] ?? char
      })
    const safePrefix = (company_prefix ?? 'general')
      .replace(/[а-яёА-ЯЁ]/g, (char) => {
        const map: Record<string, string> = {
          'ТХ':'TX','НПП':'NPP','СПТ':'SPT','ОС':'OS','Э-К':'EK',
          'т':'t','х':'h','н':'n','п':'p','с':'s','о':'o','э':'e','к':'k'
        }
        return map[char] ?? char
      })
      .replace(/[^a-zA-Z0-9_-]/g, '_')
    const filePath = `${safePrefix}/${Date.now()}_${safeFileName}`
    const arrayBuffer = await file.arrayBuffer()

    const { error: uploadError } = await supabase.storage
      .from('templates')
      .upload(filePath, new Uint8Array(arrayBuffer), {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: urlData } = supabase.storage
      .from('templates')
      .getPublicUrl(filePath)

    // Сохраняем метаданные
    const { error: dbError } = await supabase
      .from('document_templates')
      .insert({
        name,
        type,
        company_prefix: company_prefix || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        description: description || null,
      })

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Удалить шаблон (только админы)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, file_url, admin_bitrix_id } = body

    if (!ADMIN_IDS.includes(admin_bitrix_id)) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    // Удаляем файл из Storage
    if (file_url) {
      const filePath = file_url.split('/templates/')[1]
      if (filePath) {
        await supabase.storage.from('templates').remove([filePath])
      }
    }

    const { error } = await supabase
      .from('document_templates')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Обновить метаданные шаблона (только админы)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, name, type, company_prefix, description, is_active, admin_bitrix_id } = body

    if (!ADMIN_IDS.includes(admin_bitrix_id)) {
      return NextResponse.json({ error: 'Нет прав администратора' }, { status: 403 })
    }

    const { error } = await supabase
      .from('document_templates')
      .update({ name, type, company_prefix, description, is_active })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}