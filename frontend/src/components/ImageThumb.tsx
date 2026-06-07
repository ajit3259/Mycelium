import { useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  src: string
  alt: string
  thumbHeight?: number
}

export function ImageThumb({ src, alt, thumbHeight = 160 }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          cursor: 'zoom-in', position: 'relative',
          border: 'var(--bw) solid var(--line)', background: 'var(--paper)',
          overflow: 'hidden', marginBottom: 10,
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{ display: 'block', width: '100%', height: thumbHeight, objectFit: 'contain' }}
        />
        <span style={{
          position: 'absolute', bottom: 5, right: 6,
          fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
          background: 'var(--ink)', color: 'var(--paper)',
          padding: '2px 6px', opacity: 0.75,
        }}>⊕ expand</span>
      </div>

      {open && createPortal(
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.88)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={src}
            alt={alt}
            style={{ maxWidth: '92vw', maxHeight: '92vh', objectFit: 'contain' }}
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', top: 18, right: 22,
              background: 'transparent', border: 'none',
              color: '#fff', fontSize: 28, cursor: 'pointer', lineHeight: 1, opacity: 0.8,
            }}
          >✕</button>
        </div>,
        document.body
      )}
    </>
  )
}
