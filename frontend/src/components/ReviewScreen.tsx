import { useState, useEffect } from 'react'
import type { Capture } from '../types'
import { getReviewQueue, postReview, getReviewHistory } from '../api'

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function WeekStrip({ reviewedDates, streak, big = false }: { reviewedDates: string[]; streak: number; big?: boolean }) {
  const sz = big ? 34 : 26
  const todayDate = new Date()
  const todayStr = todayDate.toISOString().slice(0, 10)

  // Build Mon-Sun of current week
  const dayOfWeek = todayDate.getDay() // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const weekDates = WEEK_LABELS.map((_, i) => {
    const d = new Date(todayDate)
    d.setDate(todayDate.getDate() - mondayOffset + i)
    return d.toISOString().slice(0, 10)
  })

  const reviewedSet = new Set(reviewedDates)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: big ? 8 : 6 }}>
        {weekDates.map((date, i) => {
          const isToday = date === todayStr
          const reviewed = reviewedSet.has(date)
          const isFuture = date > todayStr
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: sz, height: sz, border: '2.5px solid var(--line)',
                display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: big ? 14 : 11,
                background: reviewed ? 'var(--done)' : isToday ? 'var(--learn)' : 'var(--card)',
                opacity: isFuture ? 0.35 : 1,
              }}>
                {reviewed ? '✓' : isToday ? '•' : ''}
              </div>
              <span className="font-mono" style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--ink-soft)' }}>
                {WEEK_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
      {streak > 0 && (
        <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>
          {streak} DAY STREAK 🔥
        </span>
      )}
    </div>
  )
}

const FALLBACK_QUESTIONS: Record<string, string> = {
  learn:     "What's the key insight here?",
  act:       "What were you going to do?",
  reference: "When would you reach for this?",
  ephemeral: "Why did this catch your attention?",
}

function getQuestion(card: { recall_question?: string | null; intent?: string | null }): string {
  if (card.recall_question) return card.recall_question
  return FALLBACK_QUESTIONS[card.intent ?? ''] ?? "What do you remember about this?"
}

const INTENT_BG: Record<string, string> = {
  learn: 'var(--learn)', act: 'var(--act)', reference: 'var(--ref)', ephemeral: 'var(--eph)',
}
const TYPE_LABEL: Record<string, string> = { text: 'TEXT', link: 'LINK', image: 'IMAGE' }
const INTENT_LABEL: Record<string, string> = { learn: 'LEARN', act: 'ACT', reference: 'REFERENCE', ephemeral: 'EPHEMERAL' }

interface Props {
  onExit: () => void
}

