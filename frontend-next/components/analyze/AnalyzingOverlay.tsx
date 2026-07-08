'use client'
import { useEffect, useMemo, useState, useRef } from 'react'

const STEPS = [
  { label: 'Validando formato de imagen',         duration: 800  },
  { label: 'Preprocesando imagen (224×224)',       duration: 1200 },
  { label: 'Ejecutando CNN — DenseNet121',         duration: 2000 },
  { label: 'Ejecutando ViT — 4 bloques, 8 heads', duration: 2400 },
  { label: 'Calculando Grad-CAM',                 duration: 2000 },
  { label: 'Aplicando umbrales por clase',         duration: 600  },
]

const TOTAL = STEPS.reduce((s, st) => s + st.duration, 0)

interface Props {
  fileBytes?: Uint8Array
  filename?: string
}

export function AnalyzingOverlay({ fileBytes, filename }: Props) {
  const [stepIdx, setStepIdx]     = useState(0)
  const [progress, setProgress]   = useState(0)
  const [elapsed, setElapsed]     = useState(0)
  const canvasRef                  = useRef<HTMLCanvasElement>(null)

  /* URL de objeto para la miniatura; el effect solo revoca al desmontar */
  const thumbUrl = useMemo(() => {
    if (!fileBytes || fileBytes.length === 0) return null
    const blob = new Blob([fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength) as ArrayBuffer])
    return URL.createObjectURL(blob)
  }, [fileBytes])

  useEffect(() => {
    if (!thumbUrl) return
    return () => URL.revokeObjectURL(thumbUrl)
  }, [thumbUrl])

  /* Step progression */
  useEffect(() => {
    let acc = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    STEPS.forEach((step, i) => {
      const t = setTimeout(() => setStepIdx(i), acc)
      timers.push(t)
      acc += step.duration
    })
    return () => timers.forEach(clearTimeout)
  }, [])

  /* Progress bar */
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const ms = Date.now() - start
      setElapsed(ms)
      setProgress(Math.min(95, (ms / TOTAL) * 100))
    }, 80)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 p-7 flex flex-col items-center gap-5 shadow-2xl">

        {/* Top section: icon + preview side by side */}
        <div className="flex items-center gap-5 w-full">

          {/* Animated X-ray icon */}
          <div className="relative w-20 h-20 shrink-0">
            <span className="absolute inset-0 rounded-full bg-[var(--primary)]/15 animate-ping" />
            <span className="absolute inset-2 rounded-full bg-[var(--primary)]/10 animate-ping [animation-delay:300ms]" />
            <div className="absolute inset-0 rounded-full bg-[#0A0E1A] border-2 border-[var(--primary)]/40 flex items-center justify-center overflow-hidden">
              <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--primary-light)] to-transparent animate-scan-line" />
              <svg viewBox="0 0 48 56" className="w-12 h-12 opacity-60" fill="none">
                <path d="M8 10 Q4 16 4 28 Q4 44 24 50 Q44 44 44 28 Q44 16 40 10" stroke="var(--primary-light)" strokeWidth="1.5" strokeLinecap="round" className="animate-pulse" />
                <line x1="24" y1="8" x2="24" y2="46" stroke="var(--primary-light)" strokeWidth="1" opacity="0.5" />
                <path d="M24 16 Q14 18 10 24" stroke="var(--primary-light)" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
                <path d="M24 22 Q13 24 9 31"  stroke="var(--primary-light)" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
                <path d="M24 28 Q13 30 10 37" stroke="var(--primary-light)" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
                <path d="M24 16 Q34 18 38 24" stroke="var(--primary-light)" strokeWidth="1" opacity="0.6" strokeLinecap="round" />
                <path d="M24 22 Q35 24 39 31"  stroke="var(--primary-light)" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
                <path d="M24 28 Q35 30 38 37" stroke="var(--primary-light)" strokeWidth="1" opacity="0.4" strokeLinecap="round" />
                <ellipse cx="21" cy="34" rx="5" ry="7" stroke="var(--primary-light)" strokeWidth="1.2" opacity="0.7" className="animate-pulse [animation-duration:1s]" />
              </svg>
            </div>
          </div>

          {/* Image preview + info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[var(--fg)]">Analizando radiografía</p>
            <p className="text-xs text-[var(--fg-subtle)] mt-0.5">Ensemble CNN-ViT · DenseNet121 + Transformer</p>
            {filename && (
              <p className="readout text-[11px] text-[var(--primary)] mt-1 truncate" title={filename}>
                {filename}
              </p>
            )}

            {/* Thumbnail */}
            {thumbUrl && (
              <div className="viewport-frame mt-2 w-full max-w-[140px] aspect-square rounded-lg overflow-hidden bg-gray-900 border border-[var(--primary)]/30 relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt="Imagen en análisis" className="w-full h-full object-cover grayscale opacity-80" />
                {/* Scan line over preview */}
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[var(--primary-light)]/60 to-transparent animate-scan-line" />
                </div>
              </div>
            )}
          </div>
        </div>

        <canvas ref={canvasRef} className="hidden" />

        {/* Steps */}
        <div className="w-full space-y-2">
          {STEPS.map((step, i) => {
            const done    = i < stepIdx
            const current = i === stepIdx
            return (
              <div key={i} className="flex items-center gap-2.5">
                <div className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center transition-all duration-300 ${
                  done    ? 'bg-[#16A34A]' :
                  current ? 'bg-[var(--primary)] animate-pulse' :
                            'bg-[var(--border)]'
                }`}>
                  {done && (
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {current && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span className={`text-xs transition-all duration-300 ${
                  done    ? 'text-[var(--fg-subtle)] line-through' :
                  current ? 'text-[var(--fg)] font-semibold' :
                            'text-[var(--fg-subtle)]'
                }`}>
                  {step.label}
                </span>
              </div>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-1.5">
          <div className="h-1.5 w-full rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] transition-all duration-150"
              style={{ width: `${progress.toFixed(1)}%` }}
            />
          </div>
          <div className="readout flex justify-between text-[10px] text-[var(--fg-subtle)]">
            <span>{progress.toFixed(0)}%</span>
            <span>{(elapsed / 1000).toFixed(1)}s</span>
          </div>
        </div>

        <p className="text-[10px] text-[var(--fg-subtle)] text-center">
          Este proceso puede tomar 30–90 s en CPU
        </p>
      </div>
    </div>
  )
}
