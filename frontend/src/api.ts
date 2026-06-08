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

export async function captureText(content: string, yourTake = ''): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('content', content)
  if (yourTake.trim()) fd.append('your_take', yourTake.trim())
  const r = await post('/capture/text', fd)
  return r.json()
}

export async function captureLink(url: string, yourTake = ''): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('url', url)
  if (yourTake.trim()) fd.append('your_take', yourTake.trim())
  const r = await post('/capture/link', fd)
  return r.json()
}

export async function captureImage(file: File, description = '', yourTake = ''): Promise<{ id: number }> {
  const fd = new FormData()
  fd.append('file', file)
  if (description.trim()) fd.append('description', description.trim())
  if (yourTake.trim()) fd.append('your_take', yourTake.trim())
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

export async function askFeynman(query: string, capture_ids: number[]): Promise<{ questions: string[] }> {
  const r = await fetch('/ask/feynman', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, capture_ids }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function askFeynmanGrade(
  qa_pairs: { question: string; answer: string }[],
  capture_ids: number[],
): Promise<{ grades: { verdict: string; feedback: string }[] }> {
  const r = await fetch('/ask/feynman/grade', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qa_pairs, capture_ids }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function askArc(
  query: string,
  capture_ids: number[],
): Promise<{ periods: { label: string; start_date: string; end_date: string; insight: string; capture_count: number }[] }> {
  const r = await fetch('/ask/arc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, capture_ids }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function getBriefWeek(): Promise<Capture[]> {
  const r = await fetch('/brief/week')
  return r.json()
}

export async function briefWeeklySynthesize(
  daily_entries: { date: string; synthesis: string; count: number }[],
): Promise<{ synthesis: string }> {
  const r = await fetch('/brief/week/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_entries }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

export async function briefSynthesize(capture_ids: number[], date_label?: string): Promise<{ synthesis: string }> {
  const r = await fetch('/brief/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ capture_ids, date_label }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
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
