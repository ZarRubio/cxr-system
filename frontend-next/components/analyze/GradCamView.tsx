'use client'
import { useState, useEffect, useMemo } from 'react'
import { Loader2, Thermometer, Maximize2 } from 'lucide-react'
import { blendImagesOnCanvas, decodeDataUri } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ImageLightbox } from '@/components/analyze/ImageLightbox'
import { predict } from '@/lib/api'
import type { Prediction } from '@/lib/types'

interface GradCamViewProps {
  filename?: string
  prediction: Prediction
  originalBytes: Uint8Array
  onPredictionUpdate?: (updated: Prediction) => void
}

export function GradCamView({ prediction, originalBytes, filename = 'image.png', onPredictionUpdate }: GradCamViewProps) {
  const [opacity, setOpacity]       = useState(0.25)
  const [blendResult, setBlendResult] = useState<{ uri: string; source: string; bytes: Uint8Array } | null>(null)
  const [loading, setLoading]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lightbox, setLightbox]     = useState(false)
  const [error, setError] = useState<string | null>(null)

  const gradcamUri = prediction.gradcam_image
  const heatmapUri = prediction.gradcam_heatmap
  const displayBytes = useMemo(() => prediction.image_preview ? decodeDataUri(prediction.image_preview) : originalBytes, [prediction.image_preview, originalBytes])
  const blended = blendResult?.source === heatmapUri && blendResult?.bytes === displayBytes ? blendResult.uri : null
  const renderedMap = heatmapUri ? blended : gradcamUri

  // URL de objeto para la imagen original; el effect solo revoca al desmontar
  const originalSrc = useMemo(() => {
    if (!displayBytes) return null
    return URL.createObjectURL(new Blob([new Uint8Array(displayBytes)]))
  }, [displayBytes])

  useEffect(() => {
    if (!originalSrc) return
    return () => URL.revokeObjectURL(originalSrc)
  }, [originalSrc])

  // Blend original + Grad-CAM whenever opacity or gradcam changes
  useEffect(() => {
    if (!heatmapUri || !displayBytes) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return null
      setError(null)
      setLoading(true)
      return blendImagesOnCanvas(displayBytes, decodeDataUri(heatmapUri), opacity)
    })
      .then(value => { if (!cancelled && value) setBlendResult({ uri: value, source: heatmapUri, bytes: displayBytes }) })
      .catch(() => { if (!cancelled) { setBlendResult(null); setError('No se pudo combinar la imagen. Se muestra el mapa recibido del servicio.') } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [heatmapUri, displayBytes, opacity])

  const handleGenerate = async () => {
    if (!prediction.analysis_id) {
      setError('El estudio debe estar guardado para generar su mapa sin crear otro registro.')
      return
    }
    setGenerating(true)
    try {
      const updated = await predict(originalBytes, filename, 'gradcam', true, { explanationId: prediction.analysis_id })
      onPredictionUpdate?.({ ...prediction, gradcam_image: updated.gradcam_image, gradcam_heatmap: updated.gradcam_heatmap, gradcam_class: updated.gradcam_class, image_preview: updated.image_preview ?? prediction.image_preview })
    } catch {
      setError('No se pudo generar el mapa de calor. Intente nuevamente.')
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
          {renderedMap && heatmapUri && (
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
              {generating ? 'Generando...' : 'Generar mapa de calor'}
            </Button>
          </div>
        )}

        {/* Image */}
        {gradcamUri && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <figure className="min-w-0">
                <figcaption className="text-xs text-[var(--fg-muted)] mb-2">Imagen de entrada (224 x 224)</figcaption>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={originalSrc ?? undefined} alt="Radiografia sin mapa de calor" className="w-full aspect-square object-contain rounded-md bg-[#111111]" />
              </figure>
              <figure className="min-w-0">
                <figcaption className="text-xs text-[var(--fg-muted)] mb-2">Atribución relativa - modelo v2</figcaption>
            <div
              className="viewport-frame relative w-full aspect-square rounded-md overflow-hidden bg-[#111111] flex items-center justify-center cursor-zoom-in"
              role="button"
              tabIndex={blended && heatmapUri ? 0 : -1}
              aria-label="Ampliar mapa de calor"
              onKeyDown={e => { if (blended && heatmapUri && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setLightbox(true) } }}
              onClick={() => blended && heatmapUri && setLightbox(true)}
              title="Click para ampliar"
            >
              {loading && !blended ? (
                <Loader2 size={28} className="text-[var(--primary)] animate-spin" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={renderedMap ?? gradcamUri}
                  alt="Overlay Grad-CAM"
                  className="w-full h-full object-contain"
                />
              )}
              {blended && heatmapUri && (
                <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 flex items-center gap-1 pointer-events-none">
                  <Maximize2 size={11} className="text-white/70" />
                  <span className="text-[10px] text-white/70 font-medium">Ampliar</span>
                </div>
              )}
            </div>
              </figure>
            </div>
            <p className="text-xs text-[var(--fg-muted)]">Azul: menor atribución. Rojo: mayor atribución relativa en esta imagen; no indica gravedad ni probabilidad. Los colores no son comparables entre estudios.</p>

            {/* Opacity slider */}
            {heatmapUri ? <div className="space-y-1">
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
            </div> : <p className="text-xs text-[var(--fg-muted)]">Mapa anterior con superposición fija. No dispone de ajuste de opacidad independiente.</p>}
          </>
        )}
        {error && <p role="alert" className="text-sm badge-high p-3 rounded-md">{error}</p>}
        <p className="text-xs text-[var(--fg-muted)]">Explicación aproximada de v2, no del ensemble completo. No es una segmentación ni confirma enfermedad. La activación en bordes o fuera de la anatomía esperada requiere revisión; no demuestra por sí sola un error del modelo.</p>
      </div>

      {/* Lightbox */}
      {lightbox && heatmapUri && blended && originalSrc && (
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
