import { useState, useCallback, useEffect, useRef } from 'react'
import type { Capture, Mood, NavView } from './types'
import { getCaptureRelated, getCaptures, getCaptureById, getReviewQueue } from './api'
import { CaptureBar } from './components/CaptureBar'
import { SurfacePanel } from './components/SurfacePanel'
import { Feed } from './components/Feed'
import { Card } from './components/Card'
import { Browse } from './components/Browse'
import { GraphView } from './components/GraphView'
import { NavRail } from './components/NavRail'
import { AgentGuess } from './components/AgentGuess'
import { ReviewScreen } from './components/ReviewScreen'
import { AskScreen } from './components/AskScreen'
import { BriefScreen } from './components/BriefScreen'

const MOODS: Mood[] = ['focused', 'curious', 'restless', 'tired', 'inspired']

const MOOD_META: Record<Mood, { emoji: string; hint: string }> = {
  focused:  { emoji: '🎯', hint: 'Tasks & action items' },
  curious:  { emoji: '🔭', hint: 'Deep learning mode' },
  restless: { emoji: '⚡', hint: 'Browse & variety' },
  tired:    { emoji: '🌙', hint: 'Light content only' },
  inspired: { emoji: '✨', hint: 'Learn & create' },
}

function MoodPill({ mood, onChange }: { mood: Mood | ''; onChange: (m: Mood | '') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function select(m: Mood | '') {
    onChange(m)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="font-mono"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          padding: '3px 8px', border: '2.5px solid var(--line)',
          background: mood ? 'var(--ink)' : 'var(--card)',
          color: mood ? 'var(--paper)' : 'var(--ink-soft)',
          boxShadow: mood ? 'none' : '2px 2px 0 var(--line)',
          cursor: 'pointer',
        }}
      >
        {mood ? <>{MOOD_META[mood].emoji} {mood}</> : '— mood ▾'}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
          background: 'var(--card)', border: '2.5px solid var(--line)',
          boxShadow: 'var(--shadow)', minWidth: 200,
        }}>
          {MOODS.map(m => (
            <button
              key={m}
              onClick={() => select(m)}
              className="font-mono"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px', border: 'none', borderBottom: '1px solid var(--line)',
                background: mood === m ? 'var(--ink)' : 'var(--card)',
                color: mood === m ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { if (mood !== m) e.currentTarget.style.background = 'var(--paper)' }}
              onMouseLeave={e => { if (mood !== m) e.currentTarget.style.background = 'var(--card)' }}
            >
              <span style={{ fontSize: 14 }}>{MOOD_META[m].emoji}</span>
              <span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block' }}>{m}</span>
                <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', opacity: 0.6, textTransform: 'none' }}>{MOOD_META[m].hint}</span>
              </span>
            </button>
          ))}
          {mood && (
            <button
              onClick={() => select('')}
              className="font-mono"
              style={{
                width: '100%', padding: '8px 14px', border: 'none',
                background: 'var(--paper)', color: 'var(--ink-soft)',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: 'pointer', textAlign: 'left',
              }}
            >✕ Clear mood</button>
          )}
        </div>
      )}
    </div>
  )
}

function Spore({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: 'block', flexShrink: 0 }}>
      <line x1="20" y1="20" x2="7"  y2="9"  stroke="currentColor" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="33" y2="11" stroke="currentColor" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="9"  y2="32" stroke="currentColor" strokeWidth="2.4" />
      <line x1="20" y1="20" x2="32" y2="31" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="7"  cy="9"  r="4"   fill="var(--learn)" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="33" cy="11" r="3.4" fill="var(--act)"   stroke="currentColor" strokeWidth="2.4" />
      <circle cx="9"  cy="32" r="3.4" fill="var(--ref)"   stroke="currentColor" strokeWidth="2.4" />
      <circle cx="32" cy="31" r="4"   fill="var(--eph)"   stroke="currentColor" strokeWidth="2.4" />
      <circle cx="20" cy="20" r="6"   fill="currentColor" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  )
}

