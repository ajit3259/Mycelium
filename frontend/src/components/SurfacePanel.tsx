import { useState, useEffect, useRef } from 'react'
import type { Capture, Mood, SurfaceMode } from '../types'
import { getSurface } from '../api'
import { Card } from './Card'

interface Props {
  onPick?: (c: Capture) => void
  mood?: Mood | ''
}

export function SurfacePanel({ onPick, mood }: Props) {
  const [queue, setQueue] = useState<Capture[]>([])
  const [loading, setLoading] = useState(false)
  const [activeMode, setActiveMode] = useState<SurfaceMode>('all')
  const mountedRef = useRef(false)

  async function surface(mode: SurfaceMode) {
    setLoading(true)
    setActiveMode(mode)
    try {
      setQueue(await getSurface(mode === 'all' ? undefined : mode, 3, mood || undefined))
    } finally {
      setLoading(false)
    }
  }

  // Auto-surface on mount
  useEffect(() => { surface('all') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-surface when mood changes (skip first render)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    surface(activeMode)
  }, [mood]) // eslint-disable-line react-hooks/exhaustive-deps

  function advance() {
    setQueue(prev => prev.slice(1))
  }

  const current = queue[0] ?? null
  const remaining = queue.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span className="font-mono" style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
          textTransform: 'uppercase', color: 'var(--ink-soft)',
        }}>
          Today's Focus
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['learn', 'act', 'all'] as SurfaceMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => surface(mode)}
              disabled={loading}
              className="font-mono"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '4px 10px', border: '2px solid var(--line)',
                background: activeMode === mode ? 'var(--ink)' : 'var(--card)',
                color: activeMode === mode ? 'var(--paper)' : 'var(--ink)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                boxShadow: activeMode === mode ? 'none' : '2px 2px 0 var(--line)',
              }}
            >
              {loading && activeMode === mode ? '…' : mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !current && (
        <div style={{
          border: 'var(--bw) solid var(--line)', background: 'var(--card)',
          padding: '20px 18px', opacity: 0.4,
        }}>
          <div style={{ height: 12, background: 'var(--line)', borderRadius: 2, width: '60%', marginBottom: 10 }} />
          <div style={{ height: 10, background: 'var(--line)', borderRadius: 2, width: '85%', marginBottom: 8 }} />
          <div style={{ height: 10, background: 'var(--line)', borderRadius: 2, width: '40%' }} />
        </div>
      )}

      {/* Current card */}
      {current && (
        <div style={{ animation: 'pop-in .15s ease both' }}>
          {remaining > 1 && (
            <div className="font-mono" style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: 'var(--ink-soft)',
              marginBottom: 8,
            }}>
              {remaining} queued · <span
                style={{ cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => surface(activeMode)}
              >shuffle</span>
            </div>
          )}
          <Card key={current.id} capture={current} variant="surface" onAction={advance} onPick={onPick} />
        </div>
      )}

      {/* All done state */}
      {!loading && queue.length === 0 && (
        <div style={{
          border: '2px dashed var(--line)', padding: '28px 0', textAlign: 'center',
        }}>
          <p className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', margin: 0 }}>
            All clear ✦
          </p>
          <button
            onClick={() => surface(activeMode)}
            className="font-mono"
            style={{
              marginTop: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '5px 12px', border: '2px solid var(--line)', background: 'var(--card)',
              color: 'var(--ink)', cursor: 'pointer', boxShadow: '2px 2px 0 var(--line)',
            }}
          >↺ Resurface</button>
        </div>
      )}
    </div>
  )
}
