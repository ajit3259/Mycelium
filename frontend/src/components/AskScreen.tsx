import { useState, useEffect, useRef, useCallback } from 'react'
import type { Capture } from '../types'
import { searchCaptures, getCapturesByIntent, askSynthesize, askExtend } from '../api'
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
        <div style={{ borderTop: '1px solid var(--line)', padding: '0 0 2px' }}>
          <Card capture={capture} variant="feed" onPick={onPick} />
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
    if (!submitted || !synthCandidates.length) return
    setSynthesis(s => ({ ...s, loading: true, done: false, error: undefined }))
    const ids = synthCandidates.map(c => c.id)
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
                  {!synthesis.done && !synthesis.loading && (
                    <button
                      onClick={runSynthesize}
                      disabled={synthCandidates.length === 0}
                      style={{
                        marginTop: 10, width: '100%',
                        fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                        padding: '12px 0', border: 'var(--bw) solid var(--line)',
                        background: synthCandidates.length === 0 ? 'var(--card)' : 'var(--ink)',
                        color: synthCandidates.length === 0 ? 'var(--ink-soft)' : 'var(--paper)',
                        cursor: synthCandidates.length === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: synthCandidates.length === 0 ? 'none' : 'var(--shadow-sm)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                    >
                      <span>✦</span>
                      {synthCandidates.length === 0
                        ? 'No notes above relevance threshold'
                        : `Synthesize from ${synthCandidates.length} relevant note${synthCandidates.length !== 1 ? 's' : ''}`
                      }
                    </button>
                  )}
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

                    {!extend.done && !extend.loading && (
                      <button
                        onClick={runExtend}
                        style={{
                          marginTop: 16, width: '100%',
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                          padding: '10px 0', border: '2px solid var(--paper)',
                          background: 'transparent', color: 'var(--paper)',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        }}
                      >
                        → What am I missing?
                      </button>
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

          </div>
        )}
      </div>
    </div>
  )
}
