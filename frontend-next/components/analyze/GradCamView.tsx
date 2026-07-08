'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { Loader2, Thermometer, Maximize2 } from 'lucide-react'
import { blendImagesOnCanvas, decodeDataUri } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImageLightbox } from '@/components/analyze/ImageLightbox'
import { predict } from '@/lib/api'
import type { Prediction } from '@/lib/types'

interface GradCamViewProps {
  prediction: Prediction
  originalBytes: Uint8Array
  onPredictionUpdate?: (updated: Prediction) => void
}

export function GradCamView({ prediction, originalBytes, onPredictionUpdate }: GradCamViewProps) {
  const [opacity, setOpacity]       = useState(0.65)
  const [blended, setBlended]       = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lightbox, setLightbox]     = useState(false)
  const prevRef = useRef<string>('')

  const gradcamUri = prediction.gradcam_image

  // URL de objeto para la imagen original; el effect solo revoca al desmontar
  const originalSrc = useMemo(() => {
    if (!originalBytes) return null
    return URL.createObjectURL(new Blob([originalBytes.buffer as ArrayBuffer]))
  }, [originalBytes])

  useEffect(() => {
    if (!originalSrc) return
    return () => URL.revokeObjectURL(originalSrc)
  }, [originalSrc])

  // Blend original + Grad-CAM whenever opacity or gradcam changes
  useEffect(() => {
    if (!gradcamUri || !originalBytes) return
    const key = `${gradcamUri.slice(0, 32)}_${opacity}`
    if (prevRef.current === key) return
    prevRef.current = key

    setLoading(true)
    const camBytes = decodeDataUri(gradcamUri)
    blendImagesOnCanvas(originalBytes, camBytes, opacity)
      .then(setBlended)
      .finally(() => setLoading(false))
  }, [gradcamUri, originalBytes, opacity])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const updated = await predict(originalBytes, prediction.gradcam_class ?? 'image.png', 'gradcam', true)
      onPredictionUpdate?.(updated)
    } catch {
      // silently fail — user can retry
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <div className="card p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer size={16} className="text-[var(--primary)]" />
            <h4 className="text-sm font-semibold text-[var(--fg)]">Mapa de calor (Grad-CAM)</h4>
          </div>
          {blended && (
            <button
              onClick={() => setLightbox(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:opacity-80 transition-all cursor-pointer"
              title="Ver en pantalla completa"
            >
              <Maximize2 size={14} />
              Ampliar
            </button>
          )}
        </div>

        {prediction.gradcam_class && (
          <p className="text-xs text-[var(--fg-subtle)]">
            Regiones activadas para: <strong>{prediction.gradcam_class}</strong>
          </p>
        )}

        {/* No Grad-CAM yet */}
        {!gradcamUri && (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--fg-subtle)] mb-3">
              El análisis rápido no incluye el mapa de calor.
            </p>
            <Button onClick={handleGenerate} loading={generating} size="md">
              {generating ? 'Generando (~1-2 min)...' : 'Generar mapa de calor'}
            </Button>
          </div>
        )}

        {/* Image */}
        {gradcamUri && (
          <>
            <div
              className="viewport-frame relative w-full aspect-square rounded-lg overflow-hidden bg-gray-900 flex items-center justify-center cursor-zoom-in"
              onClick={() => blended && setLightbox(true)}
              title="Click para ampliar"
            >
              {(loading || !blended) ? (
                <Loader2 size={28} className="text-[var(--primary)] animate-spin" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={blended}
                  alt="Overlay Grad-CAM"
                  className="w-full h-full object-contain"
                />
              )}
              {blended && (
                <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1 pointer-events-none">
                  <Maximize2 size={11} className="text-white/70" />
                  <span className="text-[10px] text-white/70 font-medium">Ampliar</span>
                </div>
              )}
            </div>

            {/* Opacity slider */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--fg-muted)]">
                  Opacidad del mapa
                </label>
                <span className="readout text-xs font-bold text-[var(--fg)]">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0} max={100} step={5}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-full h-2 appearance-none rounded-full cursor-pointer accent-[var(--primary)]"
                aria-label="Opacidad del mapa de calor"
              />
              <p className="text-[10px] text-[var(--fg-subtle)]">
                Solo modifica la visualización — no vuelve a ejecutar el modelo
              </p>
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && blended && originalSrc && (
        <ImageLightbox
          originalSrc={originalSrc}
          blendedSrc={blended}
          gradcamClass={prediction.gradcam_class}
          opacity={opacity}
          onOpacityChange={setOpacity}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  )
}
