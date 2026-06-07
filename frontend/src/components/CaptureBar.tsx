import { useState, useRef, useCallback, useEffect } from 'react'
import type { Mood } from '../types'
import { captureText, captureLink, captureImage } from '../api'

type Tab = 'note' | 'link' | 'image'
const TABS: { id: Tab; label: string }[] = [
  { id: 'note',  label: 'NOTE' },
  { id: 'link',  label: 'LINK' },
  { id: 'image', label: 'IMAGE' },
]
const MOODS: Mood[] = ['focused', 'curious', 'restless', 'tired', 'inspired']

function MoodPicker({ value, onChange }: { value: Mood | ''; onChange: (m: Mood | '') => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const label = value ? value.toUpperCase() : 'MOOD ▾'

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="font-mono w-full h-full text-[12px] font-bold tracking-[0.1em] border-none outline-none cursor-pointer py-3"
        style={{
          background: value ? 'var(--eph)' : 'var(--card)',
          color: 'var(--ink)',
          display: 'block',
        }}
      >
        {label}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, zIndex: 50, minWidth: 120,
            background: 'var(--card)', border: '2px solid var(--line)',
            boxShadow: 'var(--shadow)', marginTop: 2,
          }}
        >
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="font-mono w-full text-left text-[11px] font-bold uppercase tracking-[0.08em] px-4 py-2.5 border-b-2 border-[var(--line)]"
              style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
            >
              Clear
            </button>
          )}
          {MOODS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { onChange(m); setOpen(false) }}
              className="font-mono w-full text-left text-[12px] font-bold uppercase tracking-[0.08em] px-4 py-2.5"
              style={{
                background: value === m ? 'var(--eph)' : 'var(--card)',
                color: 'var(--ink)',
                borderBottom: '1px solid var(--line)',
                display: 'block',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
              onMouseLeave={e => (e.currentTarget.style.background = value === m ? 'var(--eph)' : 'var(--card)')}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface Props {
  onCapture: (id: number) => void
  mood: Mood | ''
  onMoodChange: (m: Mood | '') => void
}

export function CaptureBar({ onCapture, mood, onMoodChange }: Props) {
  const [tab, setTab] = useState<Tab>('note')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Generate/revoke object URL for image preview
  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleCapture = useCallback(async () => {
    if (loading) return
    setLoading(true)
    try {
      let res: { id: number } | null = null
      if (tab === 'note' && note.trim()) {
        res = await captureText(note.trim()); setNote('')
      } else if (tab === 'link' && link.trim()) {
        res = await captureLink(link.trim()); setLink('')
      } else if (tab === 'image' && file) {
        res = await captureImage(file, caption); setFile(null); setCaption('')
      } else return
      if (res) onCapture(res.id)
    } finally {
      setLoading(false)
    }
  }, [tab, note, link, file, caption, loading, onCapture])

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleCapture()
    }
  }

  function pickFile(f: File) {
    if (f.type.startsWith('image/')) setFile(f)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) pickFile(e.dataTransfer.files[0])
  }

  return (
    <section className="border-2 border-[var(--line)] overflow-hidden" style={{ background: 'var(--card)', boxShadow: 'var(--shadow)' }}>
      {/* Tab strip */}
      <div className="flex border-b-2 border-[var(--line)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="font-mono flex-1 py-3 border-r-2 border-[var(--line)] last:border-r-0 text-[12px] font-bold tracking-[0.12em] transition-colors"
            style={{
              background: tab === t.id ? 'var(--ink)' : 'var(--card)',
              color: tab === t.id ? 'var(--paper)' : 'var(--ink)',
            }}
          >
            {t.label}
          </button>
        ))}
        {/* Mood selector — custom to avoid OS native dropdown */}
        <div className="flex-1 border-l-2 border-[var(--line)]">
          <MoodPicker value={mood} onChange={onMoodChange} />
        </div>
      </div>

      {/* Input area */}
      {tab === 'note' && (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="What's on your mind?"
          rows={5}
          className="w-full resize-none border-none outline-none px-5 py-4 text-[17px] leading-relaxed block"
          style={{ background: 'var(--card)', color: 'var(--ink)' }}
        />
      )}

      {tab === 'link' && (
        <input
          type="url"
          value={link}
          onChange={e => setLink(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Paste a URL to capture…"
          className="w-full border-none outline-none px-5 py-4 text-[17px] font-mono block"
          style={{ background: 'var(--card)', color: 'var(--ink)', minHeight: 120 }}
        />
      )}

      {tab === 'image' && (
        <div>
          {/* Drop zone — compact when file selected */}
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center cursor-pointer transition-all"
              style={{
                minHeight: 120,
                margin: 16,
                border: `2px dashed ${dragging ? 'var(--ink)' : '#bbb'}`,
                background: dragging ? 'var(--paper)' : 'transparent',
                color: dragging ? 'var(--ink)' : '#aaa',
              }}
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest">
                ↓ drop image or click to choose
              </p>
            </div>
          ) : (
            <div>
              {/* Preview row */}
              <div
                style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '2px solid var(--line)', background: 'var(--paper)', alignItems: 'flex-start' }}
              >
                {/* Thumbnail */}
                <div
                  style={{ width: 80, height: 64, flexShrink: 0, border: '2px solid var(--line)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to change image"
                >
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="preview"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  )}
                  {/* Change overlay */}
                  <div
                    style={{
                      position: 'absolute', inset: 0, background: 'rgba(24,20,16,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: 0, transition: 'opacity .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <span className="font-mono" style={{ fontSize: 9, fontWeight: 700, color: 'white', letterSpacing: '0.1em' }}>CHANGE</span>
                  </div>
                </div>

                {/* Filename + clear */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="font-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    ✓ {file.name}
                  </p>
                  <button
                    onClick={() => { setFile(null); setCaption('') }}
                    className="font-mono"
                    style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    remove
                  </button>
                </div>
              </div>

              {/* Optional caption */}
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Add a note about this image… (optional)"
                rows={3}
                className="w-full resize-none border-none outline-none px-5 py-4 text-[16px] leading-relaxed block"
                style={{ background: 'var(--card)', color: 'var(--ink)' }}
              />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && pickFile(e.target.files[0])}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3 border-t-2 border-[var(--line)]" style={{ background: 'var(--paper)' }}>
        <span className="font-mono text-[11px]" style={{ color: 'var(--ink-soft)', letterSpacing: '0.04em' }}>
          CMD + ↵ to capture
        </span>
        <button
          onClick={handleCapture}
          disabled={loading}
          className="font-bold text-[14px] uppercase tracking-[0.04em] px-5 py-2.5 border-2 border-[var(--line)] transition-all duration-100 disabled:opacity-30"
          style={{ background: 'var(--learn)', color: 'var(--ink)', boxShadow: 'var(--shadow-sm)' }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-1px,-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = '' }}
          onMouseDown={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translate(3px,3px)' }}
          onMouseUp={e => { e.currentTarget.style.boxShadow = 'var(--shadow)'; e.currentTarget.style.transform = 'translate(-1px,-1px)' }}
        >
          {loading ? '…' : 'Capture ↵'}
        </button>
      </div>
    </section>
  )
}
