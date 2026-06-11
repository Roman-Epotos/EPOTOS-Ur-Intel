const baseUrl = 'https://epotos-ur-intel.vercel.app'

/**
 * Проксирует ссылки на Supabase Storage через наш Vercel
 * для обхода блокировок AWS в России
 */
export function proxyUrl(url: string | null | undefined): string {
  if (!url) return ''
  // Если уже проксированная или не Supabase — возвращаем как есть
  if (url.includes('/api/file-proxy') || !url.includes('supabase.co')) return url
  return `${baseUrl}/api/file-proxy?url=${encodeURIComponent(url)}`
}