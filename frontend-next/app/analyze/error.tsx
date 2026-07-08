'use client'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function AnalyzeError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <AlertTriangle size={36} className="mx-auto text-[#D97706]" />
        <div>
          <p className="tech-label mb-2">Módulo de análisis</p>
          <h2 className="text-lg font-bold text-[var(--fg)]">No se pudo mostrar el análisis</h2>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Ocurrió un error al procesar la vista. Vuelva a intentarlo; si persiste,
            cargue nuevamente la radiografía.
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white cursor-pointer"
          style={{ background: 'var(--primary)' }}
        >
          <RotateCcw size={14} />
          Reintentar
        </button>
      </div>
    </div>
  )
}
