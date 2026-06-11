export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data, error } = await supabase
      .from('counterparty_documents')
      .select('*')
      .eq('counterparty_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ documents: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const category = formData.get('category') as string ?? 'other'

    if (!file) return NextResponse.json({ error: 'Файл не передан' }, { status: 400 })

    // Загружаем в Supabase Storage
    const fileExt = file.name.split('.').pop()
    const safeName = file.name
      .replace(/[а-яёА-ЯЁ]/g, (c: string) => {
        const map: Record<string, string> = {
          'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
          'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
          'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
          'э':'e','ю':'yu','я':'ya','А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo',
          'Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P',
          'Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'H','Ц':'Ts','Ч':'Ch','Ш':'Sh',
          'Щ':'Sch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya'
        }
        return map[c] ?? c
      })
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
    const fileName = `${id}/${category}/${Date.now()}_${safeName}`
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabase.storage
      .from('counterparty-docs')
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    // Получаем публичный URL
    const { data: urlData } = supabase.storage
      .from('counterparty-docs')
      .getPublicUrl(fileName)

    // Сохраняем в БД
    const { data, error } = await supabase
      .from('counterparty_documents')
      .insert({
        counterparty_id: id,
        category,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: fileExt ?? '',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, document: data })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params
    const docId = request.nextUrl.searchParams.get('doc_id')
    if (!docId) return NextResponse.json({ error: 'doc_id не указан' }, { status: 400 })

    // Получаем запись чтобы удалить файл из Storage
    const { data: doc } = await supabase
      .from('counterparty_documents')
      .select('file_url')
      .eq('id', docId)
      .single()

    if (doc?.file_url) {
      // Извлекаем путь из URL
      const url = new URL(doc.file_url)
      const path = url.pathname.split('/counterparty-docs/')[1]
      if (path) {
        await supabase.storage.from('counterparty-docs').remove([path])
      }
    }

    const { error } = await supabase
      .from('counterparty_documents')
      .delete()
      .eq('id', docId)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })

  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Ошибка' }, { status: 500 })
  }
}