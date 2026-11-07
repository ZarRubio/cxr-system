'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

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
  const closeRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const clampZoom = (z: number) => Math.min(4, Math.max(1, z))

  // Keep zoomRef in sync
  useEffect(() => { zoomRef.current = zoom }, [zoom])

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
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal>
    <Dialog.Content
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
      style={{ backdropFilter: 'blur(4px)' }}
      onOpenAutoFocus={event => {
        returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        event.preventDefault()
        closeRef.current?.focus()
      }}
      onCloseAutoFocus={event => {
        event.preventDefault()
        returnFocusRef.current?.focus()
      }}
    >
      <Dialog.Title className="sr-only">Visor ampliado del mapa Grad-CAM</Dialog.Title>
      <Dialog.Description className="sr-only">Comparación de la radiografía original y las regiones que influyeron en el modelo. No confirma una lesion ni su localizacion.</Dialog.Description>
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div>
          <p className="text-sm font-bold text-white">Mapa de activación — Grad-CAM</p>
          {gradcamClass && (
            <p className="text-xs text-white/50 mt-0.5">
              Región activada para: <span className="text-[var(--primary-light)] font-semibold">{gradcamClass}</span>
            </p>
          )}
        </div>

        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom((z) => clampZoom(z - 0.25))}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Alejar"
          >
            <ZoomOut size={18} />
          </button>
          <span className="readout text-xs text-white/60 w-10 text-center">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 transition-all cursor-pointer"
          >
            <Download size={13} />
            Grad-CAM
          </button>

          <div className="w-px h-5 bg-white/20 mx-1" />

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar visor del mapa"
            title="Cerrar visor del mapa"
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
              <p className="tech-label text-white/60">
                Radiografía original
              </p>
              <div className="viewport-frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalSrc}
                  alt="Radiografía original"
                  className="rounded-lg"
                  style={{ maxHeight: '62vh', maxWidth: '42vw', objectFit: 'contain' }}
                  draggable={false}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="self-stretch w-px bg-white/15 mt-6" />

            {/* Grad-CAM blended */}
            <div className="flex flex-col items-center gap-2">
              <p className="tech-label text-[var(--primary-light)]">
                Mapa Grad-CAM
              </p>
              <div className="viewport-frame">
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
      </div>

      {/* ── Bottom bar — opacity slider ── */}
      <div className="shrink-0 px-6 py-3 border-t border-white/10 flex items-center gap-4">
        <span className="text-xs text-white/50 shrink-0">Opacidad del mapa:</span>
        <input
          type="range"
          aria-label="Opacidad del mapa ampliado"
          min={0} max={100} step={5}
          value={Math.round(opacity * 100)}
          onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-[var(--primary)]"
        />
        <span className="readout text-xs font-bold text-white/70 w-10 text-right">
          {Math.round(opacity * 100)}%
        </span>
        <p className="hidden sm:block text-[10px] text-white/30 ml-2 shrink-0">
          Rueda del ratón para zoom · Arrastrar para desplazar
        </p>
      </div>
    </Dialog.Content>
    </Dialog.Portal>
    </Dialog.Root>
  )
}
