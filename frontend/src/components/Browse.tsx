import { useState, useEffect, useMemo } from 'react'
import type { Capture } from '../types'
import { getCaptures } from '../api'
import { Card } from './Card'

type IntentFilter = 'all' | 'learn' | 'act' | 'reference' | 'ephemeral'
type TypeFilter = 'all' | 'text' | 'link' | 'image'
type SortMode = 'newest' | 'oldest' | 'review_due'

const INTENT_CHIPS: { label: string; value: IntentFilter; bg: string }[] = [
  { label: 'All',       value: 'all',       bg: 'var(--card)' },
  { label: 'Learn',     value: 'learn',     bg: 'var(--learn)' },
  { label: 'Act',       value: 'act',       bg: 'var(--act)' },
  { label: 'Reference', value: 'reference', bg: 'var(--ref)' },
  { label: 'Ephemeral', value: 'ephemeral', bg: 'var(--eph)' },
]

const TYPE_CHIPS: { label: string; value: TypeFilter }[] = [
  { label: 'All types', value: 'all' },
  { label: 'Text',      value: 'text' },
  { label: 'Link',      value: 'link' },
  { label: 'Image',     value: 'image' },
]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['S','M','T','W','T','F','S']

function CalendarHeatmap({
  captures,
  selectedDate,
  onSelectDate,
}: {
  captures: Capture[]
  selectedDate: string | null
  onSelectDate: (d: string | null) => void
}) {
  const today = new Date()

  // Build date → count map
  const countByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of captures) {
      const d = c.created_at?.slice(0, 10)
      if (d) map.set(d, (map.get(d) ?? 0) + 1)
    }
    return map
  }, [captures])

  const maxCount = useMemo(() => Math.max(1, ...countByDate.values()), [countByDate])

  // Last 3 months including current
  const months = useMemo(() => {
    const result = []
    for (let i = 2; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() })
    }
    return result
  }, [])

  const SZ = 14
  const GAP = 3

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {months.map(({ year, month }) => {
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const firstDay = new Date(year, month, 1).getDay()
          const cells: (string | null)[] = Array(firstDay).fill(null)
          for (let d = 1; d <= daysInMonth; d++) {
            const mm = String(month + 1).padStart(2, '0')
            const dd = String(d).padStart(2, '0')
            cells.push(`${year}-${mm}-${dd}`)
          }
          // pad to full week
          while (cells.length % 7 !== 0) cells.push(null)

          return (
            <div key={`${year}-${month}`}>
              <div className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 6 }}>
                {MONTH_NAMES[month]} {year}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${SZ}px)`, gap: GAP }}>
                {DAY_LABELS.map((l, i) => (
                  <div key={i} className="font-mono" style={{ fontSize: 8, fontWeight: 700, textAlign: 'center', color: 'var(--ink-soft)', opacity: 0.5, marginBottom: 1 }}>
                    {l}
                  </div>
                ))}
                {cells.map((date, i) => {
                  if (!date) return <div key={i} style={{ width: SZ, height: SZ }} />
                  const count = countByDate.get(date) ?? 0
                  const intensity = count === 0 ? 0 : Math.min(1, 0.25 + (count / maxCount) * 0.75)
                  const isSelected = date === selectedDate
                  const todayStr = today.toISOString().slice(0, 10)
                  const isToday = date === todayStr
                  return (
                    <div
                      key={i}
                      title={`${date} · ${count} capture${count !== 1 ? 's' : ''}`}
                      onClick={() => onSelectDate(isSelected ? null : date)}
                      style={{
                        width: SZ, height: SZ,
                        background: count === 0 ? 'var(--card)' : `var(--learn)`,
                        opacity: count === 0 ? 0.25 : intensity,
                        border: isSelected
                          ? '2px solid var(--ink)'
                          : isToday
                            ? '2px solid var(--ink-soft)'
                            : '1px solid var(--line)',
                        cursor: count > 0 ? 'pointer' : 'default',
                        transition: 'transform 0.08s',
                        transform: isSelected ? 'scale(1.2)' : 'none',
                      }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Active filter badge */}
      {selectedDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', padding: '3px 8px', background: 'var(--learn)', border: '2px solid var(--line)', boxShadow: '2px 2px 0 var(--line)' }}>
            {selectedDate} · {countByDate.get(selectedDate) ?? 0} capture{(countByDate.get(selectedDate) ?? 0) !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => onSelectDate(null)}
            className="font-mono"
            style={{ fontSize: 10, fontWeight: 700, background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            clear ✕
          </button>
        </div>
      )}
    </div>
  )
}

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
  const [sort, setSort] = useState<SortMode>('newest')
  const [neverReviewed, setNeverReviewed] = useState(false)
  const [dateFilter, setDateFilter] = useState<string | null>(null)
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
      if (neverReviewed && (c.review_count ?? 0) > 0) return false
      if (dateFilter && c.created_at?.slice(0, 10) !== dateFilter) return false
      if (q) {
        const haystack = [c.summary, c.raw, ...(c.tags ?? [])].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [all, intent, type, neverReviewed, dateFilter, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'oldest') arr.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    else if (sort === 'review_due') arr.sort((a, b) => {
      const ad = a.review_due_at ?? '9999-99-99'
      const bd = b.review_due_at ?? '9999-99-99'
      return ad.localeCompare(bd)
    })
    return arr
  }, [filtered, sort])

  useEffect(() => { setPage(1) }, [intent, type, neverReviewed, dateFilter, query, sort])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="font-bold" style={{ fontSize: 22, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
          Browse{' '}
          <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            · {filtered.length}{all.length !== filtered.length ? ` of ${all.length}` : ''}
          </span>
        </h2>
      </div>

      {/* Calendar heatmap */}
      {!loading && all.length > 0 && (
        <CalendarHeatmap captures={all} selectedDate={dateFilter} onSelectDate={setDateFilter} />
      )}

      {/* Search */}
      <div style={{ marginBottom: 12, border: '2px solid var(--line)', background: 'var(--card)', display: 'flex', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
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
          <button onClick={() => setQuery('')} className="font-mono" style={{ padding: '0 12px', fontSize: 12, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
      </div>

      {/* Intent filter row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {INTENT_CHIPS.map(c => (
          <Chip key={c.value} label={c.label} active={intent === c.value} bg={c.bg} onClick={() => setIntent(c.value)} />
        ))}
        {/* Never reviewed toggle */}
        <div style={{ marginLeft: 'auto' }}>
          <Chip
            label="Never reviewed"
            active={neverReviewed}
            onClick={() => setNeverReviewed(v => !v)}
          />
        </div>
      </div>

      {/* Type filter + sort row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        {TYPE_CHIPS.map(c => (
          <Chip key={c.value} label={c.label} active={type === c.value} onClick={() => setType(c.value)} />
        ))}

        {/* Sort selector */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>Sort</span>
          {(['newest', 'oldest', 'review_due'] as SortMode[]).map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className="font-mono"
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                padding: '4px 10px', border: '2px solid var(--line)',
                background: sort === s ? 'var(--ink)' : 'var(--card)',
                color: sort === s ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
                boxShadow: sort === s ? 'var(--shadow-sm)' : 'none',
                transform: sort === s ? 'translate(-1px,-1px)' : '',
                transition: 'all 0.08s',
              }}
            >
              {s === 'newest' ? '↓ Newest' : s === 'oldest' ? '↑ Oldest' : '⏰ Due'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading && (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center', padding: '40px 0' }}>Loading…</p>
      )}

      {!loading && sorted.length === 0 && (
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
