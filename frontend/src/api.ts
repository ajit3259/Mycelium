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

export async function getCapturesByIntent(intent: string, limit = 50): Promise<Capture[]> {
  const r = await fetch(`/captures?intent=${encodeURIComponent(intent)}&limit=${limit}`)
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

export async function getSurface(mode?: string, n = 3, mood?: string): Promise<Capture[]> {
  const params = new URLSearchParams({ n: String(n) })
  if (mode && mode !== 'all') params.set('mode', mode)
  if (mood) params.set('mood', mood)
  const r = await fetch(`/surface?${params}`)
  return r.json()
}

export async function markDone(id: number): Promise<void> {
  await fetch(`/surface/${id}/done`, { method: 'POST' })
}

export async function markSkip(id: number): Promise<void> {
  await fetch(`/surface/${id}/skip`, { method: 'POST' })
}

export async function deleteCapture(id: number): Promise<void> {
  await fetch(`/captures/${id}`, { method: 'DELETE' })
}

export async function logEvent(event: LogEvent): Promise<void> {
  await post('/events', JSON.stringify(event), true).catch(() => {})
}

export async function patchCapture(id: number, patch: { intent?: string; tags?: string[] }): Promise<void> {
  await fetch(`/captures/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
}

export async function getReviewQueue(limit = 10): Promise<Capture[]> {
  const r = await fetch(`/review?limit=${limit}`)
  return r.json()
}

export async function postReview(id: number, rating: 'got_it' | 'again'): Promise<void> {
  await fetch(`/captures/${id}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  })
}

export async function getReviewHistory(): Promise<{ reviewed_dates: string[]; streak: number }> {
  const r = await fetch('/review/history')
  return r.json()
}

export async function searchCaptures(q: string, limit = 20): Promise<Capture[]> {
  const r = await fetch(`/search?q=${encodeURIComponent(q)}&limit=${limit}`)
  return r.json()
}

export async function getBrief(date?: string): Promise<Record<string, Capture[]>> {
  const url = date ? `/brief?date=${encodeURIComponent(date)}` : '/brief'
  const r = await fetch(url)
  return r.json()
}

export async function getBriefDates(): Promise<{ date: string; count: number }[]> {
  const r = await fetch('/brief/dates')
  return r.json()
}

export async function askSynthesize(query: string, capture_ids: number[]): Promise<{ synthesis: string; tension: string | null }> {
  const r = await fetch('/ask/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, capture_ids }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const text = await r.text()
  if (!text.trim()) throw new Error('Empty response from server')
  return JSON.parse(text)
}

export async function askExtend(query: string, synthesis: string): Promise<{ gap: string; questions: string[] }> {
  const r = await fetch('/ask/extend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, synthesis }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const text = await r.text()
  if (!text.trim()) throw new Error('Empty response')
  return JSON.parse(text)
}
