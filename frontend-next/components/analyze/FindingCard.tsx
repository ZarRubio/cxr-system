import { cn } from '@/lib/utils'
import { getSeverity } from '@/lib/utils'
import { BADGES, DESCRIPTIONS, SEVERITY_COLORS, SEVERITY_LABELS } from '@/lib/constants'
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import type { Prediction } from '@/lib/types'

const SEVERITY_ICONS = {
  critical: AlertTriangle,
  high:     AlertCircle,
  moderate: Info,
  normal:   CheckCircle2,
}

const STRIPE_CLASSES = {
  critical: 'finding-stripe-critical',
  high:     'finding-stripe-high',
  moderate: 'finding-stripe-moderate',
  normal:   'finding-stripe-normal',
}

function ConfidenceSignal({ confidence, uncertainty }: { confidence: number; uncertainty?: number }) {
  const highUncertainty = uncertainty !== undefined && uncertainty > 0.10
  let level: 'high' | 'medium' | 'low'
  if (confidence >= 0.75 && !highUncertainty) level = 'high'
  else if (confidence >= 0.50 && !highUncertainty) level = 'medium'
  else level = 'low'

  const config = {
    high:   { label: 'Alta confianza',    color: '#16A34A', bg: '#DCFCE7' },
    medium: { label: 'Confianza moderada', color: '#D97706', bg: '#FEF3C7' },
    low:    { label: 'Confianza baja — revisar con radiólogo', color: '#DC2626', bg: '#FEE2E2' },
  }[level]

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: config.bg, color: config.color }}
    >
      {config.label}
    </span>
  )
}

interface FindingCardProps {
  prediction: Prediction
  compact?: boolean
}

export function FindingCard({ prediction, compact = false }: FindingCardProps) {
  const cls = prediction.predicted_class
  const severity = getSeverity(cls)
  const colors = SEVERITY_COLORS[severity]
  const badge = BADGES[cls] ?? cls.toUpperCase()
  const desc = DESCRIPTIONS[cls] ?? ''
  const Icon = SEVERITY_ICONS[severity]
  const uncert = prediction.uncertainty_std?.[cls]

  if (compact) {
    return (
      <div
        className={cn('card p-4', STRIPE_CLASSES[severity])}
        style={{ background: colors.bg + '33' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
              style={{ background: colors.bar, color: '#fff' }}
            >
              {badge}
            </span>
            <span className="text-sm font-bold text-[var(--fg)] truncate">{cls}</span>
          </div>
          <span className="text-lg font-extrabold shrink-0" style={{ color: colors.bar }}>
            {(prediction.confidence * 100).toFixed(1)}%
          </span>
        </div>
        {!compact && desc && (
          <p className="text-xs text-[var(--fg-muted)] mt-2 leading-5">{desc}</p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('card overflow-hidden', STRIPE_CLASSES[severity])}>
      <div className="p-5">
        {/* Badge + severity */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-widest"
              style={{ background: colors.bar, color: '#fff' }}
            >
              {badge}
            </span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold border"
              style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
            >
              {SEVERITY_LABELS[severity]}
            </span>
          </div>
          <Icon size={20} style={{ color: colors.bar }} className="shrink-0 mt-0.5" />
        </div>

        {/* Class name + confidence */}
        <h2 className="text-2xl font-bold mb-1" style={{ color: colors.text }}>{cls}</h2>
        <div className="text-4xl font-extrabold mb-3" style={{ color: colors.bar }}>
          {(prediction.confidence * 100).toFixed(1)}%
        </div>

        {/* Confidence signal */}
        <div className="mb-4">
          <ConfidenceSignal confidence={prediction.confidence} uncertainty={uncert} />
        </div>

        {/* Description */}
        {desc && (
          <p className="text-sm text-[var(--fg-muted)] leading-6">{desc}</p>
        )}
      </div>

      {/* Image warnings */}
      {prediction.image_warnings && prediction.image_warnings.length > 0 && (
        <div className="border-t border-[var(--border-subtle)] px-5 py-3 bg-[#FEF3C7] dark:bg-[#451A03]">
          {prediction.image_warnings.map((w, i) => (
            <p key={i} className="text-xs text-[#92400E] dark:text-[#FCD34D] flex items-center gap-1.5">
              <AlertTriangle size={12} />
              {w}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* Card for "No Finding" */
export function NoFindingCard() {
  return (
    <div className={cn('card overflow-hidden finding-stripe-normal')}>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-widest bg-[#16A34A] text-white">
            NORMAL
          </span>
        </div>
        <h2 className="text-2xl font-bold text-[#166534] dark:text-[#86EFAC] mb-2">No Finding</h2>
        <p className="text-sm text-[var(--fg-muted)] leading-6">{DESCRIPTIONS['No Finding']}</p>
      </div>
    </div>
  )
}

/* Card for multiple findings */
export function MultipleFindingsCard({ prediction }: { prediction: Prediction }) {
  const positive = prediction.positive_findings ?? []
  if (positive.length === 0) return <NoFindingCard />
  if (positive.length === 1) return <FindingCard prediction={prediction} />

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <AlertTriangle size={16} className="text-[#D97706]" />
        <span className="text-sm font-bold text-[var(--fg)]">
          {positive.length} hallazgos detectados
        </span>
      </div>
      {positive.map((cls) => (
        <FindingCard
          key={cls}
          compact
          prediction={{ ...prediction, predicted_class: cls }}
        />
      ))}
    </div>
  )
}
