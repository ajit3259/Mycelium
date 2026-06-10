import { useState, useRef, useCallback, useEffect } from 'react'
import { captureText, captureLink, captureImage } from '../api'

type Tab = 'note' | 'link' | 'image'
const TABS: { id: Tab; label: string }[] = [
  { id: 'note',  label: 'NOTE' },
  { id: 'link',  label: 'LINK' },
  { id: 'image', label: 'IMAGE' },
]

interface Props {
  onCapture: (id: number) => void
}

export function CaptureBar({ onCapture }: Props) {
  const [tab, setTab] = useState<Tab>('note')
  const [note, setNote] = useState('')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [yourTake, setYourTake] = useState('')
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
        res = await captureText(note.trim(), yourTake); setNote(''); setYourTake('')
      } else if (tab === 'link' && link.trim()) {
        res = await captureLink(link.trim(), yourTake); setLink(''); setYourTake('')
      } else if (tab === 'image' && file) {
        res = await captureImage(file, caption, yourTake); setFile(null); setCaption(''); setYourTake(''); if (fileInputRef.current) fileInputRef.current.value = ''
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
                    onClick={() => { setFile(null); setCaption(''); if (fileInputRef.current) fileInputRef.current.value = '' }}
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
                placeholder="Why are you saving this?"
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

      {/* Your take — only for note and link, not image (caption serves that role) */}
      {tab !== 'image' && (
        <div style={{ borderTop: '2px solid var(--line)', background: 'var(--paper)', padding: '10px 16px' }}>
          <textarea
            value={yourTake}
            onChange={e => setYourTake(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Why are you saving this?"
            rows={2}
            className="w-full resize-none border-none outline-none text-[13px] leading-relaxed font-mono"
            style={{ background: 'transparent', color: 'var(--ink)', opacity: yourTake ? 1 : 0.6 }}
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
