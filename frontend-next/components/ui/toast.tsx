'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SEVERITY_COLORS } from '@/lib/constants'
import { getSeverity } from '@/lib/utils'

interface ToastProps {
  predicted: string
  confidence: number
  onClose: () => void
}

export function SuccessToast({ predicted, confidence, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    const t1 = setTimeout(() => setVisible(true), 10)
    // Auto-dismiss after 4.5s
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 350)
    }, 4500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  const severity = getSeverity(predicted)
  const colors   = SEVERITY_COLORS[severity]

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-20 lg:bottom-6 right-4 z-50 w-80 card shadow-xl transition-all duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      {/* Accent stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl" style={{ background: colors.bar }} />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3.5">
        <CheckCircle2 size={18} className="shrink-0 mt-0.5" style={{ color: colors.bar }} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--fg)]">Análisis completado</p>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            <span className="font-semibold" style={{ color: colors.bar }}>{predicted}</span>
            {' · '}{(confidence * 100).toFixed(1)}% confianza
          </p>
        </div>

        <button
          onClick={() => { setVisible(false); setTimeout(onClose, 350) }}
          className="shrink-0 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors cursor-pointer p-0.5 rounded"
          aria-label="Cerrar notificación"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress bar that depletes */}
      <div className="absolute bottom-0 left-1 right-0 h-0.5 rounded-b-xl overflow-hidden">
        <div
          className="h-full rounded-b-xl"
          style={{
            background: colors.bar,
            animation: 'toast-progress 4.5s linear forwards',
          }}
        />
      </div>

      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  )
}
