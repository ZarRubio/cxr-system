'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitCompare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UploadArea } from '@/components/analyze/UploadArea'
import { FindingCard } from '@/components/analyze/FindingCard'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { GradCamView } from '@/components/analyze/GradCamView'
import { fetchModelInfo, predict } from '@/lib/api'
import type { Prediction } from '@/lib/types'

interface ImageSlot {
  bytes: Uint8Array
  name: string
  prediction: Prediction | null
  loading: boolean
  error: string | null
}

function emptySlot(): ImageSlot {
  return { bytes: new Uint8Array(), name: '', prediction: null, loading: false, error: null }
}

export default function ComparePage() {
  const [slotA, setSlotA] = useState<ImageSlot>(emptySlot())
  const [slotB, setSlotB] = useState<ImageSlot>(emptySlot())
  const [running, setRunning] = useState(false)

  const { data: modelInfo } = useQuery({ queryKey: ['model-info'], queryFn: fetchModelInfo })

  const bothReady = slotA.bytes.length > 0 && slotB.bytes.length > 0
  const hasResults = slotA.prediction !== null || slotB.prediction !== null

  const handleCompare = async () => {
    setRunning(true)
    setSlotA((s) => ({ ...s, loading: true, error: null }))
    setSlotB((s) => ({ ...s, loading: true, error: null }))

    const [ra, rb] = await Promise.allSettled([
      predict(slotA.bytes, slotA.name, 'gradcam', 1, true),
      predict(slotB.bytes, slotB.name, 'gradcam', 1, true),
    ])

    setSlotA((s) => ({
      ...s,
      loading: false,
      prediction: ra.status === 'fulfilled' ? ra.value : null,
      error: ra.status === 'rejected' ? String(ra.reason) : null,
    }))
    setSlotB((s) => ({
      ...s,
      loading: false,
      prediction: rb.status === 'fulfilled' ? rb.value : null,
      error: rb.status === 'rejected' ? String(rb.reason) : null,
    }))
    setRunning(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)]">Comparación de radiografías</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Carga dos imágenes para comparar hallazgos lado a lado con el mismo modelo.
        </p>
      </div>

      {/* Upload row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 space-y-2">
          <p className="text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider">Imagen A</p>
          <UploadArea
            onFile={(b, n) => setSlotA({ ...emptySlot(), bytes: b, name: n })}
            currentFilename={slotA.name || undefined}
            onClear={() => setSlotA(emptySlot())}
          />
        </div>
        <div className="card p-4 space-y-2">
          <p className="text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider">Imagen B</p>
          <UploadArea
            onFile={(b, n) => setSlotB({ ...emptySlot(), bytes: b, name: n })}
            currentFilename={slotB.name || undefined}
            onClear={() => setSlotB(emptySlot())}
          />
        </div>
      </div>

      {/* Compare button */}
      <Button
        onClick={handleCompare}
        loading={running}
        size="lg"
        disabled={!bothReady}
        className="w-full"
      >
        <GitCompare size={18} />
        {running ? 'Comparando...' : 'Comparar ambas imágenes'}
      </Button>

      {!bothReady && (
        <p className="text-xs text-[var(--fg-subtle)] text-center">
          Carga ambas imágenes para habilitar la comparación.
        </p>
      )}

      {/* Results */}
      {hasResults && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { slot: slotA, label: 'A' },
            { slot: slotB, label: 'B' },
          ].map(({ slot, label }) => (
            <div key={label} className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-[var(--fg-subtle)] uppercase tracking-wider">
                  Imagen {label}
                </span>
                {slot.name && (
                  <span className="text-xs text-[var(--fg-subtle)] font-mono truncate">{slot.name}</span>
                )}
              </div>

              {slot.loading && (
                <div className="card p-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#0891B2]" />
                </div>
              )}

              {slot.error && (
                <div className="flex items-start gap-2 rounded-xl bg-[#FEE2E2] border border-[#FCA5A5] px-4 py-3">
                  <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#991B1B]">{slot.error}</p>
                </div>
              )}

              {slot.prediction && (
                <>
                  {slot.bytes.length > 0 && (
                    <GradCamView
                      prediction={slot.prediction}
                      originalBytes={slot.bytes}
                    />
                  )}
                  <FindingCard prediction={slot.prediction} />
                  <div className="card p-4">
                    <ProbabilityBars prediction={slot.prediction} thresholds={modelInfo?.thresholds} />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!hasResults && !running && (
        <div className="text-center py-12 text-[var(--fg-subtle)]">
          <GitCompare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Los resultados aparecerán aquí después de comparar.</p>
        </div>
      )}
    </div>
  )
}
