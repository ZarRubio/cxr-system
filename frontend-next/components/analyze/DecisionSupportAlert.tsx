import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react'
import type { Prediction } from '@/lib/types'

type Support = NonNullable<Prediction['decision_support']>

const CONFIG = {
  stable: {
    title: 'Concordancia técnica entre modelos',
    Icon: CheckCircle2,
    classes: 'border-[#86EFAC] bg-[#F0FDF4] text-[#166534] dark:border-[#166534] dark:bg-[#052E16] dark:text-[#BBF7D0]',
  },
  borderline: {
    title: 'Decisión cercana al umbral',
    Icon: Scale,
    classes: 'border-[#FCD34D] bg-[#FFFBEB] text-[#92400E] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FDE68A]',
  },
  discordant: {
    title: 'Desacuerdo entre los modelos',
    Icon: AlertTriangle,
    classes: 'border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B] dark:border-[#991B1B] dark:bg-[#450A0A] dark:text-[#FECACA]',
  },
} as const

export function DecisionSupportAlert({ support }: { support?: Support }) {
  if (!support) return null
  const config = CONFIG[support.status]
  const Icon = config.Icon

  return (
    <section className={`rounded-lg border p-4 ${config.classes}`} aria-label="Concordancia técnica del modelo">
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold">{config.title}</h3>
          <p className="mt-1 text-xs leading-5">
            Clase evaluada: <strong>{support.focus_class}</strong>. Desacuerdo:{' '}
            <strong>{(support.model_disagreement * 100).toFixed(1)} pp</strong>; distancia al umbral:{' '}
            <strong>{(support.threshold_margin * 100).toFixed(1)} pp</strong>.
          </p>
          {support.reasons.map((reason) => (
            <p key={reason} className="mt-1 text-xs leading-5">{reason}</p>
          ))}
          <p className="mt-2 text-xs font-semibold leading-5">{support.recommendation}</p>
          <p className="mt-1 text-[11px] leading-4 opacity-80">
            Evalúa consistencia interna del ensemble. No es una probabilidad clínica calibrada.
          </p>
        </div>
      </div>
    </section>
  )
}
