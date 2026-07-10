interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number
  label?: string
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = 8000, label = 'external', ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const start = Date.now()

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    const duration = Date.now() - start
    console.log(`[B24_LATENCY] ${label} -> ${response.status} (${duration}ms)`)
    return response
  } catch (err) {
    clearTimeout(timeoutId)
    const duration = Date.now() - start
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[B24_LATENCY] ${label} -> TIMEOUT after ${duration}ms (limit ${timeoutMs}ms)`)
      throw new Error(`Timeout: ${label} did not respond within ${timeoutMs}ms`)
    }
    console.error(`[B24_LATENCY] ${label} -> ERROR after ${duration}ms:`, err instanceof Error ? err.message : err)
    throw err
  }
}