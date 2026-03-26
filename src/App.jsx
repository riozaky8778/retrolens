import { useState, useRef, useCallback, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PRESETS = [
  { id: 'cinematic-green', label: '🌿 Cinematic Green', desc: 'Shadow hijau tua gelap, highlight natural — moody & dramatis' },
  { id: 'edwak-445',       label: '🏙️ Edwak #445',      desc: 'Teal shadow + copper midtone — street photography sinematik' },
  { id: 'flomo-green',     label: '🎞️ FLOMO Green',     desc: 'Green cast kuat seluruh foto — efek film expired' },
  { id: 'muted-street',    label: '🌫️ Muted Street',    desc: 'Desaturated abu-abu hangat — gaya dokumenter, editorial' },
  { id: 'edwak-440',       label: '🎬 Edwak #440',      desc: 'Teal shadow + orange highlight — dark moody sinematik' },
]

const DEFAULT_FINE = { exposure: 0, contrast: 0, saturation: 0, fade: 0, warm: 0, grain: 0, vignette: 0 }
const SLIDERS = [
  { key: 'exposure',   label: 'Exposure',   min: -100, max: 100 },
  { key: 'contrast',   label: 'Contrast',   min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'fade',       label: 'Fade',       min: 0,    max: 100 },
  { key: 'warm',       label: 'Warm',       min: -100, max: 100 },
  { key: 'grain',      label: 'Grain',      min: 0,    max: 100 },
  { key: 'vignette',   label: 'Vignette',   min: 0,    max: 100 },
]

export default function App() {
  const [originalFile, setOriginalFile] = useState(null)
  const [originalUrl, setOriginalUrl]   = useState(null)
  const [resultUrl, setResultUrl]       = useState(null)
  const [resultBlob, setResultBlob]     = useState(null)
  const [preset, setPreset]             = useState('cinematic-green')
  const [fine, setFine]                 = useState(DEFAULT_FINE)
  const [loading, setLoading]           = useState(false)
  const [imgSize, setImgSize]           = useState(null)
  const [dragging, setDragging]         = useState(false)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [sliderPos, setSliderPos]       = useState(50)
  const fileInputRef = useRef()
  const debounceRef  = useRef()

  const handleFile = (file) => {
    if (!file) return
    setOriginalFile(file)
    setOriginalUrl(URL.createObjectURL(file))
    setResultUrl(null)
    setResultBlob(null)
  }

  const applyGrade = useCallback(async (file, presetId, fineParams) => {
    if (!file) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('preset_id', presetId)
      Object.entries(fineParams).forEach(([k, v]) => fd.append(k, v))

      const res = await fetch(`${API_URL}/grade`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Server error')

      const w = res.headers.get('X-Image-Width')
      const h = res.headers.get('X-Image-Height')
      if (w && h) setImgSize({ w, h })

      const blob = await res.blob()
      setResultBlob(blob)
      setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!originalFile) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyGrade(originalFile, preset, fine), 400)
    return () => clearTimeout(debounceRef.current)
  }, [originalFile, preset, fine, applyGrade])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  const handleDownload = () => {
    if (!resultBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(resultBlob)
    a.download = `retrolens_${preset}.jpg`
    a.click()
  }

  const activePreset = PRESETS.find(p => p.id === preset)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: sidebarOpen ? 260 : 0,
        minWidth: sidebarOpen ? 260 : 0,
        display: sidebarOpen ? 'flex' : 'none',
        flexDirection: 'column',
        background: 'var(--bg2)',
        borderRight: '0.5px solid var(--border)',
        overflow: 'hidden',
        transition: 'width 0.3s ease',
      }}>
        <div style={{ padding: '24px 20px', overflowY: 'auto', flex: 1 }}>

          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Special Elite, cursive', fontSize: 22, color: 'var(--gold)', marginBottom: 2 }}>
              RetroLens
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>
              Cinematic Grading
            </div>
          </div>

          <FilmStrip />
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 10 }}>
            Preset
          </div>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px',
              marginBottom: 6, borderRadius: 6, cursor: 'pointer',
              border: preset === p.id ? '0.5px solid rgba(201,169,122,0.5)' : '0.5px solid var(--border)',
              background: preset === p.id ? 'rgba(201,169,122,0.1)' : 'transparent',
              color: preset === p.id ? 'var(--gold)' : 'var(--text-dim)',
              transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--gold-dark)', marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
            </button>
          ))}

          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 14 }}>
            Fine Tuning
          </div>
          {SLIDERS.map(s => (
            <div key={s.key} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '0.04em' }}>{s.label}</span>
                <span style={{ fontSize: 11, color: fine[s.key] !== 0 ? 'var(--gold)' : 'var(--gold-dark)', fontVariantNumeric: 'tabular-nums' }}>
                  {fine[s.key] > 0 ? '+' : ''}{fine[s.key]}
                </span>
              </div>
              <input type="range" min={s.min} max={s.max} value={fine[s.key]}
                onChange={e => setFine(f => ({ ...f, [s.key]: Number(e.target.value) }))} />
            </div>
          ))}

          {Object.values(fine).some(v => v !== 0) && (
            <button onClick={() => setFine(DEFAULT_FINE)} style={{
              width: '100%', padding: '7px', marginTop: 4,
              background: 'transparent', border: '0.5px solid var(--border)',
              color: 'var(--gold-dim)', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, fontFamily: 'DM Sans, sans-serif',
            }}>
              Reset Fine Tuning
            </button>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0 12px' }} />
          <div style={{ fontSize: 11, color: 'var(--gold-dark)' }}>RetroLens v4 · React + FastAPI</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>

        {/* Topbar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 24px', height: 52,
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg2)', flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--gold-dim)', padding: 4, fontSize: 16,
          }}>
            ☰
          </button>

          <span style={{ fontFamily: 'Special Elite, cursive', color: 'var(--gold)', fontSize: 16 }}>RetroLens</span>

          {originalFile && (
            <span style={{ fontSize: 12, color: 'var(--gold-dark)' }}>· {originalFile.name}</span>
          )}

          <div style={{ flex: 1 }} />

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gold-dim)', fontSize: 12 }}>
              <div style={{
                width: 12, height: 12, border: '1.5px solid var(--gold-dim)',
                borderTopColor: 'var(--gold)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Applying grade...
            </div>
          )}

          {resultUrl && !loading && (
            <button onClick={handleDownload} style={{
              background: 'transparent', border: '0.5px solid rgba(201,169,122,0.4)',
              color: 'var(--gold)', padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ⬇ Download
              {imgSize && <span style={{ color: 'var(--gold-dark)', fontSize: 11 }}>· {imgSize.w}×{imgSize.h}px</span>}
            </button>
          )}

          <button onClick={() => fileInputRef.current?.click()} style={{
            background: 'var(--gold)', color: 'var(--bg)', border: 'none',
            padding: '6px 16px', borderRadius: 4, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
          }}>
            Upload Foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          {!originalUrl ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `0.5px dashed ${dragging ? 'var(--gold)' : 'rgba(201,169,122,0.25)'}`,
                borderRadius: 10, height: '60vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: dragging ? 'rgba(201,169,122,0.04)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎞️</div>
              <div style={{ color: 'var(--gold)', fontFamily: 'Special Elite, cursive', fontSize: 18, marginBottom: 8 }}>
                Drop foto kamu di sini
              </div>
              <div style={{ color: 'var(--gold-dark)', fontSize: 12 }}>
                atau klik untuk pilih file · JPG · PNG · WEBP
              </div>
            </div>
          ) : (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>

              {/* Slider comparison */}
              <div style={{
                position: 'relative', width: '100%', maxWidth: 900,
                margin: '0 auto 16px', borderRadius: 6, overflow: 'hidden',
                aspectRatio: 'unset',
                maxHeight: '75vh',
              }}>
                <img src={originalUrl} alt="original" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                }} />
                <img src={resultUrl || originalUrl} alt="graded" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  clipPath: `inset(0 0 0 ${sliderPos}%)`,
                }} />
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${sliderPos}%`, width: 2,
                  background: 'var(--gold)', transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 11, letterSpacing: '0.1em', color: 'rgba(232,213,183,0.7)', textTransform: 'uppercase' }}>Original</div>
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase' }}>{activePreset?.label}</div>
                <input type="range" min="0" max="100" value={sliderPos}
                  onChange={e => setSliderPos(e.target.value)}
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'ew-resize', width: '100%', height: '100%' }}
                />
                {loading && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(15,12,7,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{
                      width: 32, height: 32, border: '2px solid rgba(201,169,122,0.3)',
                      borderTopColor: 'var(--gold)', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                    <div style={{ color: 'var(--gold)', fontSize: 12, letterSpacing: '0.1em' }}>Processing...</div>
                  </div>
                )}
              </div>

              {/* Info bar */}
              {resultUrl && !loading && (
                <div style={{
                  padding: '10px 14px', background: 'var(--bg2)',
                  border: '0.5px solid var(--border)', borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  maxWidth: 900, margin: '0 auto',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--gold-dark)' }}>
                    {imgSize && `📐 ${imgSize.w} × ${imgSize.h}px · `}JPEG Q97 · Resolusi penuh
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--gold)' }}>{activePreset?.label}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function FilmStrip() {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: 2,
          border: '0.5px solid rgba(201,169,122,0.2)',
        }} />
      ))}
    </div>
  )
}
