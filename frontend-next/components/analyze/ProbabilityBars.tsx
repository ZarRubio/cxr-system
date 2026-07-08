'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { getSeverity } from '@/lib/utils'
import { SEVERITY_COLORS } from '@/lib/constants'
import type { Prediction } from '@/lib/types'

interface ProbabilityBarsProps {
  prediction: Prediction
  thresholds?: Record<string, number>
}

export function ProbabilityBars({ prediction, thresholds }: ProbabilityBarsProps) {
  const [showAll, setShowAll] = useState(false)
  const sorted = Object.entries(prediction.probabilities).sort(([, a], [, b]) => b - a)
  const visible = showAll ? sorted : sorted.filter(([, p]) => p >= 0.03)
  const hidden  = sorted.filter(([, p]) => p < 0.03)

  return (
    <div className="space-y-2">
      <h4 className="tech-label block mb-1">
        Score IA por clase
      </h4>
      <p className="text-[10px] text-[var(--fg-subtle)] mb-3">
        La línea vertical indica el umbral diagnóstico por clase. Las barras que la superan son hallazgos positivos.
      </p>
      {visible.map(([cls, prob]) => {
        const severity = getSeverity(cls)
        const colors   = SEVERITY_COLORS[severity]
        const pct      = prob * 100
        const thr      = (thresholds?.[cls] ?? 0.3) * 100

        return (
          <div key={cls} className="flex items-center gap-3">
            <span
              className="w-[130px] shrink-0 text-xs font-semibold truncate"
              style={{ color: colors.bar }}
            >
              {cls}
            </span>
            <div className="flex-1 relative">
              <div className="h-2.5 rounded-full bg-[var(--border-subtle)]">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${pct.toFixed(1)}%`, background: colors.bar }}
                />
              </div>
              {/* Threshold marker */}
              <div
                className="absolute top-[-3px] w-[2px] h-[18px] bg-[var(--fg)] opacity-30 rounded"
                style={{ left: `${thr.toFixed(1)}%` }}
                title={`Umbral: ${thr.toFixed(0)}%`}
              />
            </div>
            <span
              className="readout w-10 shrink-0 text-right text-xs font-bold"
              style={{ color: colors.bar }}
            >
              {pct.toFixed(1)}%
            </span>
          </div>
        )
      })}

      {hidden.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex items-center gap-1 text-xs text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors mt-1 cursor-pointer"
        >
          {showAll ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          {showAll ? 'Mostrar menos' : `${hidden.length} clases con probabilidad < 3%`}
        </button>
      )}

      <p className="readout text-[10px] text-[var(--fg-subtle)] pt-1">
        Procesado en {prediction.processing_time_ms.toFixed(0)} ms
        {prediction.model_version && ` · ${prediction.model_version}`}
        {prediction.cached && ' · resultado en caché'}
      </p>
    </div>
  )
}
