import { useState, useRef, useCallback, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PRESETS = [
  { id: 'cinematic-green', label: '🌿 Cinematic Green', desc: 'Shadow hijau tua gelap, highlight natural — moody & dramatis' },
  { id: 'edwak-445',       label: '🏙️ Edwak #445',      desc: 'Teal shadow + copper midtone — street photography sinematik' },
  { id: 'film-grain-vintage', label: '📽️ Film Grain Vintage', desc: 'Tekstur grain kuat, faded warm — gaya foto analog 70an' },
  { id: 'muted-street',    label: '🌫️ Muted Street',    desc: 'Desaturated abu-abu hangat — gaya dokumenter, editorial' },
  { id: 'night-neon',         label: '🌃 Night Neon',         desc: 'Shadow biru gelap, highlight cyan & magenta — vibe kota malam' },
  { id: 'golden-hour',     label: '🌅 Golden Hour',        desc: 'Warm orange highlight, shadow keemasan — magic hour feel' },
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

const isMobile = () => window.innerWidth <= 768

// Resize gambar untuk preview
const resizeForPreview = (file, maxSize = 500) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    }
    img.src = URL.createObjectURL(file)
  })
}

// Rotate file gambar (canvas) — returns new File
const rotateImage = (file, rotation) => {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const rad = (rotation * Math.PI) / 180
      const sin = Math.abs(Math.sin(rad))
      const cos = Math.abs(Math.cos(rad))
      const w = Math.round(img.width * cos + img.height * sin)
      const h = Math.round(img.width * sin + img.height * cos)
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.translate(w / 2, h / 2)
      ctx.rotate(rad)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: 'image/jpeg' })), 'image/jpeg', 0.97)
    }
    img.src = URL.createObjectURL(file)
  })
}

