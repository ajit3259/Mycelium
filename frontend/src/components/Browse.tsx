import { useState, useEffect, useMemo } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import { Card } from './Card'

type IntentFilter = 'all' | 'learn' | 'act' | 'reference' | 'ephemeral'
type TypeFilter  = 'all' | 'text' | 'link' | 'image'

const INTENT_CHIPS: { label: string; value: IntentFilter; bg: string }[] = [
  { label: 'All',       value: 'all',       bg: 'var(--card)' },
  { label: 'Learn',     value: 'learn',     bg: 'var(--learn)' },
  { label: 'Act',       value: 'act',       bg: 'var(--act)' },
  { label: 'Reference', value: 'reference', bg: 'var(--ref)' },
  { label: 'Ephemeral', value: 'ephemeral', bg: 'var(--eph)' },
]

const TYPE_CHIPS: { label: string; value: TypeFilter }[] = [
  { label: 'All',   value: 'all' },
  { label: 'Text',  value: 'text' },
  { label: 'Link',  value: 'link' },
  { label: 'Image', value: 'image' },
]

interface Props {
  onCountChange: (n: number) => void
  onPick?: (c: Capture) => void
}

const PAGE_SIZE = 10

export function Browse({ onCountChange, onPick }: Props) {
  const [all, setAll] = useState<Capture[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [intent, setIntent] = useState<IntentFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    getCaptures(500).then(data => {
      setAll(data)
      onCountChange(data.length)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter(c => {
      if (intent !== 'all' && c.intent !== intent) return false
      if (type !== 'all' && c.type !== type) return false
      if (q) {
        const haystack = [c.summary, c.raw, ...(c.tags ?? [])].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [all, intent, type, query])

  // Reset to page 1 whenever filters change
  useEffect(() => { setPage(1) }, [intent, type, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function Chip({ label, active, bg, onClick }: { label: string; active: boolean; bg?: string; onClick: () => void }) {
    return (
      <button
        onClick={onClick}
        className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1.5 border-2 border-[var(--line)] transition-all duration-100"
        style={{
          background: active ? 'var(--ink)' : (bg ?? 'var(--card)'),
          color: active ? 'var(--paper)' : 'var(--ink)',
          boxShadow: active ? 'var(--shadow-sm)' : 'none',
          transform: active ? 'translate(-1px,-1px)' : '',
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Browse{' '}
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            · {filtered.length}{all.length !== filtered.length ? ` of ${all.length}` : ''}
          </span>
        </h2>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14, border: '2px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
        <span className="font-mono" style={{ padding: '0 12px', fontSize: 14, color: 'var(--ink-soft)', flexShrink: 0 }}>⌕</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search summaries and tags…"
          style={{
            flex: 1, border: 'none', outline: 'none', padding: '10px 12px 10px 0',
            fontSize: 15, background: 'transparent', color: 'var(--ink)',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="font-mono"
            style={{ padding: '0 12px', fontSize: 12, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Intent filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {INTENT_CHIPS.map(c => (
          <Chip key={c.value} label={c.label} active={intent === c.value} bg={c.bg} onClick={() => setIntent(c.value)} />
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {TYPE_CHIPS.map(c => (
          <Chip key={c.value} label={c.value === 'all' ? 'All types' : c.label} active={type === c.value} onClick={() => setType(c.value)} />
        ))}
      </div>

      {/* Results */}
      {loading && (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>
          Loading…
        </p>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ border: '2px dashed var(--line)', padding: '48px 0', textAlign: 'center', opacity: 0.4 }}>
          <p className="font-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink)' }}>
            No captures match
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {paginated.map(c => <Card key={c.id} capture={c} variant="feed" onPick={onPick} />)}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, gap: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-30"
            style={{ background: 'var(--card)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)', cursor: page === 1 ? 'default' : 'pointer' }}
            onMouseEnter={e => { if (page > 1) { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-1px,-1px)' }}}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
          >
            ← prev
          </button>

          <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '0.1em' }}>
            {page} / {totalPages}
          </span>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-30"
            style={{ background: 'var(--card)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)', cursor: page === totalPages ? 'default' : 'pointer' }}
            onMouseEnter={e => { if (page < totalPages) { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-1px,-1px)' }}}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
          >
            next →
          </button>
        </div>
      )}
    </div>
  )
}
