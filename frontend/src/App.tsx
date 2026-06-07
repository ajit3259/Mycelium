import { useState, useCallback } from 'react'
import type { Capture, Mood } from './types'
import { getCaptureRelated } from './api'
import { CaptureBar } from './components/CaptureBar'
import { SurfacePanel } from './components/SurfacePanel'
import { Feed } from './components/Feed'
import { Browse } from './components/Browse'
import { GraphView } from './components/GraphView'

type View = 'feed' | 'browse' | 'graph'

function Spore({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="20" y1="20" x2="7"  y2="9"  stroke="var(--ink)" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="33" y2="11" stroke="var(--ink)" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="9"  y2="32" stroke="var(--ink)" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="32" y2="31" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="7"  cy="9"  r="4"   fill="var(--learn)" stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="33" cy="11" r="3.4" fill="var(--act)"   stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="9"  cy="32" r="3.4" fill="var(--ref)"   stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="32" cy="31" r="4"   fill="var(--eph)"   stroke="var(--ink)" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="6"   fill="var(--ink)"   stroke="var(--ink)" strokeWidth="2.4" />
    </svg>
  )
}

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [view, setView] = useState<View>('feed')
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [pinnedCapture, setPinnedCapture] = useState<Capture | null>(null)
  const [mood, setMood] = useState<Mood | ''>('')

  const handlePick = useCallback(async (c: Capture) => {
    const related = c.related ?? await getCaptureRelated(c.id).catch(() => [])
    const hydrated = { ...c, related }
    setPinnedCapture(hydrated)
    setTimeout(() => setPinnedCapture(null), 100)
  }, [])

  function handleCapture() {
    setRefreshTrigger(n => n + 1)
    // switch back to feed so user sees their new capture
    setView('feed')
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ───────────────────────────────────── */}
      <header
        className="flex items-end justify-between flex-shrink-0 border-b-2 border-[var(--line)]"
        style={{ padding: '20px 26px', background: 'var(--paper)' }}
      >
        <div className="flex items-center gap-4">
          <Spore size={42} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--ink)' }}>
              MYCELIUM
            </div>
            <div className="font-mono" style={{ marginTop: 5, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Personal Knowledge Agent
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Graph view toggle */}
          <button
            onClick={() => setView(v => v === 'graph' ? 'feed' : 'graph')}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1 border-2 border-[var(--line)] inline-flex items-center gap-2 transition-all duration-100"
            style={{
              background: view === 'graph' ? 'var(--ink)' : 'var(--card)',
              color: view === 'graph' ? 'var(--paper)' : 'var(--ink)',
              boxShadow: view === 'graph' ? 'var(--shadow-sm)' : '2px 2px 0 var(--line)',
              transform: view === 'graph' ? 'translate(-1px,-1px)' : '',
              cursor: 'pointer',
            }}
          >
            ⬡ graph
          </button>

          {/* Captures badge — clickable, opens Browse */}
          <button
            onClick={() => setView(v => v === 'browse' ? 'feed' : 'browse')}
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1 border-2 border-[var(--line)] inline-flex items-center gap-2 transition-all duration-100"
            style={{
              background: view === 'browse' ? 'var(--ink)' : 'var(--card)',
              color: view === 'browse' ? 'var(--paper)' : 'var(--ink)',
              boxShadow: view === 'browse' ? 'var(--shadow-sm)' : '2px 2px 0 var(--line)',
              transform: view === 'browse' ? 'translate(-1px,-1px)' : '',
              cursor: 'pointer',
            }}
          >
            {totalCount !== null ? `${totalCount} captures` : 'captures'}
          </button>

          <span
            className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] px-3 py-1 border-2 border-[var(--line)] inline-flex items-center gap-2"
            style={{ background: 'var(--done)', boxShadow: '2px 2px 0 var(--line)', color: 'var(--ink)' }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)', display: 'inline-block' }} />
            LOCAL
          </span>
        </div>
      </header>

      {/* ── Main grid ────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(380px,460px)_1fr] overflow-hidden">

        {/* Left panel — always visible */}
        <aside
          className="border-b-2 md:border-b-0 md:border-r-2 border-[var(--line)] flex flex-col md:overflow-y-auto"
          style={{ padding: 22, gap: 22, height: 'calc(100vh - 89px)' }}
        >
          <div style={{ flexShrink: 0 }}>
            <CaptureBar onCapture={handleCapture} mood={mood} onMoodChange={setMood} />
          </div>
          <div style={{ flexShrink: 0 }}>
            <SurfacePanel pinnedCapture={pinnedCapture} onPick={handlePick} mood={mood} />
          </div>
        </aside>

        {/* Right panel — Feed or Browse */}
        <main
          className="md:overflow-y-auto"
          style={{ padding: 22, height: 'calc(100vh - 89px)' }}
        >
          {view === 'feed' && (
            <Feed
              refreshTrigger={refreshTrigger}
              onCountChange={setTotalCount}
              onPick={handlePick}
            />
          )}
          {view === 'browse' && (
            <Browse onCountChange={setTotalCount} onPick={handlePick} />
          )}
          {view === 'graph' && (
            <GraphView onPick={handlePick} />
          )}
        </main>

      </div>
      {/* Footer */}
      <div
        className="font-mono border-t-2 border-[var(--line)] text-center flex-shrink-0"
        style={{ padding: '8px 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--paper)' }}
      >
        Made with ♥ by Ajit &amp; Claude Code
      </div>
    </div>
  )
}
