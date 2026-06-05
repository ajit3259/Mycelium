export type CaptureType = 'text' | 'link' | 'image'
export type Intent = 'learn' | 'act' | 'reference' | 'ephemeral'
export type Mood = 'focused' | 'learning' | 'browsing' | 'bored'
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
}

export interface LogEvent {
  capture_id: number
  event: 'surfaced' | 'skipped' | 'done' | 'dwell'
  value?: string
}
