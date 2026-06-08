import { useState, useEffect, useMemo } from 'react'
import type { Capture } from '../types'
import { getBrief, getBriefDates, briefSynthesize, briefWeeklySynthesize } from '../api'
import { Card } from './Card'

const INTENT_ORDER = ['learn', 'act', 'reference', 'ephemeral', 'other']
const INTENT_ACCENT: Record<string, string> = {
  learn: 'var(--learn)', act: 'var(--act)', reference: 'var(--ref)',
  ephemeral: 'var(--eph)', other: 'var(--paper)',
}
const INTENT_LABEL: Record<string, string> = {
  learn: 'Learning', act: 'To do', reference: 'Reference',
  ephemeral: 'Fleeting', other: 'Other',
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10)
}

function WeekBar({ dates }: { dates: { date: string; count: number }[] }) {
  const last7 = dates.slice(0, 7)
  const max = Math.max(...last7.map(d => d.count), 1)
  const total = last7.reduce((n, d) => n + d.count, 0)
  return (
    <div style={{ padding: '20px 24px' }}>
      <div className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-soft)', marginBottom: 14 }}>
        LAST 7 DAYS — {total} CAPTURES
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
        {last7.map(d => (
          <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: '100%',
                height: Math.max(4, (d.count / max) * 48),
                background: isToday(d.date) ? 'var(--learn)' : 'var(--ink)',
                border: '1.5px solid var(--line)',
                transition: 'height .3s ease',
              }}
            />
            <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink-soft)', fontWeight: 700 }}>
              {new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'narrow' })}
            </span>
            {d.count > 0 && (
              <span className="font-mono" style={{ fontSize: 9, color: 'var(--ink)', fontWeight: 700 }}>
                {d.count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const synthCache: Record<string, string> = {}
const synthRequested = new Set<string>()
const weekSynthCache: Record<string, string> = {}
const weekSynthRequested = new Set<string>()

interface Props {
  onPick?: (c: Capture) => void
}

export function BriefScreen({ onPick }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [tab, setTab] = useState<'day' | 'week'>('day')
  const [dates, setDates] = useState<{ date: string; count: number }[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(today)
  const [grouped, setGrouped] = useState<Record<string, Capture[]>>({})
  const [loading, setLoading] = useState(true)
  const [synthesis, setSynthesis] = useState<string | null>(null)
  const [synthesizing, setSynthesizing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [read, setRead] = useState(false)
  const [weekSynthesis, setWeekSynthesis] = useState<string | null>(null)
  const [weekSynthesizing, setWeekSynthesizing] = useState(false)
  // increments whenever a daily synthesis lands, so the weekly effect can re-check
  const [synthLanded, setSynthLanded] = useState(0)

  // Weekly synthesis: re-evaluates whenever tab, dates, or a daily synthesis lands
  useEffect(() => {
    if (tab !== 'week' || dates.length === 0) return
    const last7 = dates.slice(0, 7)
    const daily_entries = last7
      .filter(d => synthCache[d.date])
      .map(d => ({ date: d.date, synthesis: synthCache[d.date], count: d.count }))
    // key includes how many days are covered — grows as more days are reviewed
    const weekKey = last7.map(d => d.date).join('-') + `|${daily_entries.length}`
    setWeekSynthesis(weekSynthCache[weekKey] ?? null)
    if (weekSynthRequested.has(weekKey)) return
    if (daily_entries.length < 2) return
    weekSynthRequested.add(weekKey)
    setWeekSynthesizing(true)
    briefWeeklySynthesize(daily_entries)
      .then(r => { weekSynthCache[weekKey] = r.synthesis; setWeekSynthesis(r.synthesis) })
      .catch(() => {})
      .finally(() => setWeekSynthesizing(false))
  }, [tab, dates, synthLanded])

  useEffect(() => {
    getBriefDates().then(setDates).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setExpanded(false)
    setRead(false)
    // Restore from cache immediately if available
    setSynthesis(synthCache[selectedDate] ?? null)
    setSynthesizing(false)
    getBrief(selectedDate)
      .then(g => {
        setGrouped(g)
        setLoading(false)
        const allCaptures = INTENT_ORDER.flatMap(k => g[k] ?? [])
        if (allCaptures.length > 0 && !synthRequested.has(selectedDate)) {
          synthRequested.add(selectedDate)
          setSynthesizing(true)
          const dateLabel = isToday(selectedDate) ? 'today' : formatDate(selectedDate)
          briefSynthesize(allCaptures.map(c => c.id), dateLabel)
            .then(r => {
              synthCache[selectedDate] = r.synthesis
              setSynthesis(r.synthesis)
              setSynthLanded(n => n + 1)
            })
            .catch(() => {})
            .finally(() => setSynthesizing(false))
        }
      })
      .catch(() => { setGrouped({}); setLoading(false) })
  }, [selectedDate])

  const allCaptures = useMemo(
    () => INTENT_ORDER.flatMap(k => grouped[k] ?? []),
    [grouped],
  )

  // Pick 2-3 highlights: first learn, first act, first reference (in that priority)
  const highlights = useMemo(() => {
    const picks: Capture[] = []
    for (const intent of ['learn', 'act', 'reference']) {
      const items = grouped[intent] ?? []
      if (items.length > 0) picks.push(items[0])
      if (picks.length >= 3) break
    }
    // if < 2, pad with ephemeral or other
    if (picks.length < 2) {
      for (const intent of ['ephemeral', 'other']) {
        const items = grouped[intent] ?? []
        if (items.length > 0 && !picks.find(p => p.id === items[0].id)) {
          picks.push(items[0])
          if (picks.length >= 2) break
        }
      }
    }
    return picks
  }, [grouped])

  // Full list excluding highlights
  const highlightIds = useMemo(() => new Set(highlights.map(c => c.id)), [highlights])
  const restCaptures = useMemo(() => allCaptures.filter(c => !highlightIds.has(c.id)), [allCaptures, highlightIds])

  const groups = INTENT_ORDER
    .filter(k => grouped[k]?.length > 0)
    .map(k => ({ key: k, items: grouped[k]! }))

  const dateLabel = isToday(selectedDate)
    ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : formatDate(selectedDate)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 30px', position: 'relative' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>

        {/* Tab strip */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '2px solid var(--line)', width: 'fit-content' }}>
          {(['day', 'week'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="font-mono"
              style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '7px 20px', border: 'none', borderRight: t === 'day' ? '2px solid var(--line)' : 'none',
                background: tab === t ? 'var(--ink)' : 'var(--card)',
                color: tab === t ? 'var(--paper)' : 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {t === 'day' ? 'Daily' : 'Weekly'}
            </button>
          ))}
        </div>

        {tab === 'week' ? (
          <div style={{ border: '2px solid var(--line)', background: 'var(--card)', boxShadow: 'var(--shadow-sm)' }}>
            {/* Cover */}
            <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '22px 24px', borderBottom: '2px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: weekSynthesis || weekSynthesizing ? 16 : 0 }}>
                <div>
                  <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--learn)', fontWeight: 700, marginBottom: 4 }}>
                    WEEKLY OVERVIEW
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em' }}>
                    {dates.slice(0, 7).reduce((n, d) => n + d.count, 0)} captures this week
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: 'var(--learn)' }}>
                    {dates.slice(0, 7).filter(d => synthCache[d.date]).length}
                    <span style={{ fontSize: 16, opacity: 0.6 }}>/{Math.min(dates.length, 7)}</span>
                  </div>
                  <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.08em', opacity: 0.7 }}>DAYS REVIEWED</div>
                </div>
              </div>

              {weekSynthesizing && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
                  <div className="font-mono" style={{ fontSize: 11, color: 'var(--learn)', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                    ◌ Finding threads across your week…
                  </div>
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 2, width: '70%', marginBottom: 6 }} />
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.07)', borderRadius: 2, width: '55%', marginBottom: 6 }} />
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 2, width: '40%' }} />
                </div>
              )}
              {weekSynthesis && !weekSynthesizing && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--learn)', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>
                    ◆ THIS WEEK'S THREAD
                  </div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
                    {weekSynthesis}
                  </p>
                </div>
              )}
              {!weekSynthesis && !weekSynthesizing && dates.slice(0, 7).filter(d => synthCache[d.date]).length < 2 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
                  <p className="font-mono" style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.04em' }}>
                    Visit at least 2 daily briefs to unlock the weekly thread synthesis.
                  </p>
                </div>
              )}
            </div>
            <WeekBar dates={dates} />
          </div>
        ) : (
          <>
            {/* Date strip */}
            {dates.length > 1 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
                <button
                  onClick={() => setSelectedDate(today)}
                  className="font-mono"
                  style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '5px 12px', border: '2.5px solid var(--line)',
                    background: selectedDate === today ? 'var(--ink)' : 'var(--card)',
                    color: selectedDate === today ? 'var(--paper)' : 'var(--ink)',
                    cursor: 'pointer', boxShadow: selectedDate === today ? 'none' : '2px 2px 0 var(--line)',
                  }}
                >Today</button>
                {dates.filter(d => d.date !== today).map(d => (
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
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: synthesis || synthesizing ? 16 : 0 }}>
                <div>
                  <div className="font-mono" style={{ fontSize: 11, letterSpacing: '0.18em', color: 'var(--learn)', fontWeight: 700, marginBottom: 4 }}>
                    {dateLabel.toUpperCase()}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>
                    {isToday(selectedDate) ? 'Daily Brief' : 'Past Brief'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1, color: 'var(--learn)' }}>
                    {loading ? '—' : allCaptures.length}
                  </div>
                  <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.1em', opacity: 0.7 }}>CAPTURES</div>
                </div>
              </div>

              {/* Synthesis */}
              {synthesizing && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
                  <div className="font-mono" style={{ fontSize: 11, color: 'var(--learn)', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 6 }}>
                    ◌ Synthesizing…
                  </div>
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 2, width: '60%', marginBottom: 6 }} />
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.07)', borderRadius: 2, width: '80%', marginBottom: 6 }} />
                  <div style={{ height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 2, width: '45%' }} />
                </div>
              )}
              {synthesis && !synthesizing && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: 14 }}>
                  <div className="font-mono" style={{ fontSize: 10, color: 'var(--learn)', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>
                    ◆ TODAY'S SYNTHESIS
                  </div>
                  <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)', fontWeight: 400 }}>
                    {synthesis}
                  </p>
                </div>
              )}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                <span className="font-mono" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.1em' }}>Loading…</span>
              </div>
            )}

            {!loading && allCaptures.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.6 }}>
                <div style={{ fontSize: 40 }}>◎</div>
                <p style={{ fontWeight: 500, marginTop: 8 }}>
                  {isToday(selectedDate) ? 'Nothing captured today yet.' : 'No captures found for this date.'}
                </p>
              </div>
            )}

            {/* Highlights */}
            {!loading && highlights.length > 0 && (
              <section style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-soft)' }}>
                    ◆ HIGHLIGHTS
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>
                    {highlights.length} of {allCaptures.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {highlights.map(c => (
                    <Card key={c.id} capture={c} variant="feed" onPick={onPick} />
                  ))}
                </div>
              </section>
            )}

            {/* Collapsible full list */}
            {!loading && restCaptures.length > 0 && (
              <section style={{ marginBottom: 24 }}>
                <button
                  onClick={() => setExpanded(v => !v)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', marginBottom: 12,
                  }}
                >
                  <div className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--ink-soft)' }}>
                    {expanded ? '▾' : '▸'} ALL CAPTURES
                  </div>
                  <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                  <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700 }}>
                    {restCaptures.length} more
                  </span>
                </button>

                {expanded && (
                  <div>
                    {groups.map(g => {
                      const restInGroup = g.items.filter(c => !highlightIds.has(c.id))
                      if (restInGroup.length === 0) return null
                      return (
                        <div key={g.key} style={{ marginBottom: 22 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{
                              width: 10, height: 10, background: INTENT_ACCENT[g.key],
                              border: '2px solid var(--line)', flexShrink: 0,
                            }} />
                            <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--ink-soft)' }}>
                              {INTENT_LABEL[g.key] ?? g.key}
                            </span>
                            <span className="font-mono" style={{ fontSize: 10, color: 'var(--ink-soft)', marginLeft: 'auto' }}>
                              {restInGroup.length}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {restInGroup.map(c => (
                              <Card key={c.id} capture={c} variant="feed" onPick={onPick} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Mark read */}
            {!loading && allCaptures.length > 0 && isToday(selectedDate) && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30, marginBottom: 10 }}>
                <button
                  onClick={() => setRead(true)}
                  disabled={read}
                  style={{
                    fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                    padding: '12px 26px', border: 'var(--bw) solid var(--line)',
                    background: read ? 'var(--card)' : 'var(--done)',
                    color: 'var(--ink)', cursor: read ? 'default' : 'pointer',
                    boxShadow: read ? 'none' : 'var(--shadow-sm)',
                  }}
                >
                  {read ? '✓ Brief read for today' : 'Mark brief as read'}
                </button>
              </div>
            )}
          </>
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
