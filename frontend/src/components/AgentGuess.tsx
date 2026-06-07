import { useState } from 'react'
import type { Capture, Intent } from '../types'
import { patchCapture } from '../api'

const INTENTS: { id: Intent; label: string; color: string }[] = [
  { id: 'learn',     label: 'LEARN',     color: 'var(--learn)' },
  { id: 'act',       label: 'ACT',       color: 'var(--act)' },
  { id: 'reference', label: 'REFERENCE', color: 'var(--ref)' },
  { id: 'ephemeral', label: 'EPHEMERAL', color: 'var(--eph)' },
]

interface Props {
  capture: Capture
  onConfirm: () => void
  onUpdate: (updated: Partial<Capture>) => void
}

export function AgentGuess({ capture, onConfirm, onUpdate }: Props) {
  const [localIntent, setLocalIntent] = useState<Intent | null>(capture.intent)
  const [localTags, setLocalTags] = useState<string[]>(capture.tags ?? [])
  const [adding, setAdding] = useState('')
  const [touched, setTouched] = useState(false)
  async function handleIntentClick(intent: Intent) {
    setLocalIntent(intent)
    setTouched(true)
    await patchCapture(capture.id, { intent })
    onUpdate({ intent })
  }

  function removeTag(t: string) {
    const next = localTags.filter(x => x !== t)
    setLocalTags(next)
    setTouched(true)
    patchCapture(capture.id, { tags: next })
    onUpdate({ tags: next })
  }

  function addTag(t: string) {
    const clean = t.trim().toLowerCase()
    if (!clean || localTags.includes(clean)) return
    const next = [...localTags, clean]
    setLocalTags(next)
    setTouched(true)
    patchCapture(capture.id, { tags: next })
    onUpdate({ tags: next })
  }

  return (
    <section style={{
      border: 'var(--bw) solid var(--line)',
      background: 'var(--card)',
      boxShadow: 'var(--shadow)',
      overflow: 'hidden',
    }}>
      {/* agent header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px',
        background: 'var(--ink)', color: 'var(--paper)',
      }}>
        <span style={{
          width: 24, height: 24, display: 'grid', placeItems: 'center',
          background: 'var(--learn)', border: '2.5px solid var(--paper)',
          fontWeight: 700, fontSize: 13, color: 'var(--ink)',
        }}>✦</span>
        <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em' }}>
          {touched ? 'GOT IT — I\'LL REMEMBER' : 'I FILED THIS — RIGHT?'}
        </span>
        <button
          onClick={onConfirm}
          style={{
            marginLeft: 'auto', background: 'transparent', border: 'none',
            color: 'var(--paper)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 4px',
          }}
        >✕</button>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {/* preview */}
        <p style={{
          margin: '0 0 14px', fontSize: 14, lineHeight: 1.45, fontWeight: 500,
          color: 'var(--ink)', overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          "{capture.summary || capture.raw || ''}"
        </p>

        {/* intent buttons */}
        <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 }}>
          Intent — tap to re-file
        </div>
        <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
          {INTENTS.map(({ id, label, color }) => {
            const on = localIntent === id
            return (
              <button
                key={id}
                onClick={() => handleIntentClick(id)}
                className="font-mono"
                style={{
                  fontWeight: 700, fontSize: 11, letterSpacing: '0.06em',
                  padding: '6px 11px', border: '2.5px solid var(--line)',
                  cursor: 'pointer', textTransform: 'uppercase',
                  background: on ? color : 'var(--card)', color: 'var(--ink)',
                  boxShadow: on ? '2px 2px 0 var(--line)' : 'none',
                  transform: on ? 'translate(-1px,-1px)' : 'none',
                  transition: 'transform .06s, box-shadow .06s',
                }}
              >{label}</button>
            )
          })}
        </div>

        {/* tags */}
        <div className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: 8 }}>
          Tags — ✕ to drop
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {localTags.map(t => (
            <span
              key={t}
              className="font-mono"
              style={{
                fontSize: 11.5, padding: '2px 7px', border: '2px solid var(--line)',
                background: 'var(--paper)', borderRadius: 999, color: 'var(--ink)',
                display: 'inline-flex', alignItems: 'center', gap: 5, paddingRight: 4,
              }}
            >
              {t}
              <button
                onClick={() => removeTag(t)}
                style={{
                  border: 'none', background: 'var(--ink)', color: 'var(--paper)',
                  cursor: 'pointer', width: 15, height: 15, borderRadius: '50%',
                  fontSize: 10, lineHeight: 1, display: 'grid', placeItems: 'center',
                }}
              >✕</button>
            </span>
          ))}
          <input
            value={adding}
            onChange={e => setAdding(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                addTag(adding)
                setAdding('')
              }
            }}
            placeholder="+ add"
            className="font-mono"
            style={{
              border: '2px dashed var(--ink-soft)', background: 'transparent', borderRadius: 999,
              fontSize: 11.5, padding: '2px 9px', width: 64, outline: 'none', color: 'var(--ink)',
            }}
          />
        </div>

        <button
          onClick={onConfirm}
          style={{
            width: '100%', marginTop: 16,
            fontSize: 14, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            padding: '11px 0', border: 'var(--bw) solid var(--line)',
            background: 'var(--done)', color: 'var(--ink)', cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >✓ Looks right</button>
      </div>
    </section>
  )
}
