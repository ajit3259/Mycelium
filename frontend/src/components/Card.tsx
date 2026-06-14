import { useEffect, useRef, useState } from 'react'
import type { Capture } from '../types'
import { markDone, markSkip, logEvent, deleteCapture } from '../api'
import { ConnectionGraph } from './ConnectionGraph'
import { ImageThumb } from './ImageThumb'

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


interface CardProps {
  capture: Capture
  variant: 'feed' | 'surface'
  onAction?: () => void
  onPick?: (c: Capture) => void
  onDelete?: (id: number) => void
}

export function Card({ capture, variant, onAction, onPick, onDelete }: CardProps) {
  const dwellStart = useRef<number>(Date.now())
  const [stamping, setStamping] = useState(false)

  const isProcessing = !capture.summary

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

  async function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation()
    const ok = await deleteCapture(capture.id)
    if (ok) onDelete?.(capture.id)
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
        cursor: variant === 'feed' && onPick && !isProcessing ? 'pointer' : 'default',
      }}
      onClick={variant === 'feed' && onPick && !isProcessing ? () => onPick(capture) : undefined}
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

        {/* Title */}
        {capture.title && (
          <p className="font-bold" style={{
            margin: '0 0 8px',
            fontSize: variant === 'surface' ? 18 : 15,
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
          }}>
            {capture.title}
          </p>
        )}

        {/* Image thumbnail */}
        {capture.type === 'image' && capture.file_path && (
          <ImageThumb
            src={`/uploads/${capture.file_path.split('/').pop()}`}
            alt={capture.summary ?? 'image capture'}
            thumbHeight={variant === 'surface' ? 200 : 140}
          />
        )}

        {/* Your take — shown prominently when present */}
        {capture.your_take && (
          <div style={{
            margin: '0 0 10px',
            padding: '8px 12px',
            borderLeft: '3px solid var(--learn)',
            background: 'var(--paper)',
          }}>
            <div className="font-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--learn)', marginBottom: 4 }}>
              Your take
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, fontWeight: 500, fontStyle: 'italic', color: 'var(--ink)' }}>
              "{capture.your_take}"
            </p>
          </div>
        )}

        {/* Delete button for failed captures */}
        {capture.summary?.startsWith('⚠') && variant === 'feed' && onDelete && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <p className="font-mono" style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--act)' }}>
              {capture.summary}
            </p>
            <button
              onClick={handleDismiss}
              className="font-mono"
              style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '4px 10px', border: '2px solid var(--act)', background: 'var(--paper)', color: 'var(--act)', cursor: 'pointer', letterSpacing: '0.06em' }}
            >Delete</button>
          </div>
        )}

        {/* Claims as bullet points (if available), else summary */}
        {capture.summary && !capture.summary.startsWith('⚠') ? (
          Array.isArray(capture.claims) && capture.claims.length > 1 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {capture.claims.map((claim, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    flexShrink: 0, marginTop: 5,
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--ink)', opacity: 0.4,
                  }} />
                  <span style={{ fontSize: variant === 'surface' ? 16 : 14, lineHeight: 1.45, fontWeight: 500 }}>
                    {claim}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: variant === 'surface' ? 19 : 16, lineHeight: 1.4, fontWeight: 500 }}>
              {capture.summary}
            </p>
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p className="font-mono" style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--ink-soft)', textTransform: 'uppercase', animation: 'pulse-opacity 1.6s ease-in-out infinite' }}>
                ◌ Processing…
              </p>
              {(capture.raw || capture.source_url) && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {(capture.raw || capture.source_url)!.slice(0, 120)}
                </p>
              )}
            </div>
            {variant === 'feed' && onDelete && (
              <button
                onClick={handleDismiss}
                title="Dismiss"
                className="font-mono"
                style={{ flexShrink: 0, fontSize: 14, lineHeight: 1, padding: '2px 6px', border: '2px solid var(--line)', background: 'var(--paper)', color: 'var(--ink-soft)', cursor: 'pointer' }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Source URL with favicon */}
        {capture.source_url && (() => {
          let domain = ''
          try { domain = new URL(capture.source_url).hostname } catch {}
          return (
            <a
              href={capture.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono"
              style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, fontSize: 11.5, fontWeight: 700, color: 'var(--ref)', overflow: 'hidden', textDecoration: 'none' }}
            >
              {domain && (
                <img
                  src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                  width={13} height={13}
                  style={{ flexShrink: 0, border: '1px solid var(--line)' }}
                  alt=""
                />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>↗ {capture.source_url}</span>
            </a>
          )
        })()}

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

        {/* Source content link */}
        {capture.source_content_path && (
          <a
            href={`/uploads/content/${capture.id}.txt`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono"
            style={{ display: 'inline-block', marginTop: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-soft)', textDecoration: 'none', opacity: 0.6 }}
          >
            ↗ view source
          </a>
        )}

        {/* Connected — graph visualization */}
        {variant === 'surface' && capture.related && capture.related.length > 0 && (
          <div style={{ borderTop: 'var(--bw) solid var(--line)', marginTop: 14, background: 'var(--paper)', margin: '14px -15px -14px' }}>
            <p className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--ink-soft)', padding: '10px 16px 0' }}>
              ◇ Connected · {capture.related_ids?.length ?? capture.related.length}
            </p>
            <ConnectionGraph item={capture} onPick={onPick} />
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
