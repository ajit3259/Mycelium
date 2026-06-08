import { useState, useEffect } from 'react'
import type { Capture } from '../types'
import { getBrief, getBriefDates } from '../api'
import { Card } from './Card'

const INTENT_ACCENT: Record<string, string> = {
  learn:     'var(--learn)',
  act:       'var(--act)',
  reference: 'var(--ref)',
  ephemeral: 'var(--eph)',
  other:     'var(--paper)',
}

const INTENT_VERB: Record<string, string> = {
  learn:     'Learning',
  act:       'To do',
  reference: 'Reference',
  ephemeral: 'Fleeting',
  other:     'Other',
}

function groupReason(intent: string, items: Capture[]): string {
  // pull top tags across items, deduplicated
  const tagCounts: Record<string, number> = {}
  for (const c of items) {
    for (const t of c.tags ?? []) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t)

  const verb = INTENT_VERB[intent] ?? 'Other'
  return topTags.length > 0 ? `${verb}: ${topTags.join(', ')}` : verb
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

interface Props {
  onPick?: (c: Capture) => void
}

export function BriefScreen({ onPick }: Props) {
  const [dates, setDates] = useState<{ date: string; count: number }[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [grouped, setGrouped] = useState<Record<string, Capture[]>>({})
  const [loading, setLoading] = useState(true)
  const [read, setRead] = useState(false)

  // Load available dates on mount
  useEffect(() => {
    getBriefDates().then(setDates).catch(() => {})
  }, [])

  // Load brief whenever selectedDate changes (null = today's unreviewed)
  useEffect(() => {
    setLoading(true)
    setRead(false)
    getBrief(selectedDate ?? undefined)
      .then(g => { setGrouped(g); setLoading(false) })
      .catch(() => { setGrouped({}); setLoading(false) })
  }, [selectedDate])

  const today = new Date().toISOString().slice(0, 10)
  const activeDate = selectedDate ?? today
  const dateLabel = isToday(activeDate)
    ? new Date().toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : formatDate(activeDate).toUpperCase()

  const totalItems = Object.values(grouped).reduce((n, arr) => n + arr.length, 0)
  const intentOrder = ['learn', 'act', 'reference', 'ephemeral', 'other']
  const groups = intentOrder
    .filter(k => grouped[k]?.length > 0)
    .map(k => ({ key: k, items: grouped[k], accent: INTENT_ACCENT[k], reason: groupReason(k, grouped[k]) }))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 30px', position: 'relative' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Date strip */}
        {dates.length > 1 && (
          <div style={{
            display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20,
            paddingBottom: 4,
          }}>
            {/* Today pill (unreviewed) */}
            <button
              onClick={() => setSelectedDate(null)}
              className="font-mono"
              style={{
                flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                padding: '5px 12px', border: '2.5px solid var(--line)',
                background: selectedDate === null ? 'var(--ink)' : 'var(--card)',
                color: selectedDate === null ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer', boxShadow: selectedDate === null ? 'none' : '2px 2px 0 var(--line)',
              }}
            >Today</button>
            {dates.map(d => (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className="font-mono"
                style={{
                  flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '5px 12px', border: '2.5px solid var(--line)',
                  background: selectedDate === d.date ? 'var(--ink)' : 'var(--card)',
                  color: selectedDate === d.date ? 'var(--paper)' : 'var(--ink)',
                  cursor: 'pointer', boxShadow: selectedDate === d.date ? 'none' : '2px 2px 0 var(--line)',
                }}
              >
                {formatDate(d.date)}
                <span style={{ marginLeft: 5, opacity: 0.5 }}>{d.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Cover card */}
        <div style={{
          background: 'var(--ink)', color: 'var(--paper)',
          border: 'var(--bw) solid var(--line)', boxShadow: 'var(--shadow)',
          padding: '22px 24px', marginBottom: 24,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        }}>
          <div>
            <div className="font-mono" style={{ fontSize: 12, letterSpacing: '0.18em', color: 'var(--learn)', fontWeight: 700 }}>
              {dateLabel}
            </div>
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6 }}>
              {selectedDate === null ? 'Daily Brief' : 'Past Brief'}
            </div>
            {selectedDate === null && (
              <div className="font-mono" style={{ fontSize: 10, opacity: 0.5, marginTop: 4, letterSpacing: '0.1em' }}>
                UNREVIEWED CAPTURES
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: 'var(--learn)' }}>{loading ? '—' : totalItems}</div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.8 }}>CAPTURES</div>
          </div>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
            <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Loading…</span>
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.6 }}>
            <div style={{ fontSize: 40 }}>◎</div>
            <p style={{ fontWeight: 500, marginTop: 8 }}>
              {selectedDate ? 'No captures found for this date.' : 'All caught up — nothing unreviewed.'}
            </p>
          </div>
        )}

        {!loading && groups.map(g => (
          <section key={g.key} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 16, height: 16, background: g.accent, border: '2.5px solid var(--line)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                {g.reason}
              </h3>
              <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, marginLeft: 'auto' }}>
                {g.items.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.items.map(c => (
                <Card key={c.id} capture={c} variant="feed" onPick={onPick} />
              ))}
            </div>
          </section>
        ))}

        {/* Mark read — only for today's brief */}
        {!loading && groups.length > 0 && selectedDate === null && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30, marginBottom: 10 }}>
            <button
              onClick={() => setRead(true)}
              disabled={read}
              style={{
                fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                padding: '13px 26px', border: 'var(--bw) solid var(--line)',
                background: read ? 'var(--card)' : 'var(--done)',
                color: 'var(--ink)', cursor: read ? 'default' : 'pointer',
                boxShadow: read ? 'none' : 'var(--shadow-sm)',
              }}
            >
              {read ? '✓ Brief read for today' : 'Mark brief as read'}
            </button>
          </div>
        )}
      </div>

      {/* READ stamp */}
      {read && (
        <div style={{
          position: 'absolute', top: 90, left: '50%',
          transform: 'translateX(-50%) rotate(-12deg)', pointerEvents: 'none',
          fontWeight: 700, fontSize: 56, color: 'var(--done)',
          border: '6px solid var(--done)', padding: '4px 20px',
          background: 'rgba(255,253,246,.65)', letterSpacing: '0.04em',
          animation: 'stamp .5s cubic-bezier(.2,1.4,.4,1) both',
        }}>READ</div>
      )}
    </div>
  )
}
