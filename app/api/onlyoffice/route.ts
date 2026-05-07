import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import * as jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const ONLYOFFICE_URL = process.env.ONLYOFFICE_URL ?? 'https://office.epotos-port.ru'
const JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET ?? 'epotos_office_secret_2026'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { version_id, user_name, user_id, mode } = body

    if (!version_id) {
      return NextResponse.json({ error: 'version_id обязателен' }, { status: 400 })
    }

    // Получаем версию документа
    const { data: version } = await supabase
      .from('versions')
      .select('*, contracts(id, title, number)')
      .eq('id', version_id)
      .single()

    if (!version) {
      return NextResponse.json({ error: 'Версия не найдена' }, { status: 404 })
    }

    const fileName = version.file_name
    const fileExt = fileName.split('.').pop()?.toLowerCase()

    // Определяем тип документа для OnlyOffice
    const docType = fileExt === 'xlsx' || fileExt === 'xls' ? 'cell' :
                    fileExt === 'docx' || fileExt === 'doc' ? 'word' : 'word'

    const documentKey = `${version_id}_${Date.now()}`

    // Конфигурация OnlyOffice
    const config = {
      document: {
        fileType: fileExt,
        key: documentKey,
        title: fileName,
        url: version.file_url,
        permissions: {
          edit: mode !== 'view',
          download: true,
          print: true,
          review: true,
        },
      },
      documentType: docType,
      editorConfig: {
        mode: mode === 'view' ? 'view' : 'edit',
        lang: 'ru',
        user: {
          id: String(user_id ?? 'guest'),
          name: user_name ?? 'Пользователь',
        },
        customization: {
          autosave: true,
          forcesave: true,
          compactHeader: true,
          toolbarNoTabs: false,
          hideRightMenu: false,
        },
        callbackUrl: `https://epotos-ur-intel.vercel.app/api/onlyoffice/callback?version_id=${version_id}`,
      },
    }

    // Подписываем JWT
    const token = jwt.sign(config, JWT_SECRET, { algorithm: 'HS256' })

    console.log('OnlyOffice config:', JSON.stringify(config))
    console.log('JWT token:', token)

    return NextResponse.json({
      config,
      token,
      onlyofficeUrl: ONLYOFFICE_URL,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}