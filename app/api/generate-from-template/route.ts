import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { template_id, fields, contract_id } = body

    if (!template_id || !fields) {
      return NextResponse.json({ error: 'template_id и fields обязательны' }, { status: 400 })
    }

    // 1. Получаем шаблон из БД
    const { data: template, error: tplError } = await supabase
      .from('document_templates')
      .select('*')
      .eq('id', template_id)
      .eq('is_active', true)
      .single()

    if (tplError || !template) {
      return NextResponse.json({ error: 'Шаблон не найден' }, { status: 404 })
    }

    // 2. Скачиваем .docx шаблон из Supabase Storage
    const fileRes = await fetch(template.file_url)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Не удалось загрузить файл шаблона' }, { status: 500 })
    }
    const arrayBuffer = await fileRes.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Простая замена меток {{field}} в XML напрямую
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buffer)

    // Безопасные значения полей
    const safeFields: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields as Record<string, unknown>)) {
      safeFields[k] = (v !== undefined && v !== null && v !== '') ? String(v) : '____________'
    }

    // Заменяем метки во всех XML файлах документа
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/footer1.xml',
                      'word/header2.xml', 'word/footer2.xml', 'word/header3.xml', 'word/footer3.xml']

    for (const xmlFile of xmlFiles) {
      const file = zip.file(xmlFile)
      if (!file) continue
      let content = await file.async('string')
      // Заменяем каждую метку
      for (const [key, value] of Object.entries(safeFields)) {
        content = content.split(`{{${key}}}`).join(value)
      }
      zip.file(xmlFile, content)
    }

    const output = await zip.generateAsync({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    // 4. Логируем генерацию
    if (contract_id) {
      await supabase.from('contract_logs').insert({
        contract_id,
        action: `Сгенерирован документ из шаблона: ${template.name}`,
        details: `Файл: ${template.name}.docx`,
        user_name: body.user_name ?? 'Пользователь',
      })
    }

    // 5. Возвращаем файл
    return new NextResponse(new Uint8Array(output), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(template.name)}.docx"`,
      },
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    console.error('generate-from-template error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET — список шаблонов для компании и типа документа
export async function GET(request: NextRequest) {
  try {
    const companyPrefix = request.nextUrl.searchParams.get('company_prefix')
    const docType = request.nextUrl.searchParams.get('type')

    let query = supabase
      .from('document_templates')
      .select('id, name, type, company_prefix, file_name, created_at')
      .eq('is_active', true)
      .order('name')

    if (companyPrefix) {
      query = query.or(`company_prefix.eq.${companyPrefix},company_prefix.is.null`)
    }
    if (docType) {
      query = query.eq('type', docType)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ templates: data ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}