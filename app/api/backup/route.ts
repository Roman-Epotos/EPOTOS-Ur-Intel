import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

const YANDEX_TOKEN = process.env.YANDEX_DISK_TOKEN!
const BACKUP_FOLDER = 'disk:/ЭПОТОС-Бэкап'

const TABLES = [
  'contracts', 'versions', 'approval_sessions', 'approval_participants',
  'approval_messages', 'approval_settings', 'contract_logs',
  'document_attachments', 'signed_documents', 'document_templates',
  'ai_analysis', 'company_requisites', 'contract_checklist',
  'contract_checklist_archive',
]

async function ensureFolder() {
  await fetch(`https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(BACKUP_FOLDER)}`, {
    method: 'PUT',
    headers: { 'Authorization': `OAuth ${YANDEX_TOKEN}` },
  })
}

async function uploadToYandex(fileName: string, content: string) {
  // Получаем URL для загрузки
  const urlRes = await fetch(
    `https://cloud-api.yandex.net/v1/disk/resources/upload?path=${encodeURIComponent(`${BACKUP_FOLDER}/${fileName}`)}&overwrite=true`,
    { headers: { 'Authorization': `OAuth ${YANDEX_TOKEN}` } }
  )
  const urlData = await urlRes.json()
  if (!urlData.href) throw new Error('Не удалось получить URL загрузки: ' + JSON.stringify(urlData))

  // Загружаем файл
  const uploadRes = await fetch(urlData.href, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: content,
  })

  if (!uploadRes.ok) throw new Error(`Ошибка загрузки: ${uploadRes.status}`)
}

export async function GET() {
  try {
    // Проверяем наличие токена
    if (!YANDEX_TOKEN) {
      return NextResponse.json({ error: 'YANDEX_DISK_TOKEN не задан' }, { status: 500 })
    }

    // Создаём папку если не существует
    await ensureFolder()

    // Выгружаем все таблицы
    const backup: Record<string, unknown[]> = {}
    const errors: string[] = []

    for (const table of TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*')
        if (error) {
          errors.push(`${table}: ${error.message}`)
          backup[table] = []
        } else {
          backup[table] = data ?? []
        }
      } catch (err) {
        errors.push(`${table}: ${err instanceof Error ? err.message : 'unknown'}`)
        backup[table] = []
      }
    }

    // Формируем файл бэкапа
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '-')
    const fileName = `backup_${dateStr}_${timeStr}.json`

    const backupData = {
      created_at: now.toISOString(),
      tables_count: TABLES.length,
      errors: errors.length > 0 ? errors : null,
      data: backup,
    }

    await uploadToYandex(fileName, JSON.stringify(backupData, null, 2))

    return NextResponse.json({
      success: true,
      file: fileName,
      tables: TABLES.length,
      errors: errors.length > 0 ? errors : null,
    })

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}