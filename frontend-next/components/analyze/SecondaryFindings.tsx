import { Info } from 'lucide-react'
import { getSeverity } from '@/lib/utils'
import { SEVERITY_COLORS, BADGES } from '@/lib/constants'
import type { Prediction } from '@/lib/types'

interface SecondaryFindingsProps {
  prediction: Prediction
  thresholds?: Record<string, number>
}

export function SecondaryFindings({ prediction, thresholds }: SecondaryFindingsProps) {
  const predicted  = prediction.predicted_class
  const additional = (prediction.positive_findings ?? []).filter((f) => f !== predicted)
  if (additional.length === 0) return null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Info size={15} className="text-[#D97706]" />
        <h4 className="text-sm font-semibold text-[var(--fg)]">Hallazgos secundarios sobre umbral</h4>
      </div>
      <p className="text-xs text-[var(--fg-subtle)] mb-3">
        El modelo detectó señales adicionales. No implica diagnóstico; requiere revisión médica.
      </p>
      <div className="space-y-2">
        {additional.map((cls) => {
          const prob = prediction.probabilities[cls] ?? 0
          const thr  = thresholds?.[cls] ?? 0.3
          const sv   = getSeverity(cls)
          const c    = SEVERITY_COLORS[sv]
          return (
            <div key={cls} className="flex items-center gap-3">
              <span
                className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
                style={{ background: c.bar, color: '#fff' }}
              >
                {BADGES[cls] ?? cls.toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold" style={{ color: c.bar }}>{cls}</span>
              </div>
              <span className="text-xs tabular-nums font-bold" style={{ color: c.bar }}>
                {(prob * 100).toFixed(1)}%
              </span>
              <span className="text-[10px] text-[var(--fg-subtle)] tabular-nums">
                (umbral {(thr * 100).toFixed(0)}%)
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
