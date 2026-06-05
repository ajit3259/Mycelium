import { useEffect, useRef, useState } from 'react'
import type { Capture } from '../types'
import { markDone, markSkip, logEvent } from '../api'

const INTENT_BG: Record<string, string> = {
  learn:     'var(--learn)',
  act:       'var(--act)',
  reference: 'var(--ref)',
  ephemeral: 'var(--eph)',
}

const INTENT_LABEL: Record<string, string> = {
  learn: 'LEARN', act: 'ACT', reference: 'REFERENCE', ephemeral: 'EPHEMERAL',
}

const TYPE_LABEL: Record<string, string> = {
  text: 'TEXT', link: 'LINK', image: 'IMAGE',
}

function Badge({ label, bg }: { label: string; bg: string }) {
  return (
    <span
      className="font-mono text-[10px] font-bold uppercase leading-none whitespace-nowrap inline-flex items-center border-2 border-[var(--line)]"
      style={{ background: bg, letterSpacing: '0.08em', padding: '3px 8px', boxShadow: '2px 2px 0 var(--line)' }}
    >
      {label}
    </span>
  )
}

function RelatedCard({ capture }: { capture: Capture }) {
  const intentBg = (capture.intent ? INTENT_BG[capture.intent] : null) ?? '#ccc'
  return (
    <div style={{ borderLeft: `4px solid ${intentBg}`, paddingLeft: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--paper)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        {capture.type && <Badge label={TYPE_LABEL[capture.type] ?? capture.type} bg="var(--card)" />}
        {capture.intent && <Badge label={INTENT_LABEL[capture.intent] ?? capture.intent} bg={INTENT_BG[capture.intent] ?? '#eee'} />}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--ink-soft)', margin: 0 }}>
        {capture.summary ?? capture.raw ?? '—'}
      </p>
      {capture.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
          {capture.tags.map(t => (
            <span key={t} className="font-mono" style={{ fontSize: 10, padding: '2px 7px', border: '2px solid var(--line)', background: 'var(--paper)', borderRadius: 999, color: 'var(--ink-soft)' }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

interface CardProps {
  capture: Capture
  variant: 'feed' | 'surface'
  onAction?: () => void
  onPick?: (c: Capture) => void
}

export function Card({ capture, variant, onAction, onPick }: CardProps) {
  const dwellStart = useRef<number>(Date.now())
  const [stamping, setStamping] = useState(false)

  useEffect(() => { dwellStart.current = Date.now() }, [capture.id])

  const getDwell = () => Math.round((Date.now() - dwellStart.current) / 1000)

  async function handleDone() {
    await logEvent({ capture_id: capture.id, event: 'dwell', value: String(getDwell()) })
    setStamping(true)
    setTimeout(async () => {
      await markDone(capture.id)
      onAction?.()
    }, 600)
  }

  async function handleSkip() {
    await logEvent({ capture_id: capture.id, event: 'dwell', value: String(getDwell()) })
    await markSkip(capture.id)
    onAction?.()
  }

  const intentBg = (capture.intent ? INTENT_BG[capture.intent] : null) ?? '#eee'

  // Reference-matched padding: feed = 13px 15px, surface = 18px 18px 14px
  const innerPad = variant === 'feed'
    ? '13px 15px'
    : '18px 18px 14px'

  return (
    <div
      className="relative overflow-hidden"
      style={{
        display: 'flex',
        border: 'var(--bw) solid var(--line)',
        background: 'var(--card)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform .08s, box-shadow .08s',
        cursor: variant === 'feed' && onPick ? 'pointer' : 'default',
      }}
      onClick={variant === 'feed' && onPick ? () => onPick(capture) : undefined}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-2px,-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
    >
      {/* Intent color spine */}
      <div style={{ width: 12, background: intentBg, borderRight: 'var(--bw) solid var(--line)', flexShrink: 0 }} />

      <div style={{ padding: innerPad, flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
          <Badge label={TYPE_LABEL[capture.type] ?? capture.type} bg="var(--paper)" />
          {capture.intent && (
            <Badge label={INTENT_LABEL[capture.intent] ?? capture.intent} bg={intentBg} />
          )}
          {variant === 'feed' && (
            <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-soft)' }}>
              {capture.created_at?.slice(0, 16).replace('T', ' ')}
            </span>
          )}
        </div>

        {/* Summary */}
        {capture.summary ? (
          <p style={{ margin: 0, fontSize: variant === 'surface' ? 19 : 16, lineHeight: 1.4, fontWeight: 500 }}>
            {capture.summary}
          </p>
        ) : (
          <p className="font-mono" style={{ margin: 0, fontSize: 14, color: 'var(--ink-soft)', fontStyle: 'italic' }}>
            processing…
          </p>
        )}

        {/* Source URL */}
        {capture.source_url && (
          <a
            href={capture.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{ display: 'block', marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--ref)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            ↗ {capture.source_url}
          </a>
        )}

        {/* Tags */}
        {capture.tags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 11 }}>
            {capture.tags.map(t => (
              <span
                key={t}
                className="font-mono"
                style={{ fontSize: 11.5, padding: '2px 7px', border: '2px solid var(--line)', background: 'var(--paper)', borderRadius: 999, color: 'var(--ink)', whiteSpace: 'nowrap' }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Connected */}
        {variant === 'surface' && capture.related && capture.related.length > 0 && (
          <div style={{ borderTop: 'var(--bw) solid var(--line)', marginTop: 14 }}>
            <p className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', padding: '10px 0 0' }}>
              ◇ Connected · {capture.related.length}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {capture.related.map(r => <RelatedCard key={r.id} capture={r} />)}
            </div>
          </div>
        )}

        {/* Actions */}
        {variant === 'surface' && (
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={handleDone}
              className="font-bold"
              style={{
                flex: 1, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
                padding: '11px 0', border: 'var(--bw) solid var(--line)',
                background: 'var(--done)', color: 'var(--ink)', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)', transition: 'transform .06s, box-shadow .06s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translate(3px,3px)'; e.currentTarget.style.boxShadow = 'none' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
            >
              ✓ Done
            </button>
            <button
              onClick={handleSkip}
              className="font-bold"
              style={{
                flex: 1, fontSize: 14, letterSpacing: '0.04em', textTransform: 'uppercase',
                padding: '11px 0', border: 'var(--bw) solid var(--line)',
                background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)', transition: 'transform .06s, box-shadow .06s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--shadow-sm)' }}
              onMouseDown={e => { e.currentTarget.style.transform = 'translate(3px,3px)'; e.currentTarget.style.boxShadow = 'none' }}
              onMouseUp={e => { e.currentTarget.style.transform = 'translate(-1px,-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow)' }}
            >
              Skip →
            </button>
          </div>
        )}
      </div>

      {/* DONE stamp */}
      {stamping && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: 'rgba(255,253,246,.7)' }}>
          <div
            className="font-bold"
            style={{ fontSize: 64, color: 'var(--done)', border: '6px solid var(--done)', padding: '6px 22px', letterSpacing: '0.04em', background: 'rgba(255,253,246,.7)', animation: 'stamp .5s cubic-bezier(.2,1.4,.4,1) both' }}
          >
            DONE
          </div>
        </div>
      )}
    </div>
  )
}
