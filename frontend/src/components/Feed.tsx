import { useState, useEffect, useRef, useCallback } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import { Card } from './Card'

interface Props {
  refreshTrigger: number
  onCountChange?: (n: number) => void
  onPick?: (c: Capture) => void
  limit?: number
  compact?: boolean
  pinnedCapture?: Capture | null
  onBrowseAll?: () => void
}

export function Feed({ refreshTrigger, onCountChange, onPick, limit = 20, compact = false, pinnedCapture, onBrowseAll }: Props) {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCaptures(compact ? 50 : limit)
      onCountChange?.(data.length)
      setCaptures(compact ? data.slice(0, limit) : data)
      return data
    } finally {
      setLoading(false)
    }
  }, [onCountChange, limit, compact])

  // Auto-poll while any capture is still processing
  const startPolling = useCallback(() => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      const data = await getCaptures(compact ? 50 : limit)
      onCountChange?.(data.length)
      setCaptures(compact ? data.slice(0, limit) : data)
      const stillProcessing = data.some(c => !c.summary)
      if (!stillProcessing) {
        clearInterval(pollRef.current!)
        pollRef.current = null
      }
    }, 3000)
  }, [onCountChange, limit, compact])

  useEffect(() => {
    load().then(data => {
      if (data?.some(c => !c.summary)) startPolling()
    })
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [refreshTrigger])

  // Start polling when a new capture is added (refreshTrigger bumps)
  useEffect(() => {
    if (captures.some(c => !c.summary)) startPolling()
  }, [captures])

  if (compact) {
    return (
      <div>
        {/* Just Added header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <span className="font-mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'var(--ink-soft)',
          }}>
            Just Added
          </span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={load} disabled={loading}
              className="font-mono"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', border: '2px solid var(--line)', background: 'var(--card)',
                color: 'var(--ink)', cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '2px 2px 0 var(--line)', opacity: loading ? 0.5 : 1,
              }}
            >{loading ? '…' : '↻'}</button>
          </div>
        </div>

        {captures.length === 0 && !loading && (
          <div style={{
            border: '2px dashed var(--line)', padding: '28px 0', textAlign: 'center', opacity: 0.4,
          }}>
            <p className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink)', margin: 0 }}>
              Nothing captured yet
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pinnedCapture && (
            <Card
              key={`pinned-${pinnedCapture.id}`}
              capture={pinnedCapture}
              variant="feed"
              onPick={onPick}
              onDelete={id => setCaptures(prev => prev.filter(x => x.id !== id))}
            />
          )}
          {captures.filter(c => c.id !== pinnedCapture?.id).map(c => (
            <Card
              key={c.id}
              capture={c}
              variant="feed"
              onPick={onPick}
              onDelete={id => setCaptures(prev => prev.filter(x => x.id !== id))}
            />
          ))}
        </div>

        {/* Browse all link */}
        {onBrowseAll && (
          <button
            onClick={onBrowseAll}
            className="font-mono"
            style={{
              marginTop: 14, width: '100%',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '10px 0', border: '2px solid var(--line)', background: 'transparent',
              color: 'var(--ink-soft)', cursor: 'pointer',
            }}
          >
            Browse all captures →
          </button>
        )}
      </div>
    )
  }

  // Full feed mode
  return (
    <div>
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Recent{' '}
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            · {captures.length}
          </span>
        </h2>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--ink-soft)' }}>
            live · local-first
          </span>
          <button
            onClick={load} disabled={loading}
            className="font-mono text-[13px] font-bold uppercase tracking-[0.1em] px-4 py-2 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-40"
            style={{ background: 'var(--card)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-1px,-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
          >
            {loading ? '…' : '↻ refresh'}
          </button>
        </div>
      </div>

      {captures.length === 0 && !loading && (
        <div className="border-2 border-dashed border-[var(--line)] py-16 text-center opacity-40">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--ink)' }}>
            Nothing captured yet
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {captures.map(c => (
          <Card
            key={c.id}
            capture={c}
            variant="feed"
            onPick={onPick}
            onDelete={id => setCaptures(prev => prev.filter(x => x.id !== id))}
          />
        ))}
      </div>
    </div>
  )
}
