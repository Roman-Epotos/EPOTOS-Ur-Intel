const baseUrl = 'https://epotos-ur-intel.vercel.app'

function sanitizeFileName(name: string): string {
  return name
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
}

/**
 * Загружает файл напрямую в Supabase Storage через presigned URL
 * Обходит лимит Vercel 4.5 МБ
 */
export async function uploadFileDirect(
  file: File,
  bucket: string,
  folder: string
): Promise<{ public_url: string; file_name: string; path: string }> {
  const safeName = sanitizeFileName(file.name)
  const path = `${folder}/${Date.now()}_${safeName}`

  // Получаем presigned URL от нашего API
  const urlRes = await fetch(`${baseUrl}/api/counterparties/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucket, path }),
  })

  const urlData = await urlRes.json()
  if (!urlRes.ok || urlData.error) {
    throw new Error(urlData.error ?? 'Ошибка получения URL загрузки')
  }

  // Пробуем загрузить напрямую в Supabase (быстро, без лимита Vercel)
  try {
    const uploadRes = await fetch(urlData.signed_url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (uploadRes.ok) {
      return { public_url: urlData.public_url, file_name: safeName, path }
    }
  } catch {
    // Прямая загрузка не удалась — используем proxy
  }

  // Fallback: загружаем через наш Vercel proxy (для России)
  const proxyForm = new FormData()
  proxyForm.append('file', file)
  proxyForm.append('bucket', bucket)
  proxyForm.append('path', path)

  const proxyRes = await fetch(`${baseUrl}/api/upload-proxy`, {
    method: 'POST',
    body: proxyForm,
  })

  const proxyData = await proxyRes.json()
  if (!proxyRes.ok || proxyData.error) {
    throw new Error(proxyData.error ?? 'Ошибка загрузки файла')
  }

  return {
    public_url: proxyData.public_url,
    file_name: safeName,
    path,
  }
}