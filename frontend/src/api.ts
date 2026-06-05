import type { Capture, LogEvent } from './types'

async function post(path: string, body: FormData | string, isJson = false) {
  return fetch(path, {
    method: 'POST',
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    body,
  })
}

export async function getCaptures(limit = 20): Promise<Capture[]> {
  const r = await fetch(`/captures?limit=${limit}`)
  return r.json()
}

export async function getCaptureRelated(id: number): Promise<Capture[]> {
  const r = await fetch(`/captures/${id}/related`)
  return r.json()
}

export async function captureText(content: string): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('content', content)
  const r = await post('/capture/text', fd)
  return r.json()
}

export async function captureLink(url: string): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('url', url)
  const r = await post('/capture/link', fd)
  return r.json()
}

export async function captureImage(file: File, description = ''): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('file', file)
  if (description.trim()) fd.append('description', description.trim())
  const r = await post('/capture/image', fd)
  return r.json()
}

export async function getSurface(mode?: string, n = 3): Promise<Capture[]> {
  const params = new URLSearchParams({ n: String(n) })
  if (mode && mode !== 'all') params.set('mode', mode)
  const r = await fetch(`/surface?${params}`)
  return r.json()
}

export async function markDone(id: number): Promise<void> {
  await fetch(`/surface/${id}/done`, { method: 'POST' })
}

export async function markSkip(id: number): Promise<void> {
  await fetch(`/surface/${id}/skip`, { method: 'POST' })
}

export async function logEvent(event: LogEvent): Promise<void> {
  await post('/events', JSON.stringify(event), true).catch(() => {})
}
