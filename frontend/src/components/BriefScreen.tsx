import { useState, useEffect } from 'react'
import type { Capture } from '../types'
import { getBrief } from '../api'
import { Card } from './Card'

const GROUP_LABELS: Record<string, { reason: string; accent: string }> = {
  learn:     { reason: 'Things you\'re learning', accent: 'var(--learn)' },
  act:       { reason: 'Actions you keep meaning to take', accent: 'var(--act)' },
  reference: { reason: 'References worth a second look', accent: 'var(--ref)' },
  ephemeral: { reason: 'Fleeting thoughts', accent: 'var(--eph)' },
  other:     { reason: 'Other captures', accent: 'var(--paper)' },
}

interface Props {
  onPick?: (c: Capture) => void
}

export function BriefScreen({ onPick }: Props) {
  const [grouped, setGrouped] = useState<Record<string, Capture[]>>({})
  const [loading, setLoading] = useState(true)
  const [read, setRead] = useState(false)

  useEffect(() => {
    getBrief()
      .then(g => { setGrouped(g); setLoading(false) })
      .catch(() => { setGrouped({}); setLoading(false) })
  }, [])

  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
  const totalItems = Object.values(grouped).reduce((n, arr) => n + arr.length, 0)

  const intentOrder = ['learn', 'act', 'reference', 'ephemeral', 'other']
  const groups = intentOrder
    .filter(k => grouped[k] && grouped[k].length > 0)
    .map(k => ({ key: k, items: grouped[k], ...GROUP_LABELS[k] }))

  if (loading) return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <span className="font-mono" style={{ color: 'var(--ink-soft)', fontSize: 13, fontWeight: 700 }}>Loading brief…</span>
    </div>
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 30px', position: 'relative' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* cover card */}
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
            <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 6 }}>Daily Brief</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: 'var(--learn)' }}>{totalItems}</div>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.1em', opacity: 0.8 }}>TO REVISIT</div>
          </div>
        </div>

        {/* groups */}
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.6 }}>
            <div style={{ fontSize: 40 }}>◎</div>
            <p style={{ fontWeight: 500, marginTop: 8 }}>Your brief is empty. Capture something first.</p>
          </div>
        )}

        {groups.map(g => (
          <section key={g.key} style={{ marginBottom: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 16, height: 16, background: g.accent, border: '2.5px solid var(--line)', flexShrink: 0 }} />
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)' }}>{g.reason}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              {g.items.map(c => (
                <Card key={c.id} capture={c} variant="feed" onPick={onPick} />
              ))}
            </div>
          </section>
        ))}

        {/* read button */}
        {groups.length > 0 && (
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
