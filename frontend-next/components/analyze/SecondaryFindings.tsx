import { Info, Eye } from 'lucide-react'
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
  const subThreshold = prediction.sub_threshold_findings ?? []

  if (additional.length === 0 && subThreshold.length === 0) return null

  return (
    <div className="card p-4 space-y-4">
      {/* Hallazgos sobre umbral */}
      {additional.length > 0 && (
        <div>
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
                  <span className="readout text-xs font-bold" style={{ color: c.bar }}>
                    {(prob * 100).toFixed(1)}%
                  </span>
                  <span className="readout text-[10px] text-[var(--fg-subtle)]">
                    (umbral {(thr * 100).toFixed(0)}%)
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Hallazgos sub-umbral — vigilancia */}
      {subThreshold.length > 0 && (
        <div className={additional.length > 0 ? 'border-t border-[var(--border-subtle)] pt-4' : ''}>
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-[var(--fg-subtle)]" />
            <h4 className="tech-label">
              Hallazgos sub-umbral a vigilar
            </h4>
          </div>
          <p className="text-[11px] text-[var(--fg-subtle)] mb-2 leading-4">
            Señales débiles (10–umbral%). No superan el umbral diagnóstico pero pueden ser relevantes en contexto clínico.
          </p>
          <div className="space-y-1.5">
            {subThreshold
              .sort((a, b) => b.probability - a.probability)
              .map((item) => {
                const sv = getSeverity(item.class)
                const c  = SEVERITY_COLORS[sv]
                return (
                  <div key={item.class} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.bar, opacity: 0.5 }} />
                    <span className="text-[11px] text-[var(--fg-muted)] flex-1">
                      {BADGES[item.class] ?? item.class}
                    </span>
                    <span className="readout text-[11px] text-[var(--fg-subtle)]">
                      {(item.probability * 100).toFixed(1)}%
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
