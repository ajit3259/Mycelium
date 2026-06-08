export type CaptureType = 'text' | 'link' | 'image'
export type Intent = 'learn' | 'act' | 'reference' | 'ephemeral'
export type Mood = 'focused' | 'curious' | 'restless' | 'tired' | 'inspired'
export type SurfaceMode = 'all' | 'learn' | 'act'

export interface Capture {
  id: number
  type: CaptureType
  raw: string | null
  source_url: string | null
  file_path: string | null
  summary: string | null
  tags: string[]
  intent: Intent | null
  related_ids: number[]
  related?: Capture[]
  created_at: string
  last_surfaced_at: string | null
  reviewed: number
  review_due_at: string | null
  review_interval: number
  review_count: number
  score?: number
  recall_question?: string | null
  title?: string | null
  your_take?: string | null
  claims?: string[]
  source_content_path?: string | null
}

export type NavView = 'home' | 'ask' | 'browse' | 'brief' | 'review' | 'graph'

export interface LogEvent {
  capture_id: number
  event: 'surfaced' | 'skipped' | 'done' | 'dwell'
  value?: string
}
