'use client'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        <AlertTriangle size={36} className="mx-auto text-[#D97706]" />
        <div>
          <p className="tech-label mb-2">Error de aplicación</p>
          <h2 className="text-lg font-bold text-[var(--fg)]">Algo salió mal</h2>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Ocurrió un error inesperado en la interfaz. Los análisis previos de esta
            sesión no se pierden.
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
