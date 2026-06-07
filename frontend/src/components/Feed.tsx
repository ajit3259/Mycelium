import { useState, useEffect, useCallback } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import { Card } from './Card'

interface Props {
  refreshTrigger: number
  onCountChange?: (n: number) => void
  onPick?: (c: Capture) => void
}

export function Feed({ refreshTrigger, onCountChange, onPick }: Props) {
  const [captures, setCaptures] = useState<Capture[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCaptures()
      setCaptures(data)
      onCountChange?.(data.length)
    }
    finally { setLoading(false) }
  }, [onCountChange])

  useEffect(() => { load() }, [load, refreshTrigger])

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
