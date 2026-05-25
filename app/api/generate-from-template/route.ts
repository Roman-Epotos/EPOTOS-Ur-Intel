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

    // 3. Подставляем поля через docxtemplater
    const PizZip = (await import('pizzip')).default
    const Docxtemplater = (await import('docxtemplater')).default

    const zip = new PizZip(buffer)

    // Шаблоны предварительно обработаны скриптом fix_xml.py — дополнительный фикс не нужен

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '____________',
      errorLogging: false,
    })

    try {
      doc.render(fields)
    } catch (renderError: unknown) {
      const errObj = renderError as { properties?: { errors?: unknown[] }; message?: string }
      const errors = errObj?.properties?.errors
      let errorDetails = ''
      if (errors && Array.isArray(errors) && errors.length > 0) {
        const details = errors.map((e: unknown) => {
          const err = e as { properties?: { explanation?: string; tag?: string; xtag?: string } }
          return `tag="${err?.properties?.tag ?? err?.properties?.xtag}" explanation="${err?.properties?.explanation}"`
        })
        errorDetails = details.join('; ')
        console.error('Docxtemplater render errors:', errorDetails)
      }
      console.error('Full render error:', JSON.stringify(errObj))
      throw new Error('Ошибка шаблона: ' + (errorDetails || errObj?.message || 'неизвестная ошибка'))
    }

    const output = doc.getZip().generate({
      type: 'nodebuffer',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    // 4. Логируем генерацию
    if (contract_id) {
      await supabase.from('contract_logs').insert({
        contract_id,
        action: 'Документ сгенерирован из шаблона',
        details: `Шаблон: ${template.name}`,
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