export function ReviewScreen({ onExit }: Props) {
  const [queue, setQueue] = useState<Capture[]>([])
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [done, setDone] = useState(false)
  const [stats, setStats] = useState({ got: 0, again: 0 })
  const [reviewedDates, setReviewedDates] = useState<string[]>([])
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    Promise.all([
      getReviewQueue(20).catch(() => []),
      getReviewHistory().catch(() => ({ reviewed_dates: [], streak: 0 })),
    ]).then(([q, h]) => {
      setQueue(q)
      setReviewedDates(h.reviewed_dates)
      setStreak(h.streak)
      setLoading(false)
    })
  }, [])

  // refresh history after rating (today may now be reviewed)
  async function refreshHistory() {
    const h = await getReviewHistory().catch(() => ({ reviewed_dates: [], streak: 0 }))
    setReviewedDates(h.reviewed_dates)
    setStreak(h.streak)
  }

  async function rate(rating: 'got_it' | 'again') {
    const card = queue[idx]
    await postReview(card.id, rating)
    setStats(s => ({ ...s, [rating === 'got_it' ? 'got' : 'again']: s[rating === 'got_it' ? 'got' : 'again'] + 1 }))
    if (idx + 1 < queue.length) {
      setIdx(idx + 1)
      setRevealed(false)
    } else {
      await refreshHistory()
      setDone(true)
    }
  }

  if (loading) return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
      <span className="font-mono" style={{ color: 'var(--ink-soft)', fontSize: 13, fontWeight: 700 }}>Loading queue…</span>
    </div>
  )

  if (queue.length === 0) return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
      <div style={{
        padding: 34, textAlign: 'center', maxWidth: 440,
        border: 'var(--bw) solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)',
      }}>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 14 }}>Nothing to review ✦</div>
        <p style={{ color: 'var(--ink-soft)', margin: '8px 0 18px', fontSize: 15 }}>
          Your queue is clear. Capture more ideas and they'll resurface when it matters.
        </p>
        <div style={{ margin: '0 0 20px' }}><WeekStrip reviewedDates={reviewedDates} streak={streak} /></div>
        <button
          onClick={onExit}
          style={{
            fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            padding: '11px 24px', border: 'var(--bw) solid var(--line)',
            background: 'var(--learn)', color: 'var(--ink)', cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >Back home</button>
      </div>
    </div>
  )

  if (done) return (
    <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 30 }}>
      <div style={{
        padding: '32px 30px', textAlign: 'center', maxWidth: 460,
        border: 'var(--bw) solid var(--line)', background: 'var(--done)', boxShadow: 'var(--shadow)',
        position: 'relative',
      }}>
        <div style={{
          display: 'inline-block', transform: 'rotate(-6deg)',
          border: '5px solid var(--ink)', padding: '8px 18px',
          fontWeight: 700, fontSize: 22, letterSpacing: '0.02em',
          background: 'var(--paper)', whiteSpace: 'nowrap',
        }}>GARDEN TENDED</div>

        <div style={{ margin: '20px 0 18px' }}><WeekStrip reviewedDates={reviewedDates} streak={streak} big /></div>

        <p style={{ margin: '0 0 20px', fontWeight: 500, fontSize: 15 }}>
          Revisited <b>{queue.length}</b> {queue.length === 1 ? 'memory' : 'memories'} · <b>{stats.got}</b> stuck · <b>{stats.again}</b> coming back sooner.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => { setIdx(0); setRevealed(false); setDone(false); setStats({ got: 0, again: 0 }) }}
            style={{
              fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
              padding: '11px 20px', border: 'var(--bw) solid var(--line)',
              background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
            }}
          >Review again</button>
          <button
            onClick={onExit}
            style={{
              fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
              padding: '11px 20px', border: 'var(--bw) solid var(--line)',
              background: 'var(--learn)', color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
            }}
          >Done</button>
        </div>
      </div>
    </div>
  )

  const card = queue[idx]
  const intentBg = card.intent ? INTENT_BG[card.intent] : '#eee'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 24px', overflowY: 'auto' }}>
      {/* progress bar */}
      <div style={{ width: '100%', maxWidth: 560, marginBottom: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            Recall session
          </span>
          <span className="font-mono" style={{ fontWeight: 700, fontSize: 13 }}>{idx + 1} / {queue.length}</span>
        </div>
        <div style={{ display: 'flex', gap: 5 }}>
          {queue.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 10, border: '2.5px solid var(--line)',
              background: i < idx ? 'var(--done)' : i === idx ? 'var(--learn)' : 'var(--card)',
            }} />
          ))}
        </div>
      </div>

      {/* card */}
      <div style={{
        width: '100%', maxWidth: 560,
        border: 'var(--bw) solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ display: 'flex', gap: 8, padding: '14px 16px', borderBottom: 'var(--bw) solid var(--line)', alignItems: 'center' }}>
          <span className="font-mono" style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
            padding: '3px 8px', border: '2px solid var(--line)', background: 'var(--paper)',
            boxShadow: '2px 2px 0 var(--line)',
          }}>{TYPE_LABEL[card.type] ?? card.type}</span>
          {card.intent && (
            <span className="font-mono" style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 8px', border: '2px solid var(--line)', background: intentBg,
              boxShadow: '2px 2px 0 var(--line)',
            }}>{INTENT_LABEL[card.intent] ?? card.intent}</span>
          )}
          <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-soft)' }}>
            {card.created_at?.slice(0, 10)}
          </span>
        </div>

        {/* cues + blurred answer */}
        <div style={{ padding: '22px 20px' }}>
          {!revealed ? (
            <>
              <p style={{
                margin: '0 0 16px', fontSize: 19, lineHeight: 1.4, fontWeight: 700,
                color: 'var(--ink)',
              }}>
                {getQuestion(card)}
              </p>
              <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 }}>
                Cues
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {card.tags.map(t => (
                  <span key={t} className="font-mono" style={{
                    fontSize: 11.5, padding: '2px 7px', border: '2px solid var(--line)',
                    background: 'var(--paper)', borderRadius: 999, color: 'var(--ink)',
                  }}>{t}</span>
                ))}
                {card.tags.length === 0 && (
                  <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>no tags</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 14 }}>
                ↓ the note
              </div>

              {/* Title */}
              {card.title && (
                <p style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' }}>
                  {card.title}
                </p>
              )}

              {/* Your take */}
              {card.your_take && (
                <div style={{ margin: '0 0 12px', padding: '8px 12px', borderLeft: '3px solid var(--learn)', background: 'var(--paper)' }}>
                  <div className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--learn)', marginBottom: 4 }}>Your take</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.45, fontStyle: 'italic', fontWeight: 500 }}>"{card.your_take}"</p>
                </div>
              )}

              {/* Claims or summary */}
              {Array.isArray(card.claims) && card.claims.length > 1 ? (
                <ul style={{ margin: '0 0 12px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {card.claims.map((c, i) => (
                    <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ flexShrink: 0, marginTop: 7, width: 5, height: 5, borderRadius: '50%', background: 'var(--ink)', opacity: 0.4 }} />
                      <span style={{ fontSize: 15, lineHeight: 1.5, fontWeight: 500 }}>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: '0 0 12px', fontSize: 16, lineHeight: 1.45, fontWeight: 500 }}>{card.summary}</p>
              )}

              {/* Source URL */}
              {card.source_url && (() => {
                let domain = ''
                try { domain = new URL(card.source_url).hostname } catch {}
                return (
                  <a href={card.source_url} target="_blank" rel="noopener noreferrer" className="font-mono"
                    style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 12, fontSize: 11, fontWeight: 700, color: 'var(--ref)', textDecoration: 'none' }}>
                    {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} width={12} height={12} alt="" style={{ border: '1px solid var(--line)' }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↗ {card.source_url}</span>
                  </a>
                )
              })()}

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {card.tags.map(t => (
                  <span key={t} className="font-mono" style={{
                    fontSize: 11, padding: '2px 7px', border: '2px solid var(--line)',
                    background: 'var(--paper)', borderRadius: 999, color: 'var(--ink)',
                  }}>{t}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* action row */}
        <div style={{ padding: 14, borderTop: 'var(--bw) solid var(--line)' }}>
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              style={{
                width: '100%', fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                padding: '11px 0', border: 'var(--bw) solid var(--line)',
                background: 'var(--ref)', color: 'var(--paper)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
              }}
            >Reveal ↓</button>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => rate('again')}
                style={{
                  flex: 1, fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
                  padding: '11px 0', border: 'var(--bw) solid var(--line)',
                  background: 'var(--act)', color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                }}
              >↺ Again</button>
              <button
                onClick={() => rate('got_it')}
                style={{
                  flex: 1, fontSize: 14, fontWeight: 700, textTransform: 'uppercase',
                  padding: '11px 0', border: 'var(--bw) solid var(--line)',
                  background: 'var(--done)', color: 'var(--ink)', cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
                }}
              >✓ Got it</button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onExit}
        className="font-mono"
        style={{
          marginTop: 18, background: 'transparent', border: 'none',
          fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--ink-soft)', cursor: 'pointer', textDecoration: 'underline',
        }}
      >Exit session</button>
    </div>
  )
}
