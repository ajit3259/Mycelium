import type { NavView } from '../types'

const NAV: { id: NavView; label: string; accent: string }[] = [
  { id: 'home',   label: 'HOME',   accent: 'var(--learn)' },
  { id: 'ask',    label: 'ASK',    accent: 'var(--act)' },
  { id: 'browse', label: 'BROWSE', accent: 'var(--paper)' },
  { id: 'brief',  label: 'BRIEF',  accent: 'var(--ref)' },
  { id: 'review', label: 'REVIEW', accent: 'var(--done)' },
  { id: 'graph',  label: 'GRAPH',  accent: 'var(--eph)' },
]

const STROKE = { fill: 'none', stroke: 'var(--ink)', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function NavGlyph({ id }: { id: NavView }) {
  if (id === 'home') return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <rect x="4" y="5" width="18" height="16" {...STROKE} />
      <line x1="13" y1="10" x2="13" y2="16" {...STROKE} />
      <line x1="10" y1="13" x2="16" y2="13" {...STROKE} />
    </svg>
  )
  if (id === 'browse') return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <line x1="5" y1="8"  x2="21" y2="8"  {...STROKE} />
      <line x1="5" y1="13" x2="21" y2="13" {...STROKE} />
      <line x1="5" y1="18" x2="21" y2="18" {...STROKE} />
    </svg>
  )
  if (id === 'ask') return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <circle cx="11" cy="11" r="6.5" {...STROKE} />
      <line x1="16" y1="16" x2="21" y2="21" {...STROKE} />
    </svg>
  )
  if (id === 'brief') return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="5" {...STROKE} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => {
        const r = a * Math.PI / 180
        return <line key={i} x1={13 + 7 * Math.cos(r)} y1={13 + 7 * Math.sin(r)} x2={13 + 9.5 * Math.cos(r)} y2={13 + 9.5 * Math.sin(r)} {...STROKE} />
      })}
    </svg>
  )
  if (id === 'review') return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <path d="M20 9a8 8 0 1 0 1.6 6" {...STROKE} />
      <polyline points="20,4 20,9 15,9" {...STROKE} />
    </svg>
  )
  // graph
  return (
    <svg width="26" height="26" viewBox="0 0 26 26">
      <line x1="9" y1="9" x2="18" y2="7" {...STROKE} />
      <line x1="9" y1="9" x2="8" y2="19" {...STROKE} />
      <line x1="9" y1="9" x2="19" y2="17" {...STROKE} />
      <circle cx="9" cy="9" r="3" fill="var(--ink)" stroke="none" />
      <circle cx="18" cy="7" r="2.6" {...STROKE} fill="var(--paper)" />
      <circle cx="8" cy="19" r="2.6" {...STROKE} fill="var(--paper)" />
      <circle cx="19" cy="17" r="2.6" {...STROKE} fill="var(--paper)" />
    </svg>
  )
}

interface Props {
  view: NavView
  setView: (v: NavView) => void
  badges?: Partial<Record<NavView, number>>
}

export function NavRail({ view, setView, badges = {} }: Props) {
  return (
    <nav style={{
      width: 96,
      flexShrink: 0,
      borderRight: 'var(--bw) solid var(--line)',
      background: 'var(--paper)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      padding: '18px 0',
    }}>
      {NAV.map(n => {
        const active = view === n.id
        const badge = badges[n.id] ?? 0
        return (
          <button
            key={n.id}
            onClick={() => setView(n.id)}
            title={n.label}
            style={{
              position: 'relative',
              width: 68,
              height: 64,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              border: 'var(--bw) solid var(--line)',
              background: active ? n.accent : 'var(--card)',
              boxShadow: active ? '4px 4px 0 var(--line)' : '2px 2px 0 var(--line)',
              transform: active ? 'translate(-1px,-1px)' : 'none',
              transition: 'transform .06s, box-shadow .06s',
            }}
          >
            <NavGlyph id={n.id} />
            <span className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em' }}>
              {n.label}
            </span>
            {badge > 0 && (
              <span className="font-mono" style={{
                position: 'absolute', top: -8, right: -8,
                minWidth: 20, height: 20, borderRadius: 999,
                background: 'var(--act)', color: 'var(--ink)',
                border: '2.5px solid var(--line)', fontSize: 10, fontWeight: 700,
                display: 'grid', placeItems: 'center', padding: '0 4px',
              }}>{badge}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
