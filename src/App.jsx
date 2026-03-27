import { useState, useRef, useCallback, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const PRESETS = [
  { id: 'cinematic-green',    label: 'Cinematic Green',    emoji: '🌿', desc: 'Shadow hijau tua gelap, highlight natural — moody & dramatis' },
  { id: 'edwak-445',          label: 'Edwak #445',         emoji: '🏙', desc: 'Teal shadow + copper midtone — street photography sinematik' },
  { id: 'film-grain-vintage', label: 'Film Grain Vintage', emoji: '📽', desc: 'Tekstur grain kuat, faded warm — gaya foto analog 70an' },
  { id: 'muted-street',       label: 'Muted Street',       emoji: '🌫', desc: 'Desaturated abu-abu hangat — gaya dokumenter, editorial' },
  { id: 'night-neon',         label: 'Night Neon',         emoji: '🌃', desc: 'Shadow biru gelap, highlight cyan & magenta — vibe kota malam' },
  { id: 'golden-hour',        label: 'Golden Hour',        emoji: '🌅', desc: 'Warm orange highlight, shadow keemasan — magic hour feel' },
  { id: 'warm-film-portrait', label: 'Warm Film Portrait', emoji: '🎞', desc: 'Golden warm, skin glowing — gaya foto wisuda & portrait sore hari' },
  { id: 'dreamy-soft-pink',   label: 'Dreamy Soft Pink',   emoji: '🌸', desc: 'Soft warm pink, highlight dreamy — feminine & elegant portrait' },
  { id: 'airy-vintage',       label: 'Airy Vintage',       emoji: '☁', desc: 'Overexposed warm cream, highlight blown — ringan & airy' },
]

const PRESET_COLORS = {
  'cinematic-green':    '#3a7d44',
  'edwak-445':          '#3a7070',
  'film-grain-vintage': '#8b6914',
  'muted-street':       '#7a7060',
  'night-neon':         '#2a3a8a',
  'golden-hour':        '#c47c14',
  'warm-film-portrait': '#b06020',
  'dreamy-soft-pink':   '#c06080',
  'airy-vintage':       '#a09070',
}

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
      canvas.width = w; canvas.height = h
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
  const [rotatedFile, setRotatedFile]         = useState(null)
  const [rotatedUrl, setRotatedUrl]           = useState(null)
  const [rotation, setRotation]               = useState(0)
  const [previewUrl, setPreviewUrl]           = useState(null)
  const [resultBlob, setResultBlob]           = useState(null)
  const [preset, setPreset]                   = useState(null)
  const [fine, setFine]                       = useState(DEFAULT_FINE)
  const [previewLoading, setPreviewLoading]   = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [sharing, setSharing]                 = useState(false)
  const [rotating, setRotating]               = useState(false)
  const [imgSize, setImgSize]                 = useState(null)
  const [dragging, setDragging]               = useState(false)
  const [sidebarOpen, setSidebarOpen]         = useState(!isMobile())
  const [sliderPos, setSliderPos]             = useState(50)
  const [toast, setToast]                     = useState(null)
  const fileInputRef   = useRef()
  const containerRef   = useRef()
  const draggingSlider = useRef(false)
  const debounceRef    = useRef()
  const toastRef       = useRef()

  // ✅ DIPINDAH KE ATAS — harus sebelum handleShare
  const activePreset   = PRESETS.find(p => p.id === preset)
  const displayUrl     = rotatedUrl || originalUrl
  const hasFineChanges = Object.values(fine).some(v => v !== 0)
  const canShare       = typeof navigator !== 'undefined' && !!navigator.share

  const fabStyle = {
    width: 34, height: 34, borderRadius: 6,
    background: 'rgba(0,0,0,0.55)',
    WebkitBackdropFilter: 'blur(6px)',
    backdropFilter: 'blur(6px)',
    border: '0.5px solid rgba(255,255,255,0.15)',
    color: 'white', fontSize: 16, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.15s',
  }

  const showToast = (msg, type = 'info') => {
    setToast({ msg, type })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3000)
  }

  const handleFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar (JPG/PNG/WEBP)', 'error'); return }
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
      showToast('Gagal load preview. Cek koneksi server.', 'error')
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
      showToast('Download berhasil!', 'success')
    } catch (err) {
      console.error(err)
      showToast('Gagal download. Coba lagi!', 'error')
    } finally {
      setDownloadLoading(false)
    }
  }, [rotatedFile, preset, fine])

  // ✅ activePreset sudah tersedia di atas, aman dipakai di sini
  const handleShare = useCallback(async () => {
    if (!rotatedFile || !preset || sharing) return
    setSharing(true)
    showToast('Menyiapkan foto...', 'info')
    try {
      const fd = new FormData()
      fd.append('file', rotatedFile)
      fd.append('preset_id', preset)
      Object.entries(fine).forEach(([k, v]) => fd.append(k, v))
      const res = await fetch(`${API_URL}/grade`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Server error')
      const blob = await res.blob()
      const file = new File([blob], `retrolens_${preset}.jpg`, { type: 'image/jpeg' })
      await navigator.share({
        title: 'RetroLens',
        text: `Foto ini diedit pakai RetroLens — ${activePreset?.label} | retrolens-six.vercel.app`,
        files: [file],
      })
    } catch (err) {
      if (err.name !== 'AbortError') showToast('Share gagal. Coba download dulu.', 'error')
    } finally {
      setSharing(false)
    }
  }, [rotatedFile, preset, fine, activePreset])

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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 100, padding: '10px 20px', borderRadius: 6,
          background: toast.type === 'error' ? '#5a1a1a' : toast.type === 'success' ? '#1a3a1a' : '#2a2010',
          border: `0.5px solid ${toast.type === 'error' ? '#a03030' : toast.type === 'success' ? '#30803a' : 'rgba(201,169,122,0.4)'}`,
          color: toast.type === 'error' ? '#f08080' : toast.type === 'success' ? '#80d080' : 'var(--gold)',
          fontSize: 13, fontFamily: 'DM Sans, sans-serif',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s ease', whiteSpace: 'nowrap',
        }}>{toast.msg}</div>
      )}

      {sidebarOpen && isMobile() && (
        <div onClick={() => setSidebarOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10,
        }} />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: 264,
        position: isMobile() ? 'fixed' : 'relative',
        left: sidebarOpen ? 0 : -264,
        top: 0, bottom: 0, zIndex: 20,
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg2)', borderRight: '0.5px solid var(--border)',
        transition: 'left 0.3s ease', flexShrink: 0,
      }}>
        <div style={{ padding: '20px 20px 14px', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Special Elite, cursive', fontSize: 22, color: 'var(--gold)', marginBottom: 2 }}>RetroLens</div>
          <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--gold-dark)' }}>Cinematic Grading</div>
          <FilmStrip />
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 20px' }}>

          {originalFile && !preset && (
            <div style={{
              background: 'rgba(201,169,122,0.07)', border: '0.5px solid rgba(201,169,122,0.28)',
              borderRadius: 6, padding: '9px 12px', marginBottom: 12,
              fontSize: 12, color: 'var(--gold)', lineHeight: 1.6,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>👇</span>
              <span>Pilih preset untuk mulai grading</span>
            </div>
          )}

          <div style={{
            fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
            color: 'var(--gold-dim)', marginBottom: 10,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>Preset</span>
            <span style={{ color: 'var(--gold-dark)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>{PRESETS.length} styles</span>
          </div>

          {PRESETS.map(p => (
            <button key={p.id} onClick={() => { setPreset(p.id); if (isMobile()) setSidebarOpen(false) }} style={{
              width: '100%', textAlign: 'left', padding: '9px 12px', marginBottom: 5,
              borderRadius: 6, cursor: 'pointer',
              border: preset === p.id ? '0.5px solid rgba(201,169,122,0.5)' : '0.5px solid var(--border)',
              background: preset === p.id ? 'rgba(201,169,122,0.09)' : 'transparent',
              color: preset === p.id ? 'var(--gold)' : 'var(--text-dim)',
              transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                background: preset === p.id ? PRESET_COLORS[p.id] : 'rgba(201,169,122,0.18)',
                transition: 'background 0.2s',
                boxShadow: preset === p.id ? `0 0 5px ${PRESET_COLORS[p.id]}99` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{p.label}</div>
                <div style={{ fontSize: 11, color: 'var(--gold-dark)', marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
              </div>
              {preset === p.id && (
                <div style={{ color: 'var(--gold)', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</div>
              )}
            </button>
          ))}

          {preset && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--gold-dim)' }}>Fine Tuning</div>
                {hasFineChanges && (
                  <button onClick={() => setFine(DEFAULT_FINE)} style={{
                    fontSize: 11, color: 'var(--gold-dark)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif', textDecoration: 'underline',
                  }}>Reset</button>
                )}
              </div>
              {SLIDERS.map(s => (
                <div key={s.key} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: fine[s.key] !== 0 ? 'var(--gold)' : 'var(--gold-dim)' }}>{s.label}</span>
                    <span style={{
                      fontSize: 11, minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
                      color: fine[s.key] !== 0 ? 'var(--gold)' : 'var(--gold-dark)',
                    }}>
                      {fine[s.key] > 0 ? '+' : ''}{fine[s.key]}
                    </span>
                  </div>
                  <input type="range" min={s.min} max={s.max} value={fine[s.key]}
                    onChange={e => setFine(f => ({ ...f, [s.key]: Number(e.target.value) }))} />
                </div>
              ))}
            </>
          )}

          <div style={{ height: 1, background: 'var(--border)', margin: '20px 0 12px' }} />
          <div style={{ fontSize: 11, color: 'var(--gold-dark)' }}>RetroLens v4 · React + FastAPI</div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)', minWidth: 0 }}>

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

          {activePreset && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '3px 10px', borderRadius: 20,
              background: 'rgba(201,169,122,0.09)',
              border: '0.5px solid rgba(201,169,122,0.22)',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRESET_COLORS[activePreset.id] }} />
              <span style={{ fontSize: 11, color: 'var(--gold)', whiteSpace: 'nowrap' }}>{activePreset.label}</span>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button onClick={() => fileInputRef.current?.click()} style={{
            background: originalUrl ? 'transparent' : 'var(--gold)',
            color: originalUrl ? 'var(--gold)' : 'var(--bg)',
            border: '0.5px solid rgba(201,169,122,0.4)',
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
            fontSize: 12, fontFamily: 'DM Sans, sans-serif', whiteSpace: 'nowrap',
            fontWeight: originalUrl ? 400 : 500,
          }}>
            {originalUrl ? '↑ Ganti Foto' : 'Upload Foto'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files[0])} />
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>

          {!originalUrl ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `0.5px dashed ${dragging ? 'var(--gold)' : 'rgba(201,169,122,0.2)'}`,
                borderRadius: 10, height: '78vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.2s',
                background: dragging ? 'rgba(201,169,122,0.04)' : 'transparent',
              }}
            >
              <div style={{ marginBottom: 20, opacity: dragging ? 1 : 0.65, transition: 'opacity 0.2s' }}>
                <FilmFrame />
              </div>
              <div style={{ color: 'var(--gold)', fontFamily: 'Special Elite, cursive', fontSize: 20, marginBottom: 8, textAlign: 'center' }}>
                {dragging ? 'Lepas untuk upload' : 'Drop foto kamu di sini'}
              </div>
              <div style={{ color: 'var(--gold-dark)', fontSize: 12, marginBottom: 20 }}>
                atau klik untuk pilih file · JPG · PNG · WEBP
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280 }}>
                {['Portrait', 'Street', 'Wisuda', 'Landscape', 'Travel'].map(tag => (
                  <span key={tag} style={{
                    fontSize: 11, padding: '3px 10px', borderRadius: 20,
                    border: '0.5px solid rgba(201,169,122,0.18)',
                    color: 'var(--gold-dark)',
                  }}>{tag}</span>
                ))}
              </div>
            </div>

          ) : !preset ? (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{
                position: 'relative', width: '100%', maxWidth: 900,
                margin: '0 auto 16px', borderRadius: 6, overflow: 'hidden',
                height: '70vh', background: 'var(--bg3)',
              }}>
                <img src={displayUrl} alt="original" style={{
                  width: '100%', height: '100%', objectFit: 'contain',
                  filter: 'brightness(0.5) saturate(0.4)',
                }} />
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, zIndex: 5 }}>
                  <button onClick={handleRotate} disabled={rotating} style={fabStyle} title="Rotate 90°">
                    {rotating ? <Spinner size={14} /> : '↻'}
                  </button>
                </div>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  pointerEvents: 'none',
                }}>
                  <div style={{ color: 'var(--gold)', fontFamily: 'Special Elite, cursive', fontSize: 20 }}>
                    Pilih preset color grading
                  </div>
                  <div style={{ color: 'var(--gold-dark)', fontSize: 12 }}>{PRESETS.length} preset tersedia di sidebar</div>
                  <button onClick={() => setSidebarOpen(true)} style={{
                    background: 'var(--gold)', color: 'var(--bg)', border: 'none',
                    padding: '9px 22px', borderRadius: 4, cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: 'DM Sans, sans-serif', marginTop: 4,
                    pointerEvents: 'auto',
                  }}>Buka Preset →</button>
                </div>
              </div>
            </div>

          ) : (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div
                ref={containerRef}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                style={{
                  position: 'relative', width: '100%', maxWidth: 900,
                  margin: '0 auto 12px', borderRadius: 6, overflow: 'hidden',
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
                    background: 'rgba(15,12,7,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none',
                  }}>
                    <Spinner size={28} color="var(--gold)" />
                  </div>
                )}

                {/* Divider */}
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${sliderPos}%`, width: 2,
                  background: 'var(--gold)', transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--gold)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, color: 'var(--bg)', fontWeight: 'bold',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
                  }}>⇔</div>
                </div>

                {/* Corner label kiri */}
                <div style={{
                  position: 'absolute', top: 10, left: 10, fontSize: 10,
                  letterSpacing: '0.1em', color: 'rgba(232,213,183,0.6)',
                  textTransform: 'uppercase', pointerEvents: 'none',
                  background: 'rgba(0,0,0,0.35)', padding: '3px 8px', borderRadius: 4,
                }}>Original</div>

                {/* Floating buttons kanan atas */}
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  display: 'flex', gap: 6, zIndex: 5,
                  pointerEvents: 'auto',
                }}>
                  {/* Preset label */}
                  <div style={{
                    fontSize: 10, letterSpacing: '0.1em', color: 'var(--gold)',
                    textTransform: 'uppercase',
                    background: 'rgba(0,0,0,0.35)', padding: '3px 8px', borderRadius: 4,
                    display: 'flex', alignItems: 'center', gap: 5, height: 34,
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRESET_COLORS[preset] }} />
                    {activePreset?.label}
                  </div>

                  {/* Rotate */}
                  <button onClick={(e) => { e.stopPropagation(); handleRotate() }} disabled={rotating} style={fabStyle} title="Rotate 90°">
                    {rotating ? <Spinner size={14} /> : '↻'}
                  </button>

                  {/* Download */}
                  {!downloadLoading ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownload() }}
                      disabled={!previewUrl}
                      style={{ ...fabStyle, opacity: previewUrl ? 1 : 0.4, cursor: previewUrl ? 'pointer' : 'not-allowed' }}
                      title="Download full quality"
                    >⬇</button>
                  ) : (
                    <div style={{ ...fabStyle, cursor: 'default' }}>
                      <Spinner size={14} />
                    </div>
                  )}

                  {/* Share — hanya muncul di HP yang support Web Share API */}
                  {canShare && previewUrl && (
                    !sharing ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShare() }}
                        style={fabStyle}
                        title="Share ke Instagram/WhatsApp"
                      >↗</button>
                    ) : (
                      <div style={{ ...fabStyle, cursor: 'default' }}>
                        <Spinner size={14} />
                      </div>
                    )
                  )}
                </div>

                {/* Drag hint */}
                {previewUrl && sliderPos === 50 && (
                  <div style={{
                    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 11, color: 'rgba(201,169,122,0.55)',
                    background: 'rgba(0,0,0,0.4)', padding: '4px 14px', borderRadius: 20,
                    pointerEvents: 'none', whiteSpace: 'nowrap',
                  }}>geser untuk compare</div>
                )}
              </div>

              {/* Info bar */}
              <div style={{
                padding: '9px 14px', background: 'var(--bg2)',
                border: '0.5px solid var(--border)', borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                maxWidth: 900, margin: '0 auto', flexWrap: 'wrap', gap: 6,
              }}>
                <span style={{ fontSize: 12, color: 'var(--gold-dark)' }}>
                  {resultBlob
                    ? `📐 ${imgSize?.w}×${imgSize?.h}px · JPEG Q97 · Resolusi penuh`
                    : hasFineChanges
                      ? `✦ Fine tune aktif (${Object.values(fine).filter(v => v !== 0).length} parameter)`
                      : '✦ Preview — Download untuk hasil full quality'
                  }
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {hasFineChanges && (
                    <button onClick={() => setFine(DEFAULT_FINE)} style={{
                      fontSize: 11, color: 'var(--gold-dark)', background: 'none',
                      border: '0.5px solid var(--border)', borderRadius: 4,
                      padding: '3px 8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                    }}>Reset tuning</button>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRESET_COLORS[preset] }} />
                    <span style={{ fontSize: 12, color: 'var(--gold)' }}>{activePreset?.label}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Spinner({ size = 16, color = 'var(--gold)' }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: `${size > 20 ? 2 : 1.5}px solid rgba(201,169,122,0.2)`,
      borderTopColor: color, borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )
}

function FilmStrip() {
  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} style={{
          width: 12, height: 12, borderRadius: 2,
          border: '0.5px solid rgba(201,169,122,0.18)',
        }} />
      ))}
    </div>
  )
}

function FilmFrame() {
  return (
    <div style={{
      width: 110, height: 80, borderRadius: 4,
      border: '1.5px solid rgba(201,169,122,0.28)',
      position: 'relative', background: 'rgba(201,169,122,0.03)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {[0, 1, 2].map(i => (
        <div key={`t${i}`} style={{
          position: 'absolute', top: -5, left: 10 + i * 34,
          width: 13, height: 9, borderRadius: 2,
          background: 'var(--bg)', border: '0.5px solid rgba(201,169,122,0.25)',
        }} />
      ))}
      {[0, 1, 2].map(i => (
        <div key={`b${i}`} style={{
          position: 'absolute', bottom: -5, left: 10 + i * 34,
          width: 13, height: 9, borderRadius: 2,
          background: 'var(--bg)', border: '0.5px solid rgba(201,169,122,0.25)',
        }} />
      ))}
      <div style={{ fontSize: 26 }}>🎞️</div>
    </div>
  )
}
