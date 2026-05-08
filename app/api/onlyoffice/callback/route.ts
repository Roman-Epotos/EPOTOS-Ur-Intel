import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const version_id = request.nextUrl.searchParams.get('version_id')
    const body = await request.json()

    console.log('OnlyOffice callback:', body.status, 'version_id:', version_id)
    console.log('OnlyOffice body:', JSON.stringify(body))

    // Статусы OnlyOffice:
    // 1 - документ редактируется
    // 2 - документ готов к сохранению
    // 3 - ошибка сохранения
    // 4 - документ закрыт без изменений
    // 6 - принудительное сохранение

    if (body.status === 2 || body.status === 6) {
      if (!body.url || !version_id) {
        return NextResponse.json({ error: 0 })
      }

      // Скачиваем обновлённый файл от OnlyOffice
      const fileResponse = await fetch(body.url)
      const arrayBuffer = await fileResponse.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)

      // Получаем текущую версию
      const { data: version } = await supabase
        .from('versions')
        .select('*')
        .eq('id', version_id)
        .single()

      if (!version) {
        return NextResponse.json({ error: 0 })
      }

      // Загружаем обновлённый файл в Supabase Storage
      const filePath = version.file_url.split('/contracts/')[1]

      const { error: uploadError } = await supabase.storage
        .from('contracts')
        .update(filePath, buffer, {
          contentType: version.file_name.endsWith('.xlsx')
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: true,
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
      } else {
        // Получаем имена пользователей из callback
        const editors = body.users ?? []
        const userNames = editors.length > 0
          ? editors.join(', ')
          : 'Неизвестный пользователь'

        // Записываем в лог
        await supabase.from('contract_logs').insert({
          contract_id: version.contract_id,
          action: 'Документ отредактирован в OnlyOffice',
          details: `Файл: ${version.file_name}. Редактировал(и): ${userNames}`,
          user_name: userNames,
        })
      }
    }

    // OnlyOffice ожидает ответ { error: 0 } для подтверждения
    return NextResponse.json({ error: 0 })
  } catch (err) {
    console.error('Callback error:', err)
    return NextResponse.json({ error: 0 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 0 })
}