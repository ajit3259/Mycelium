import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Capture } from '../types'
import { searchCaptures, getCapturesByIntent, askSynthesize, askExtend, askFeynman, askFeynmanGrade, askArc } from '../api'
import { Card } from './Card'

const SUGGESTIONS = [
  'GPU inference and memory bandwidth',
  'what should I act on?',
  'spaced repetition',
  'things to learn this week',
]

type QueryMode = 'search' | 'intent'

function detectQuery(q: string): { mode: QueryMode; intent?: string } {
  const lower = q.toLowerCase()
  if (/\b(act on|to[- ]?do|todo|tasks?|should i do|action items?|follow.?up)\b/.test(lower))
    return { mode: 'intent', intent: 'act' }
  if (/\b(what (to|should i) (learn|study|read|watch|review)|things to learn|learn this week)\b/.test(lower))
    return { mode: 'intent', intent: 'learn' }
  if (/\breference(s)?|look up|look back\b/.test(lower))
    return { mode: 'intent', intent: 'reference' }
  return { mode: 'search' }
}

const INTENT_COLOR: Record<string, string> = {
  learn: 'var(--learn)',
  act: 'var(--act)',
  reference: 'var(--ref)',
  ephemeral: 'var(--eph)',
}

function scoreColor(score: number) {
  if (score >= 0.7) return 'var(--done)'
  if (score >= 0.5) return 'var(--learn)'
  return 'var(--paper)'
}

