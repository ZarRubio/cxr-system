'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react'

interface ImageLightboxProps {
  originalSrc: string
  blendedSrc:  string
  gradcamClass?: string
  opacity:     number
  onOpacityChange: (v: number) => void
  onClose:     () => void
}

export function ImageLightbox({
  originalSrc,
  blendedSrc,
  gradcamClass,
  opacity,
  onOpacityChange,
  onClose,
}: ImageLightboxProps) {
  const [zoom, setZoom]         = useState(1)
  const [offset, setOffset]     = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart  = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const zoomRef    = useRef(1)       // mirror of zoom for use inside non-React listeners
  const containerRef = useRef<HTMLDivElement>(null)

  const clampZoom = (z: number) => Math.min(4, Math.max(1, z))

  // Keep zoomRef in sync
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Block page scroll: both body overflow AND a non-passive wheel listener
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Non-passive wheel listener on the image area so preventDefault works
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setZoom((z) => {
        const next = clampZoom(z - e.deltaY * 0.001)
        if (next <= 1) setOffset({ x: 0, y: 0 })
        return next
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleWheel = useCallback((_e: React.WheelEvent) => {
    // handled by the non-passive listener above — this is a no-op to satisfy JSX
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setOffset({
      x: dragStart.current.ox + (e.clientX - dragStart.current.x),
      y: dragStart.current.oy + (e.clientY - dragStart.current.y),
    })
  }

  const handleMouseUp = () => setDragging(false)

  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }) }

  const download = (src: string, label: string) => {
    const a = document.createElement('a')
    a.href = src
    a.download = `cxr_${label}.png`
    a.click()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      style={{ backdropFilter: 'blur(4px)' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 shrink-0">
        <div>
          <p className="text-sm font-bold text-white">Mapa de activación — Grad-CAM</p>
          {gradcamClass && (
            <p className="text-xs text-white/50 mt-0.5">
              Región activada para: <span className="text-[#22D3EE] font-semibold">{gradcamClass}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => clampZoom(z - 0.25))}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs text-white/60 tabular-nums w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => clampZoom(z + 0.25))}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Acercar"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Restablecer vista"
          >
            <RotateCcw size={16} />
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          {/* Downloads */}
          <button
            onClick={() => download(originalSrc, 'original')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Download size={13} />
            Original
          </button>
          <button
            onClick={() => download(blendedSrc, 'gradcam')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0891B2] text-white hover:bg-[#0E7490] transition-colors cursor-pointer"
          >
            <Download size={13} />
            Grad-CAM
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Image area ── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default',
          overscrollBehavior: 'contain',
        }}
      >
        <div
          style={{
            transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
          }}
        >
          <div className="flex gap-6 items-start">
            {/* Original */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                Radiografía original
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalSrc}
                alt="Radiografía original"
                className="rounded-lg"
                style={{ maxHeight: '62vh', maxWidth: '42vw', objectFit: 'contain' }}
                draggable={false}
              />
            </div>

            {/* Divider */}
            <div className="self-stretch w-px bg-white/15 mt-6" />

            {/* Grad-CAM blended */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs font-semibold text-[#22D3EE] uppercase tracking-wider">
                Mapa Grad-CAM
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={blendedSrc}
                alt="Mapa de calor Grad-CAM"
                className="rounded-lg"
                style={{ maxHeight: '62vh', maxWidth: '42vw', objectFit: 'contain' }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar — opacity slider ── */}
      <div className="shrink-0 px-6 py-3 border-t border-white/10 flex items-center gap-4">
        <span className="text-xs text-white/50 shrink-0">Opacidad del mapa:</span>
        <input
          type="range"
          min={0} max={100} step={5}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-[#0891B2]"
        />
        <span className="text-xs font-bold text-white/70 tabular-nums w-10 text-right">
          {Math.round(opacity * 100)}%
        </span>
        <p className="text-[10px] text-white/30 ml-2 shrink-0">
          Rueda del ratón para zoom · Arrastar para desplazar
        </p>
      </div>
    </div>
  )
}