export default function App() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [view, setView] = useState<NavView>('home')
  const [prevView, setPrevView] = useState<NavView | null>(null)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null)
  const [mood, setMood] = useState<Mood | ''>('')
  const [pendingGuess, setPendingGuess] = useState<Capture | null>(null)
  const [pinnedCapture, setPinnedCapture] = useState<Capture | null>(null)
  const [errorToast, setErrorToast] = useState<string | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  // Pending capture ID — poll until processing completes
  const pendingIdRef = useRef<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const shownGuessIds = useRef<Set<number>>(
    new Set(JSON.parse(sessionStorage.getItem('shownGuessIds') || '[]') as number[])
  )

  function startPolling(id: number) {
    pendingIdRef.current = id
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const all = await getCaptures(50).catch(() => [])
      const found = all.find(c => c.id === pendingIdRef.current)
      // Update pinned capture with latest state (e.g. once summary arrives)
      if (found) setPinnedCapture(found)
      if (found?.summary && found?.intent) {
        pendingIdRef.current = null
        setPinnedCapture(null)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        if (found.summary.startsWith('⚠')) {
          setErrorToast('Processing failed — the AI model is unavailable. Delete the card and try again.')
          setRefreshTrigger(t => t + 1)
        } else if (!shownGuessIds.current.has(found.id)) {
          shownGuessIds.current.add(found.id)
          sessionStorage.setItem('shownGuessIds', JSON.stringify([...shownGuessIds.current]))
          setPendingGuess(found)
        }
      }
    }, 3000)
  }

  // On load: surface AgentGuess for any capture processed in the last 2 min
  // that hasn't been confirmed yet (handles page refresh mid-processing)
  useEffect(() => {
    getCaptures(50).then(all => {
      const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
      const missed = all.find(c =>
        c.summary && c.intent && !c.summary.startsWith('⚠') &&
        c.created_at && c.created_at >= twoMinsAgo &&
        !shownGuessIds.current.has(c.id)
      )
      if (missed) {
        shownGuessIds.current.add(missed.id)
        sessionStorage.setItem('shownGuessIds', JSON.stringify([...shownGuessIds.current]))
        setPendingGuess(missed)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Poll review queue count for nav badge
  useEffect(() => {
    function refresh() {
      getReviewQueue(20).then(q => setReviewCount(q.length)).catch(() => {})
    }
    refresh()
    const t = setInterval(refresh, 60_000)
    return () => clearInterval(t)
  }, [])

  const handlePick = useCallback(async (c: Capture) => {
    const related = c.related ?? await getCaptureRelated(c.id).catch(() => [])
    setSelectedCapture({ ...c, related })
    setPrevView(view)
    setView('home')
  }, [view])

  function handleCapture(id: number) {
    setView('home')
    startPolling(id)
    // Fetch and pin the capture immediately so it appears at top of Just Added
    // regardless of server timestamp (avoids clock skew hiding new captures)
    getCaptureById(id).then(c => { if (c) setPinnedCapture(c) }).catch(() => {})
    // Also trigger a feed refresh
    setRefreshTrigger(n => n + 1)
  }

  function dismissGuess() {
    setPendingGuess(null)
  }

  function updateGuess(updated: Partial<Capture>) {
    setPendingGuess(prev => prev ? { ...prev, ...updated } : null)
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header (matches prototype) ────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        padding: '20px 26px', borderBottom: 'var(--bw) solid var(--line)',
        background: 'var(--paper)', color: 'var(--ink)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Spore size={42} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: '-0.02em', lineHeight: 1 }}>
              MYCELIUM
            </div>
            <div className="font-mono" style={{ marginTop: 5, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', opacity: 0.6 }}>
              Personal Knowledge Agent
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {totalCount !== null && (
            <span className="font-mono" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 8px', border: '2.5px solid var(--line)',
              background: 'var(--card)', boxShadow: '2px 2px 0 var(--line)',
            }}>
              {totalCount} CAPTURES
            </span>
          )}

          {/* Mood indicator — click to cycle, click active to clear */}
          <MoodPill mood={mood} onChange={setMood} />

          <span className="font-mono" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 8px', border: '2.5px solid var(--line)',
            background: 'var(--done)', boxShadow: '2px 2px 0 var(--line)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--ink)',
              display: 'inline-block', animation: 'wob 2.4s ease-in-out infinite',
            }} />
            LOCAL
          </span>
        </div>
      </header>

      {/* ── Main layout: NavRail + content ───────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: 'calc(100vh - 93px)' }}>

        <NavRail view={view} setView={setView} badges={{ review: reviewCount }} />

        {/* Home */}
        {view === 'home' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(360px,440px) 1fr', minHeight: 0, overflow: 'hidden' }}>
            <aside style={{
              borderRight: 'var(--bw) solid var(--line)',
              display: 'flex', flexDirection: 'column', gap: 20,
              padding: 22, overflowY: 'auto',
            }}>
              <div style={{ flexShrink: 0 }}>
                <CaptureBar onCapture={handleCapture} />
              </div>
              {errorToast && (
                <div style={{
                  flexShrink: 0,
                  border: 'var(--bw) solid var(--act)',
                  boxShadow: '3px 3px 0 var(--act)',
                  padding: '12px 14px',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                }}>
                  <p style={{ margin: 0, fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--act)', lineHeight: 1.4 }}>
                    {errorToast}
                  </p>
                  <button onClick={() => setErrorToast(null)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--fg)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0,
                  }}>✕</button>
                </div>
              )}
              {pendingGuess && (
                <div style={{ flexShrink: 0 }}>
                  <AgentGuess capture={pendingGuess} onConfirm={dismissGuess} onUpdate={updateGuess} />
                </div>
              )}
              <div style={{ flexShrink: 0 }}>
                <SurfacePanel onPick={handlePick} mood={mood} />
              </div>
            </aside>

            <main style={{ overflowY: 'auto', padding: 22, position: 'relative' }}>
              {selectedCapture ? (
                <div style={{ animation: 'pop-in .15s ease both' }}>
                  {/* back bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <button
                      onClick={() => {
                        setSelectedCapture(null)
                        if (prevView && prevView !== 'home') {
                          setView(prevView)
                          setPrevView(null)
                        }
                      }}
                      className="font-mono"
                      style={{
                        fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        padding: '6px 12px', border: '2px solid var(--line)', background: 'var(--card)',
                        color: 'var(--ink)', cursor: 'pointer', boxShadow: '2px 2px 0 var(--line)',
                      }}
                    >← {prevView && prevView !== 'home' ? `Back to ${prevView}` : 'Back'}</button>
                  </div>
                  <Card
                    capture={selectedCapture}
                    variant="surface"
                    onAction={() => setSelectedCapture(null)}
                    onPick={handlePick}
                    onDelete={() => { setSelectedCapture(null); setRefreshTrigger(t => t + 1) }}
                  />
                </div>
              ) : (
                <Feed
                  refreshTrigger={refreshTrigger}
                  onCountChange={setTotalCount}
                  onPick={handlePick}
                  limit={3}
                  compact
                  pinnedCapture={pinnedCapture}
                  onBrowseAll={() => setView('browse')}
                />
              )}
            </main>
          </div>
        )}

        {view === 'ask' && <AskScreen onPick={handlePick} />}

        {view === 'browse' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 22 }}>
            <Browse onCountChange={setTotalCount} onPick={handlePick} />
          </div>
        )}

        {view === 'brief' && <BriefScreen onPick={handlePick} />}

        {view === 'review' && (
          <ReviewScreen onExit={() => {
            setView('home')
            getReviewQueue(20).then(q => setReviewCount(q.length))
          }} />
        )}

        {view === 'graph' && (
          <main style={{ flex: 1, overflow: 'hidden', padding: 22 }}>
            <GraphView onPick={handlePick} />
          </main>
        )}

      </div>

      {/* Footer */}
      <div className="font-mono border-t-2 border-[var(--line)] text-center flex-shrink-0"
        style={{ padding: '8px 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', background: 'var(--paper)' }}>
        Made with ♥ by Ajit &amp; Claude Code
      </div>
    </div>
  )
}