export default function App() {
  const [originalFile, setOriginalFile]       = useState(null)
  const [originalUrl, setOriginalUrl]         = useState(null)
  const [rotatedFile, setRotatedFile]         = useState(null)  // file setelah rotate
  const [rotatedUrl, setRotatedUrl]           = useState(null)
  const [rotation, setRotation]               = useState(0)     // 0, 90, 180, 270
  const [previewUrl, setPreviewUrl]           = useState(null)
  const [resultBlob, setResultBlob]           = useState(null)
  const [preset, setPreset]                   = useState(null)
  const [fine, setFine]                       = useState(DEFAULT_FINE)
  const [previewLoading, setPreviewLoading]   = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [rotating, setRotating]               = useState(false)
  const [imgSize, setImgSize]                 = useState(null)
  const [dragging, setDragging]               = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(!isMobile())
  const [sliderPos, setSliderPos]             = useState(50)
  const fileInputRef   = useRef()
  const containerRef   = useRef()
  const draggingSlider = useRef(false)
  const debounceRef    = useRef()

  const handleFile = (file) => {
    if (!file) return
    setOriginalFile(file)
    setOriginalUrl(URL.createObjectURL(file))
    setRotatedFile(file)
    setRotatedUrl(URL.createObjectURL(file))
    setRotation(0)
    setPreviewUrl(null)
    setResultBlob(null)
    setPreset(null)
    setFine(DEFAULT_FINE)
    if (isMobile()) setSidebarOpen(true)
  }

  // Handle rotate — putar 90 derajat searah jarum jam
  const handleRotate = async () => {
    if (!originalFile || rotating) return
    setRotating(true)
    const newRotation = (rotation + 90) % 360
    setRotation(newRotation)
    try {
      const newFile = await rotateImage(originalFile, newRotation)
      setRotatedFile(newFile)
      setRotatedUrl(prev => { if (prev && prev !== originalUrl) URL.revokeObjectURL(prev); return URL.createObjectURL(newFile) })
      setPreviewUrl(null)
      setResultBlob(null)
      // Re-trigger preview kalau preset sudah dipilih
      if (preset) {
        clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => applyPreview(newFile, preset, fine), 300)
      }
    } finally {
      setRotating(false)
    }
  }

  const applyPreview = useCallback(async (file, presetId, fineParams) => {
    if (!file || !presetId) return
    setPreviewLoading(true)
    setResultBlob(null)
    try {
      const smallBlob = await resizeForPreview(file, 500)
      const fd = new FormData()
      fd.append('file', smallBlob, 'preview.jpg')
      fd.append('preset_id', presetId)
      Object.entries(fineParams).forEach(([k, v]) => fd.append(k, v))
      const res = await fetch(`${API_URL}/grade`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Server error')
      const blob = await res.blob()
      setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob) })
    } catch (err) {
      console.error(err)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!rotatedFile || !preset) return
    setPreviewUrl(null)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => applyPreview(rotatedFile, preset, fine), 300)
    return () => clearTimeout(debounceRef.current)
  }, [rotatedFile, preset, fine, applyPreview])

  const handleDownload = useCallback(async () => {
    if (!rotatedFile || !preset) return
    setDownloadLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', rotatedFile)
      fd.append('preset_id', preset)
      Object.entries(fine).forEach(([k, v]) => fd.append(k, v))
      const res = await fetch(`${API_URL}/grade`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Server error')
      const w = res.headers.get('X-Image-Width')
      const h = res.headers.get('X-Image-Height')
      if (w && h) setImgSize({ w, h })
      const blob = await res.blob()
      setResultBlob(blob)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `retrolens_${preset}.jpg`
      a.click()
    } catch (err) {
      console.error(err)
      alert('Gagal memproses. Coba lagi!')
    } finally {
      setDownloadLoading(false)
    }
  }, [rotatedFile, preset, fine])

  const getSliderPos = (clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    setSliderPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }
  const onMouseDown  = (e) => { draggingSlider.current = true; getSliderPos(e.clientX) }
  const onMouseMove  = (e) => { if (draggingSlider.current) getSliderPos(e.clientX) }
  const onMouseUp    = ()  => { draggingSlider.current = false }
  const onTouchStart = (e) => { draggingSlider.current = true; getSliderPos(e.touches[0].clientX) }
  const onTouchMove  = (e) => { if (draggingSlider.current) { e.preventDefault(); getSliderPos(e.touches[0].clientX) } }
  const onTouchEnd   = ()  => { draggingSlider.current = false }

  useEffect(() => {
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    return () => {
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handleFile(file)
  }

  const activePreset = PRESETS.find(p => p.id === preset)
  const displayUrl   = rotatedUrl || originalUrl

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {sidebarOpen && isMobile() && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10,
        }} />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: 260,
        position: isMobile() ? 'fixed' : 'relative',
        left: sidebarOpen ? 0 : -260,
        top: 0, bottom: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg2)', borderRight: '0.5px solid var(--border)',
        transition: 'left 0.3s ease', flexShrink: 0,
      }}>
        <div style={{ padding: '24px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'Special Elite, cursive', fontSize: 22, color: 'var(--gold)', marginBottom: 2 }}>RetroLens</div>
            <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>Cinematic Grading</div>
          </div>

          <FilmStrip />
          <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />

          {originalFile && !preset && (
            <div style={{
              background: 'rgba(201,169,122,0.08)', border: '0.5px solid rgba(201,169,122,0.3)',
              borderRadius: 6, padding: '10px 12px', marginBottom: 12,
              fontSize: 12, color: 'var(--gold)', lineHeight: 1.5,
            }}>
              👆 Pilih preset di bawah untuk mulai
            </div>
          )}

          <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 10 }}>Preset</div>
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => { setPreset(p.id); if (isMobile()) setSidebarOpen(false) }} style={{
              width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: 6, borderRadius: 6, cursor: 'pointer',
              border: preset === p.id ? '0.5px solid rgba(201,169,122,0.5)' : '0.5px solid var(--border)',
              background: preset === p.id ? 'rgba(201,169,122,0.1)' : 'transparent',
              color: preset === p.id ? 'var(--gold)' : 'var(--text-dim)',
              transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
            }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</div>
              <div style={{ fontSize: 11, color: 'var(--gold-dark)', marginTop: 2, lineHeight: 1.4 }}>{p.desc}</div>
            </button>
          ))}

          {preset && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 14 }}>Fine Tuning</div>
              {SLIDERS.map(s => (
                <div key={s.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--gold)' }}>{s.label}</span>
                    <span style={{ fontSize: 11, color: fine[s.key] !== 0 ? 'var(--gold)' : 'var(--gold-dark)' }}>
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
                }}>Reset Fine Tuning</button>
              )}
            </>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0 12px' }} />
          <div style={{ fontSize: 11, color: 'var(--gold-dark)' }}>RetroLens v4 · React + FastAPI</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 12px', height: 52,
          borderBottom: '0.5px solid var(--border)',
          background: 'var(--bg2)', flexShrink: 0,
        }}>
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--gold-dim)', padding: 4, fontSize: 18, lineHeight: 1,
          }}>☰</button>

          <span style={{ fontFamily: 'Special Elite, cursive', color: 'var(--gold)', fontSize: 16, whiteSpace: 'nowrap' }}>RetroLens</span>

          <div style={{ flex: 1 }} />

          {/* Rotate button — muncul kalau ada foto */}
          {originalUrl && (
            <button
              onClick={handleRotate}
              disabled={rotating}
              title="Rotate 90°"
              style={{
                background: 'transparent', border: '0.5px solid var(--border)',
                color: rotating ? 'var(--gold-dark)' : 'var(--gold-dim)',
                padding: '6px 10px', borderRadius: 4, cursor: rotating ? 'not-allowed' : 'pointer',
                fontSize: 15, lineHeight: 1, transition: 'all 0.15s',
                transform: rotating ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              ↻
            </button>
          )}

          {previewLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold-dim)', fontSize: 12 }}>
              <div style={{
                width: 12, height: 12, border: '1.5px solid var(--gold-dim)',
                borderTopColor: 'var(--gold)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Preview...
            </div>
          )}

          {previewUrl && !previewLoading && !downloadLoading && (
            <button onClick={handleDownload} style={{
              background: 'var(--gold)', color: 'var(--bg)', border: 'none',
              padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
              fontSize: 12, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            }}>⬇ Download</button>
          )}

          {downloadLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gold)', fontSize: 12 }}>
              <div style={{
                width: 12, height: 12, border: '1.5px solid rgba(201,169,122,0.3)',
                borderTopColor: 'var(--gold)', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Rendering...
            </div>
          )}

          <button onClick={() => fileInputRef.current?.click()} style={{
            background: 'transparent', color: 'var(--gold)',
            border: '0.5px solid rgba(201,169,122,0.4)',
            padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
            fontSize: 12, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
          }}>Upload</button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          {!originalUrl ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `0.5px dashed ${dragging ? 'var(--gold)' : 'rgba(201,169,122,0.25)'}`,
                borderRadius: 10, height: '70vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: dragging ? 'rgba(201,169,122,0.04)' : 'transparent',
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎞️</div>
              <div style={{ color: 'var(--gold)', fontFamily: 'Special Elite, cursive', fontSize: 18, marginBottom: 8, textAlign: 'center' }}>
                Drop foto kamu di sini
              </div>
              <div style={{ color: 'var(--gold-dark)', fontSize: 12 }}>
                atau klik untuk pilih file · JPG · PNG · WEBP
              </div>
            </div>

          ) : !preset ? (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
              <div style={{
                position: 'relative', width: '100%', maxWidth: 900,
                margin: '0 auto 16px', borderRadius: 6, overflow: 'hidden',
                height: '70vh', background: 'var(--bg3)',
              }}>
                <img src={displayUrl} alt="original" style={{
                  width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0.6)',
                }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                }}>
                  <div style={{ fontSize: 32 }}>🎞️</div>
                  <div style={{ color: 'var(--gold)', fontFamily: 'Special Elite, cursive', fontSize: 18 }}>
                    Pilih preset color grading
                  </div>
                  <button onClick={() => setSidebarOpen(true)} style={{
                    background: 'var(--gold)', color: 'var(--bg)', border: 'none',
                    padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif',
                  }}>Buka Preset →</button>
                </div>
              </div>
            </div>

          ) : (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
              <div
                ref={containerRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  position: 'relative', width: '100%', maxWidth: 900,
                  margin: '0 auto 16px', borderRadius: 6, overflow: 'hidden',
                  height: '70vh', cursor: 'ew-resize', userSelect: 'none',
                  touchAction: 'none', background: 'var(--bg3)',
                }}
              >
                <img src={displayUrl} alt="original" style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  objectFit: 'contain', pointerEvents: 'none',
                }} />

                {previewUrl && (
                  <img src={previewUrl} alt="graded" style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    objectFit: 'contain',
                    clipPath: `inset(0 0 0 ${sliderPos}%)`,
                    pointerEvents: 'none',
                  }} />
                )}

                {previewLoading && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    clipPath: `inset(0 0 0 ${sliderPos}%)`,
                    background: 'rgba(15,12,7,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 28, height: 28, border: '2px solid rgba(201,169,122,0.3)',
                      borderTopColor: 'var(--gold)', borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }} />
                  </div>
                )}

                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${sliderPos}%`, width: 2,
                  background: 'var(--gold)', transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, color: 'var(--bg)', fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  }}>⇔</div>
                </div>

                <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 11, letterSpacing: '0.1em', color: 'rgba(232,213,183,0.7)', textTransform: 'uppercase', pointerEvents: 'none' }}>Original</div>
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, letterSpacing: '0.1em', color: 'var(--gold)', textTransform: 'uppercase', pointerEvents: 'none' }}>{activePreset?.label}</div>
              </div>

              <div style={{
                padding: '10px 14px', background: 'var(--bg2)',
                border: '0.5px solid var(--border)', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                maxWidth: 900, margin: '0 auto', flexWrap: 'wrap', gap: 4,
              }}>
                <span style={{ fontSize: 12, color: 'var(--gold-dark)' }}>
                  {resultBlob
                    ? `📐 ${imgSize?.w}×${imgSize?.h}px · JPEG Q97 · Resolusi penuh`
                    : '✦ Preview — Download untuk hasil full quality'
                  }
                </span>
                <span style={{ fontSize: 12, color: 'var(--gold)' }}>{activePreset?.label}</span>
              </div>
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
