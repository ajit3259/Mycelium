import { useState, useEffect } from 'react'
import type { Capture, Mood, SurfaceMode } from '../types'
import { getSurface } from '../api'
import { Card } from './Card'

interface Props {
  pinnedCapture?: Capture | null
  onPick?: (c: Capture) => void
  mood?: Mood | ''
}

export function SurfacePanel({ pinnedCapture, onPick, mood }: Props) {
  const [queue, setQueue] = useState<Capture[]>([])
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<SurfaceMode | null>(null)

  // When a card is picked from Feed/Browse, surface it immediately
  useEffect(() => {
    if (!pinnedCapture) return
    setQueue(prev => {
      // Don't duplicate if already in queue
      if (prev.some(c => c.id === pinnedCapture.id)) return [pinnedCapture, ...prev.filter(c => c.id !== pinnedCapture.id)]
      return [pinnedCapture, ...prev]
    })
    setActiveMode('all')
  }, [pinnedCapture])

  async function surface(mode: SurfaceMode) {
    setLoading(true); setActiveMode(mode)
    try { setQueue(await getSurface(mode === 'all' ? undefined : mode, 3, mood || undefined)) }
    finally { setLoading(false) }
  }

  // Show one at a time — Done/Skip removes head of queue
  function advance() {
    setQueue(prev => prev.slice(1))
  }

  const current = queue[0] ?? null
  const remaining = queue.length

  return (
    <div>
      {/* Header row: label + filter chips */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{ color: 'var(--ink-soft)' }}
        >
          What should I look at?
        </span>
        <div className="flex gap-2 ml-auto">
          {(['learn', 'act'] as SurfaceMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => surface(mode)}
              disabled={loading}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1.5 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-40"
              style={{
                background: activeMode === mode ? 'var(--ink)' : (mode === 'learn' ? 'var(--learn)' : 'var(--act)'),
                color: activeMode === mode ? 'var(--paper)' : 'var(--ink)',
                boxShadow: '2px 2px 0 var(--line)',
              }}
            >
              {loading && activeMode === mode ? '…' : mode.toUpperCase()}
            </button>
          ))}
          <button
            onClick={() => surface('all')}
            disabled={loading}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1.5 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-40"
            style={{
              background: activeMode === 'all' ? 'var(--ink)' : 'var(--card)',
              color: activeMode === 'all' ? 'var(--paper)' : 'var(--ink)',
              boxShadow: '2px 2px 0 var(--line)',
            }}
          >
            {loading && activeMode === 'all' ? '…' : 'ALL'}
          </button>
        </div>
      </div>

      {/* One card at a time */}
      {current && (
        <div>
          {remaining > 1 && (
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--ink-soft)' }}>
              {remaining} remaining
            </p>
          )}
          <Card key={current.id} capture={current} variant="surface" onAction={advance} onPick={onPick} />
        </div>
      )}

      {!loading && activeMode !== null && !current && (
        <div className="border-2 border-dashed border-[var(--line)] py-8 text-center" style={{ opacity: 0.6 }}>
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink)' }}>
            All clear ✦
          </p>
        </div>
      )}
    </div>
  )
}
