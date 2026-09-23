import { Info } from 'lucide-react'
import { getSeverity } from '@/lib/utils'
import { BADGES, DESCRIPTIONS, SEVERITY_LABELS } from '@/lib/constants'
import type { Prediction } from '@/lib/types'

export function FindingCard({ prediction, compact = false }: { prediction: Prediction; compact?: boolean }) {
  const cls = prediction.predicted_class
  if (cls === 'No Finding') return <NoFindingCard />
  const severity = getSeverity(cls)
  const score = prediction.probabilities?.[cls] ?? prediction.confidence
  return (
    <article className={`card finding-stripe-${severity} ${compact ? 'p-4' : 'p-5'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold text-[var(--fg)]`}>{BADGES[cls] ?? cls}</h3>
          <p className="text-xs text-[var(--fg-subtle)] mt-1">{cls}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="readout text-xl font-semibold">{(score * 100).toFixed(1)}%</p>
          <p className="text-xs text-[var(--fg-muted)]">Score IA</p>
        </div>
      </div>
      {!compact && <>
        <p className={`badge-${severity} inline-block mt-4 rounded px-2 py-1 text-xs font-medium`}>{SEVERITY_LABELS[severity]}</p>
        <p className="text-xs text-[var(--fg-muted)] mt-3">Score no calibrado. No representa la probabilidad clínica de enfermedad.</p>
        {DESCRIPTIONS[cls] && <p className="text-sm leading-6 text-[var(--fg-muted)] border-t border-[var(--border-subtle)] mt-4 pt-4">{DESCRIPTIONS[cls]}</p>}
      </>}
      {!compact && prediction.image_warnings?.map((warning, index) => <p key={index} className="badge-high rounded p-3 mt-3 text-xs">{warning}</p>)}
    </article>
  )
}

export function NoFindingCard() {
  return (
    <section className="card p-5">
      <div className="flex gap-3 items-start"><Info size={20} className="text-[var(--fg-muted)] shrink-0 mt-1" /><h3 className="text-lg font-semibold">Sin hallazgos sobre umbral</h3></div>
      <p className="text-sm text-[var(--fg-muted)] leading-6 mt-3">Ninguna de las clases evaluadas superó el umbral del modelo. Esto no confirma una radiografía normal ni descarta enfermedad.</p>
      <p className="text-xs text-[var(--fg-subtle)] mt-3">La revisión del radiólogo sigue siendo necesaria.</p>
    </section>
  )
}

export function MultipleFindingsCard({ prediction }: { prediction: Prediction }) {
  const positive = prediction.positive_findings ?? []
  if (!positive.length) return <NoFindingCard />
  const secondary = positive.filter(cls => cls !== prediction.predicted_class)
  return (
    <div className="space-y-3">
      <h3 className="section-heading">{positive.length === 1 ? 'Hallazgo sobre umbral' : `${positive.length} hallazgos sobre umbral`}</h3>
      <FindingCard prediction={prediction} />
      {secondary.length > 0 && <p className="text-sm text-[var(--fg-muted)] pt-2">Hallazgos adicionales</p>}
      {secondary.map(cls => <FindingCard key={cls} compact prediction={{ ...prediction, predicted_class: cls }} />)}
    </div>
  )
}