function ResultRow({ capture, onExpand, expanded, onPick }: {
  capture: Capture
  onExpand: () => void
  expanded: boolean
  onPick?: (c: Capture) => void
}) {
  const summary = capture.summary || capture.raw || '—'
  const truncated = summary.length > 110 ? summary.slice(0, 110) + '…' : summary

  return (
    <div style={{ border: 'var(--bw) solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', cursor: 'pointer',
        }}
        onClick={onExpand}
      >
        {/* Score */}
        {capture.score !== undefined && (
          <span className="font-mono" style={{
            flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            background: scoreColor(capture.score), color: 'var(--ink)',
            border: '2px solid var(--line)', padding: '2px 6px',
            minWidth: 46, textAlign: 'center',
          }}>
            {Math.round(capture.score * 100)}%
          </span>
        )}

        {/* Intent dot */}
        {capture.intent && (
          <span style={{
            flexShrink: 0, width: 8, height: 8, borderRadius: '50%',
            background: INTENT_COLOR[capture.intent] || 'var(--line)',
          }} title={capture.intent} />
        )}

        {/* Summary */}
        <span style={{ flex: 1, fontSize: 13, lineHeight: 1.4, fontWeight: 500, color: 'var(--ink)' }}>
          {expanded ? summary : truncated}
        </span>

        {/* Expand toggle */}
        <span style={{
          flexShrink: 0, fontSize: 14, color: 'var(--ink-soft)',
          transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s',
        }}>▾</span>
      </div>

      {/* Expanded full card */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--line)' }}>
          <Card capture={capture} variant="feed" />
          {onPick && (
            <div style={{ padding: '0 12px 10px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => onPick(capture)}
                className="font-mono"
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '5px 12px', border: '2px solid var(--line)', background: 'var(--paper)',
                  color: 'var(--ink)', cursor: 'pointer', boxShadow: '2px 2px 0 var(--line)',
                }}
              >Open in home →</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface SynthesisState {
  text: string
  tension: string | null
  loading: boolean
  done: boolean
  error?: string
}

interface ExtendState {
  gap: string
  questions: string[]
  loading: boolean
  done: boolean
}

interface FeynmanState {
  questions: string[]
  answers: string[]
  grades: Array<{ verdict: string; feedback: string } | null>
  loadingQuestions: boolean
  gradingLoading: boolean
  graded: boolean
  open: boolean
}

interface ArcState {
  periods: Array<{ label: string; start_date: string; end_date: string; insight: string; capture_count: number }>
  loading: boolean
  done: boolean
}

interface Props {
  onPick?: (c: Capture) => void
}

export function AskScreen({ onPick }: Props) {
  const [q, setQ] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [queryMode, setQueryMode] = useState<QueryMode>('search')
  const [queryIntent, setQueryIntent] = useState<string | undefined>(undefined)
  const [results, setResults] = useState<Capture[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const [synthesis, setSynthesis] = useState<SynthesisState>({ text: '', tension: null, loading: false, done: false })
  const [extend, setExtend] = useState<ExtendState>({ gap: '', questions: [], loading: false, done: false })
  const [feynman, setFeynman] = useState<FeynmanState>({
    questions: [], answers: [], grades: [],
    loadingQuestions: false, gradingLoading: false, graded: false, open: false,
  })
  const [arc, setArc] = useState<ArcState>({ periods: [], loading: false, done: false })

  const inputRef = useRef<HTMLInputElement>(null)
  const synthesisRef = useRef<HTMLDivElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const reset = useCallback(() => {
    setSubmitted('')
    setQueryMode('search')
    setQueryIntent(undefined)
    setResults([])
    setExpandedId(null)
    setSynthesis({ text: '', tension: null, loading: false, done: false })
    setExtend({ gap: '', questions: [], loading: false, done: false })
    setFeynman({ questions: [], answers: [], grades: [], loadingQuestions: false, gradingLoading: false, graded: false, open: false })
    setArc({ periods: [], loading: false, done: false })
  }, [])

  const runSearch = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) return
    const detected = detectQuery(trimmed)
    setSubmitted(trimmed)
    setQueryMode(detected.mode)
    setQueryIntent(detected.intent)
    setExpandedId(null)
    setSynthesis({ text: '', tension: null, loading: false, done: false })
    setExtend({ gap: '', questions: [], loading: false, done: false })
    setSearching(true)
    const r = detected.mode === 'intent' && detected.intent
      ? await getCapturesByIntent(detected.intent).catch(() => [])
      : await searchCaptures(trimmed).catch(() => [])
    setResults(r)
    setSearching(false)
  }, [])

  const SYNTH_THRESHOLD = 0.5

  const synthCandidates = results.filter(c =>
    c.score === undefined || c.score >= SYNTH_THRESHOLD
  ).slice(0, 8)

  const runSynthesize = useCallback(async () => {
    if (!submitted || !results.length) return
    setSynthesis(s => ({ ...s, loading: true, done: false, error: undefined }))
    const candidates = synthCandidates.length > 0 ? synthCandidates : results.slice(0, 5)
    const ids = candidates.map(c => c.id)
    try {
      const res = await askSynthesize(submitted, ids)
      setSynthesis({ text: res.synthesis, tension: res.tension, loading: false, done: true })
      setTimeout(() => synthesisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (err) {
      setSynthesis({ text: '', tension: null, loading: false, done: true, error: String(err) })
    }
  }, [submitted, synthCandidates])

  const runExtend = useCallback(async () => {
    if (!submitted || !synthesis.text) return
    setExtend(e => ({ ...e, loading: true }))
    const res = await askExtend(submitted, synthesis.text).catch(() => ({ gap: '', questions: [] }))
    setExtend({ gap: res.gap, questions: res.questions, loading: false, done: true })
  }, [submitted, synthesis.text])

  // Date span in days across results — used to decide whether to show arc button
  const dateSpan = useMemo(() => {
    if (results.length < 3) return 0
    const dates = results.map(c => c.created_at?.slice(0, 10)).filter(Boolean).sort() as string[]
    if (dates.length < 2) return 0
    return Math.floor((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000)
  }, [results])

  const openFeynman = useCallback(async () => {
    if (!submitted || !synthCandidates.length) return
    setFeynman(f => ({ ...f, open: true, loadingQuestions: true, questions: [], answers: [], grades: [], graded: false }))
    const ids = synthCandidates.map(c => c.id)
    try {
      const res = await askFeynman(submitted, ids)
      setFeynman(f => ({
        ...f,
        loadingQuestions: false,
        questions: res.questions,
        answers: res.questions.map(() => ''),
        grades: res.questions.map(() => null),
      }))
    } catch {
      setFeynman(f => ({ ...f, loadingQuestions: false }))
    }
  }, [submitted, synthCandidates])

  const submitFeynmanAnswers = useCallback(async () => {
    const ids = synthCandidates.map(c => c.id)
    const qa = feynman.questions.map((q, i) => ({ question: q, answer: feynman.answers[i] ?? '' }))
    setFeynman(f => ({ ...f, gradingLoading: true }))
    try {
      const res = await askFeynmanGrade(qa, ids)
      setFeynman(f => ({ ...f, gradingLoading: false, graded: true, grades: res.grades }))
    } catch {
      setFeynman(f => ({ ...f, gradingLoading: false, graded: true }))
    }
  }, [feynman.questions, feynman.answers, synthCandidates])

  const runArc = useCallback(async () => {
    if (!submitted || !results.length) return
    setArc({ periods: [], loading: true, done: false })
    const ids = results.map(c => c.id)
    try {
      const res = await askArc(submitted, ids)
      setArc({ periods: res.periods, loading: false, done: true })
    } catch {
      setArc({ periods: [], loading: false, done: true })
    }
  }, [submitted, results])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') runSearch(q)
  }

  const asked = submitted.length > 0

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '30px 30px 60px' }}>
      <div style={{ maxWidth: 740, margin: '0 auto' }}>

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'stretch',
          border: 'var(--bw) solid var(--line)', background: 'var(--card)',
          boxShadow: 'var(--shadow)', marginBottom: 20,
        }}>
          <div style={{ display: 'grid', placeItems: 'center', padding: '0 16px', borderRight: 'var(--bw) solid var(--line)' }}>
            <svg width="22" height="22" viewBox="0 0 26 26">
              <circle cx="11" cy="11" r="6.5" fill="none" stroke="var(--ink)" strokeWidth="2.6" />
              <line x1="16" y1="16" x2="21" y2="21" stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </div>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask your mycelium… (press Enter)"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'var(--card)',
              fontSize: 20, fontWeight: 500, padding: '18px 16px', color: 'var(--ink)',
            }}
          />
          {q && (
            <button
              onClick={() => { setQ(''); reset(); inputRef.current?.focus() }}
              style={{
                alignSelf: 'center', marginRight: 8, background: 'transparent',
                border: 'none', color: 'var(--ink-soft)', cursor: 'pointer',
                fontSize: 18, padding: '4px 8px',
              }}
            >✕</button>
          )}
        </div>

        {/* Empty state */}
        {!asked && (
          <div>
            <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12 }}>
              Try asking…
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQ(s); runSearch(s) }}
                  style={{
                    fontSize: 14, fontWeight: 600, padding: '10px 16px',
                    border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                    color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                  }}
                >{s}</button>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 60, opacity: 0.6 }}>
              <p style={{ fontWeight: 500, fontSize: 15 }}>
                Find · Synthesize · Extend<br />
                <span style={{ fontSize: 13, opacity: 0.7 }}>Your knowledge base, as a thinking partner.</span>
              </p>
            </div>
          </div>
        )}

        {/* Results */}
        {asked && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* ── Phase 1: Retrieve ── */}
            <section>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, background: queryMode === 'intent' ? INTENT_COLOR[queryIntent ?? ''] ?? 'var(--act)' : 'var(--ref)', border: '2px solid var(--line)', display: 'inline-block', flexShrink: 0 }} />
                  {searching
                    ? (queryMode === 'intent' ? `Filtering ${queryIntent ?? ''}…` : 'Searching…')
                    : queryMode === 'intent'
                      ? `${results.length} ${queryIntent ?? 'intent'} capture${results.length !== 1 ? 's' : ''}`
                      : `${results.length} note${results.length !== 1 ? 's' : ''} found`
                  }
                </div>
                {/* Legend */}
                {!searching && results.length > 0 && (
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {(['learn', 'act', 'reference'] as const).map(intent => (
                      <span key={intent} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: INTENT_COLOR[intent] }} />
                        <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-soft)', fontWeight: 700, letterSpacing: '0.06em' }}>{intent}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!searching && results.length === 0 && (
                <div style={{ textAlign: 'center', padding: '30px 0', opacity: 0.6 }}>
                  <div style={{ fontSize: 36 }}>◎</div>
                  <p style={{ fontWeight: 500, marginTop: 8 }}>Nothing on "{submitted}" yet.<br />Capture something first.</p>
                </div>
              )}

              {results.length > 0 && (
                <>
                  {/* Compact result rows — dim low-relevance ones */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {results.map(c => {
                      const belowThreshold = c.score !== undefined && c.score < SYNTH_THRESHOLD
                      return (
                        <div key={c.id} style={{ opacity: belowThreshold ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                          <ResultRow
                            capture={c}
                            expanded={expandedId === c.id}
                            onExpand={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            onPick={onPick}
                          />
                        </div>
                      )
                    })}
                  </div>

                  {/* Threshold legend */}
                  {results.some(c => c.score !== undefined) && (
                    <div className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 6, letterSpacing: '0.06em' }}>
                      {synthCandidates.length} of {results.length} notes above {Math.round(SYNTH_THRESHOLD * 100)}% relevance — dimmed ones excluded from synthesis
                    </div>
                  )}

                  {/* Synthesize — right below the compact list */}
                  {!synthesis.done && !synthesis.loading && (() => {
                    const hasStrong = synthCandidates.length > 0
                    const fallback = results.slice(0, 5)
                    return (
                      <div style={{ marginTop: 10 }}>
                        {!hasStrong && results.length > 0 && (
                          <div style={{
                            fontSize: 13, fontWeight: 500,
                            color: 'var(--ink-soft)', marginBottom: 8,
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}>
                            <span>⚠</span> All matches below {Math.round(SYNTH_THRESHOLD * 100)}% relevance — synthesis may be loosely grounded
                          </div>
                        )}
                        <button
                          onClick={runSynthesize}
                          style={{
                            width: '100%',
                            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            padding: '12px 0',
                            border: hasStrong ? 'var(--bw) solid var(--line)' : '2px dashed var(--line)',
                            background: hasStrong ? 'var(--ink)' : 'var(--card)',
                            color: hasStrong ? 'var(--paper)' : 'var(--ink-soft)',
                            cursor: 'pointer',
                            boxShadow: hasStrong ? 'var(--shadow-sm)' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          }}
                        >
                          <span>✦</span>
                          {hasStrong
                            ? `Synthesize from ${synthCandidates.length} relevant note${synthCandidates.length !== 1 ? 's' : ''}`
                            : `Synthesize anyway from best ${fallback.length} matches`
                          }
                        </button>
                      </div>
                    )
                  })()}
                </>
              )}
            </section>

            {/* ── Phase 2: Synthesize ── */}
            {(synthesis.loading || synthesis.done) && (
              <section ref={synthesisRef} style={{ animation: 'pop-in .2s ease both' }}>
                <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, background: 'var(--learn)', border: '2px solid var(--line)', display: 'inline-block', flexShrink: 0 }} />
                  {synthesis.loading ? 'Synthesizing…' : 'Synthesis'}
                </div>

                {synthesis.loading && (
                  <div style={{
                    border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                    padding: '20px 18px', boxShadow: 'var(--shadow-sm)',
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.5 }}>
                      <span style={{ fontSize: 18 }}>✦</span>
                      <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Reading your notes…</span>
                    </div>
                  </div>
                )}

                {synthesis.done && synthesis.text && (
                  <div style={{
                    border: 'var(--bw) solid var(--line)', background: 'var(--ink)',
                    color: 'var(--paper)', padding: '20px',
                    boxShadow: 'var(--shadow)',
                  }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
                      <span style={{
                        flexShrink: 0, width: 26, height: 26, display: 'grid', placeItems: 'center',
                        background: 'var(--learn)', border: '2.5px solid var(--paper)',
                        fontWeight: 700, fontSize: 14, color: 'var(--ink)',
                      }}>✦</span>
                      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}>
                        {synthesis.text}
                      </p>
                    </div>

                    {synthesis.tension && (
                      <div style={{
                        marginTop: 14, padding: '10px 14px',
                        background: 'rgba(255,93,57,0.15)', border: '2px solid var(--act)',
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                      }}>
                        <span style={{ fontSize: 14, flexShrink: 0 }}>⚡</span>
                        <p className="font-mono" style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--act)', fontWeight: 700 }}>
                          TENSION: {synthesis.tension}
                        </p>
                      </div>
                    )}

                    {(!extend.done || !feynman.open) && (
                      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                        {!extend.done && !extend.loading && (
                          <button
                            onClick={runExtend}
                            style={{
                              flex: 1,
                              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                              padding: '10px 0', border: '2px solid var(--paper)',
                              background: 'transparent', color: 'var(--paper)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            → What am I missing?
                          </button>
                        )}
                        {!feynman.open && synthCandidates.length > 0 && (
                          <button
                            onClick={openFeynman}
                            style={{
                              flex: 1,
                              fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                              padding: '10px 0', border: '2px solid var(--learn)',
                              background: 'transparent', color: 'var(--learn)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            }}
                          >
                            🧠 Test yourself
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {synthesis.done && !synthesis.text && (
                  <div style={{
                    border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                    padding: '16px 18px', boxShadow: 'var(--shadow-sm)',
                    borderLeft: '6px solid var(--ref)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  }}>
                    <p className="font-mono" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                      {synthesis.error?.includes('HTTP')
                        ? 'Server error — restart the backend and try again.'
                        : synthesis.error?.includes('Empty')
                          ? 'LM returned empty response — model may still be loading. Try again.'
                          : synthesis.error
                            ? synthesis.error
                            : 'No notes have summaries yet — captures may still be processing.'}
                    </p>
                    <button
                      onClick={runSynthesize}
                      className="font-mono"
                      style={{
                        flexShrink: 0, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                        padding: '6px 12px', border: '2px solid var(--line)', background: 'var(--paper)',
                        color: 'var(--ink)', cursor: 'pointer', boxShadow: '2px 2px 0 var(--line)',
                      }}
                    >↺ Retry</button>
                  </div>
                )}
              </section>
            )}

            {/* ── Phase 3: Extend ── */}
            {(extend.loading || extend.done) && (
              <section style={{ animation: 'pop-in .2s ease both' }}>
                <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, background: 'var(--act)', border: '2px solid var(--line)', display: 'inline-block', flexShrink: 0 }} />
                  {extend.loading ? 'Finding gaps…' : 'Extend your knowledge'}
                </div>

                {extend.loading && (
                  <div style={{
                    border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                    padding: '20px 18px', boxShadow: 'var(--shadow-sm)', opacity: 0.6,
                  }}>
                    <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Identifying gaps…</span>
                  </div>
                )}

                {extend.done && (extend.gap || extend.questions.length > 0) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {extend.gap && (
                      <div style={{
                        border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                        boxShadow: 'var(--shadow)', padding: '16px 18px',
                        borderLeft: '6px solid var(--act)',
                      }}>
                        <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--act)', marginBottom: 8 }}>
                          Gap in your knowledge
                        </div>
                        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, fontWeight: 500, color: 'var(--ink)' }}>
                          {extend.gap}
                        </p>
                      </div>
                    )}

                    {extend.questions.length > 0 && (
                      <div style={{
                        border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                        boxShadow: 'var(--shadow)', padding: '16px 18px',
                      }}>
                        <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12 }}>
                          Questions to capture answers to
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {extend.questions.map((question, i) => (
                            <div key={i} style={{
                              display: 'flex', gap: 12, alignItems: 'flex-start',
                              padding: '10px 12px', border: '2px solid var(--line)',
                              background: 'var(--paper)',
                            }}>
                              <span className="font-mono" style={{
                                flexShrink: 0, width: 22, height: 22, display: 'grid', placeItems: 'center',
                                background: 'var(--ink)', color: 'var(--paper)',
                                fontSize: 11, fontWeight: 700,
                              }}>{i + 1}</span>
                              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: 'var(--ink)' }}>
                                {question}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {extend.done && !extend.gap && extend.questions.length === 0 && (
                  <div style={{ padding: '14px 0', opacity: 0.5 }}>
                    <p className="font-mono" style={{ fontSize: 12, fontWeight: 700 }}>Could not generate extensions — try again.</p>
                  </div>
                )}
              </section>
            )}

            {/* ── Phase 4: Feynman ── */}
            {feynman.open && (
              <section style={{ animation: 'pop-in .2s ease both' }}>
                <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, background: 'var(--learn)', border: '2px solid var(--line)', display: 'inline-block', flexShrink: 0 }} />
                  Test yourself — Feynman mode
                </div>

                {feynman.loadingQuestions && (
                  <div style={{ border: 'var(--bw) solid var(--line)', background: 'var(--card)', padding: '18px', opacity: 0.6 }}>
                    <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Generating questions…</span>
                  </div>
                )}

                {!feynman.loadingQuestions && feynman.questions.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Grade summary */}
                    {feynman.graded && (
                      <div style={{ padding: '12px 16px', border: 'var(--bw) solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
                        {(() => {
                          const rights = feynman.grades.filter(g => g?.verdict === 'right').length
                          const total = feynman.questions.length
                          return (
                            <span className="font-mono" style={{ fontSize: 13, fontWeight: 700 }}>
                              {rights}/{total} correct ·{' '}
                              <span style={{ color: rights === total ? 'var(--done)' : rights >= total / 2 ? 'var(--learn)' : 'var(--act)' }}>
                                {rights === total ? 'You nailed it' : rights >= total / 2 ? 'Solid understanding' : 'Review these notes again'}
                              </span>
                            </span>
                          )
                        })()}
                      </div>
                    )}

                    {feynman.questions.map((q, i) => {
                      const grade = feynman.graded ? feynman.grades[i] : null
                      const verdictColor = grade?.verdict === 'right' ? 'var(--done)' : grade?.verdict === 'partial' ? 'var(--learn)' : grade?.verdict === 'wrong' ? 'var(--act)' : 'var(--paper)'
                      return (
                        <div key={i} style={{
                          border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                          boxShadow: 'var(--shadow-sm)', overflow: 'hidden',
                        }}>
                          {/* Question */}
                          <div style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: grade ? 'var(--bw) solid var(--line)' : 'none', alignItems: 'flex-start' }}>
                            <span className="font-mono" style={{
                              flexShrink: 0, width: 22, height: 22, display: 'grid', placeItems: 'center',
                              background: grade ? verdictColor : 'var(--ink)', color: 'var(--paper)',
                              fontSize: 11, fontWeight: 700, border: '2px solid var(--line)',
                            }}>{i + 1}</span>
                            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, fontWeight: 600, flex: 1 }}>{q}</p>
                            {grade && (
                              <span className="font-mono" style={{
                                flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                                padding: '3px 8px', border: '2px solid var(--line)', background: verdictColor,
                                boxShadow: '2px 2px 0 var(--line)', color: 'var(--ink)',
                              }}>
                                {grade.verdict}
                              </span>
                            )}
                          </div>

                          {/* Answer textarea or result */}
                          <div style={{ padding: '10px 14px' }}>
                            {!feynman.graded ? (
                              <textarea
                                value={feynman.answers[i] ?? ''}
                                onChange={e => {
                                  const updated = [...feynman.answers]
                                  updated[i] = e.target.value
                                  setFeynman(f => ({ ...f, answers: updated }))
                                }}
                                placeholder="Type your answer…"
                                rows={3}
                                style={{
                                  width: '100%', border: '2px solid var(--line)',
                                  background: 'var(--paper)', color: 'var(--ink)',
                                  fontSize: 14, padding: '8px 10px', resize: 'vertical',
                                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                                }}
                              />
                            ) : (
                              <div>
                                <p style={{ margin: '0 0 6px', fontSize: 14, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
                                  "{feynman.answers[i] || '(no answer)'}"
                                </p>
                                {grade?.feedback && (
                                  <p className="font-mono" style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                                    ↳ {grade.feedback}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Submit / retry buttons */}
                    {!feynman.graded && (() => {
                      const filled = feynman.answers.filter(a => a.trim().length > 0).length
                      const allFilled = filled === feynman.questions.length
                      return (
                        <div>
                          {!allFilled && !feynman.gradingLoading && (
                            <p className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', letterSpacing: '0.08em', marginBottom: 8 }}>
                              {filled}/{feynman.questions.length} answered — fill in all answers before submitting
                            </p>
                          )}
                          <button
                            onClick={submitFeynmanAnswers}
                            disabled={feynman.gradingLoading || !allFilled}
                            style={{
                              width: '100%',
                              fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                              padding: '12px 0', border: 'var(--bw) solid var(--line)',
                              background: allFilled ? 'var(--ink)' : 'var(--card)',
                              color: allFilled ? 'var(--paper)' : 'var(--ink-soft)',
                              cursor: (feynman.gradingLoading || !allFilled) ? 'default' : 'pointer',
                              boxShadow: allFilled ? 'var(--shadow-sm)' : 'none',
                              opacity: feynman.gradingLoading ? 0.6 : 1,
                            }}
                          >
                            {feynman.gradingLoading ? 'Grading…' : 'Submit for grading'}
                          </button>
                        </div>
                      )
                    })()}

                    {feynman.graded && (
                      <button
                        onClick={() => setFeynman(f => ({ ...f, graded: false, grades: f.questions.map(() => null), answers: f.questions.map(() => '') }))}
                        className="font-mono"
                        style={{
                          alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                          padding: '6px 12px', border: '2px solid var(--line)', background: 'var(--paper)',
                          color: 'var(--ink)', cursor: 'pointer', boxShadow: '2px 2px 0 var(--line)',
                        }}
                      >↺ Try again</button>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* ── Phase 5: Learning Arc ── */}
            {!arc.done && !arc.loading && dateSpan >= 14 && synthesis.done && (
              <section>
                <button
                  onClick={runArc}
                  style={{
                    width: '100%',
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                    padding: '11px 0', border: '2px dashed var(--line)',
                    background: 'var(--card)', color: 'var(--ink-soft)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  📅 How my thinking on this evolved ({dateSpan}d span)
                </button>
              </section>
            )}

            {(arc.loading || arc.done) && (
              <section style={{ animation: 'pop-in .2s ease both' }}>
                <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 14, height: 14, background: 'var(--ref)', border: '2px solid var(--line)', display: 'inline-block', flexShrink: 0 }} />
                  {arc.loading ? 'Tracing your arc…' : 'Learning arc'}
                </div>

                {arc.loading && (
                  <div style={{ border: 'var(--bw) solid var(--line)', background: 'var(--card)', padding: '18px', opacity: 0.6 }}>
                    <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Mapping how your understanding evolved…</span>
                  </div>
                )}

                {arc.done && arc.periods.length > 0 && (
                  <div style={{ position: 'relative', paddingLeft: 28 }}>
                    {/* Vertical line */}
                    <div style={{ position: 'absolute', left: 10, top: 12, bottom: 12, width: 3, background: 'var(--line)' }} />

                    {arc.periods.map((period, i) => {
                      const opacity = 0.5 + (i / Math.max(1, arc.periods.length - 1)) * 0.5
                      return (
                        <div key={i} style={{ position: 'relative', marginBottom: 16 }}>
                          {/* Node */}
                          <div style={{
                            position: 'absolute', left: -22, top: 14,
                            width: 13, height: 13, borderRadius: '50%',
                            background: 'var(--ref)', border: '2.5px solid var(--ink)',
                            opacity,
                          }} />
                          <div style={{
                            border: 'var(--bw) solid var(--line)', background: 'var(--card)',
                            boxShadow: 'var(--shadow-sm)', padding: '14px 16px',
                            opacity,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <span className="font-mono" style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                                padding: '3px 8px', border: '2px solid var(--line)', background: 'var(--paper)',
                                boxShadow: '2px 2px 0 var(--line)',
                              }}>{period.label}</span>
                              <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>
                                {period.start_date?.slice(0, 10)}{period.end_date && period.end_date !== period.start_date ? ` → ${period.end_date?.slice(0, 10)}` : ''} · {period.capture_count} note{period.capture_count !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, fontWeight: 500 }}>{period.insight}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {arc.done && arc.periods.length === 0 && (
                  <div style={{ padding: '14px 0', opacity: 0.5 }}>
                    <p className="font-mono" style={{ fontSize: 12, fontWeight: 700 }}>Could not identify distinct phases — captures may span too short a period.</p>
                  </div>
                )}
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
