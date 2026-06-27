'use client'
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, ShieldAlert } from 'lucide-react'
import { RECOMMENDATIONS, URGENCY_LABELS, URGENCY_COLORS, BADGES } from '@/lib/constants'
import type { Urgency } from '@/lib/constants'
import type { Prediction } from '@/lib/types'

const URGENCY_ICONS: Record<Urgency, React.ElementType> = {
  stat:     ShieldAlert,
  urgente:  AlertCircle,
  electivo: Clock,
  rutina:   CheckCircle2,
}

interface Props {
  prediction: Prediction
}

export function ClinicalRecommendations({ prediction }: Props) {
  const cls  = prediction.predicted_class
  const rec  = RECOMMENDATIONS[cls]
  if (!rec) return null

  const colors = URGENCY_COLORS[rec.urgency]
  const Icon   = URGENCY_ICONS[rec.urgency]
  const badge  = BADGES[cls] ?? cls

  return (
    <div className="card overflow-hidden">
      {/* Urgency header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        <Icon size={16} style={{ color: colors.text }} className="shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-widest" style={{ color: colors.text }}>
            {URGENCY_LABELS[rec.urgency]}
          </p>
          <p className="text-xs font-semibold text-[var(--fg)] mt-0.5">
            Recomendaciones para: <span style={{ color: colors.text }}>{badge}</span>
          </p>
        </div>
        {rec.urgency === 'stat' && (
          <span
            className="ml-auto shrink-0 text-[10px] font-extrabold px-2 py-0.5 rounded-full animate-pulse"
            style={{ background: colors.text, color: '#fff' }}
          >
            STAT
          </span>
        )}
      </div>

      {/* Action list */}
      <ul className="p-4 space-y-2.5">
        {rec.actions.map((action, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span
              className="mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: colors.text }}
            >
              {i + 1}
            </span>
            <span className="text-sm text-[var(--fg)] leading-5">{action}</span>
          </li>
        ))}
      </ul>

      {/* Footer disclaimer */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-[var(--fg-subtle)] italic leading-4 flex items-start gap-1">
          <AlertTriangle size={10} className="shrink-0 mt-0.5" />
          Recomendaciones orientativas basadas en el hallazgo IA. Decisión clínica final a criterio del médico tratante.
        </p>
      </div>
    </div>
  )
}
