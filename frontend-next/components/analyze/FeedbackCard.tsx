'use client'
import { useState } from 'react'
import { Check, X, Pencil, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BADGES } from '@/lib/constants'
import { submitFeedback } from '@/lib/api'
import type { AnalysisFeedback } from '@/lib/data/analysis'

interface FeedbackCardProps {
  analysisId: string
  /** Hallazgo principal del modelo, para el texto de la pregunta */
  predictedClass: string
  /** Feedback ya registrado (al reabrir desde el historial) */
  initialFeedback?: AnalysisFeedback | null
  onSaved?: (feedback: AnalysisFeedback) => void
}

const FINDING_OPTIONS = [...Object.keys(BADGES), 'Otro']

/**
 * Validación del radiólogo: concordancia con el hallazgo del modelo o
 * discrepancia con el hallazgo real. Alimenta la métrica de concordancia
 * clínica del sistema.
 */
export function FeedbackCard({ analysisId, predictedClass, initialFeedback, onSaved }: FeedbackCardProps) {
  const [feedback, setFeedback]   = useState<AnalysisFeedback | null>(initialFeedback ?? null)
  const [editing, setEditing]     = useState(false)
  const [disagreeing, setDisagreeing] = useState(false)
  const [finding, setFinding]     = useState('')
  const [otherText, setOtherText] = useState('')
  const [comment, setComment]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const save = async (payload: { agrees: boolean; actualFinding?: string; comment?: string }) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await submitFeedback(analysisId, payload)
      setFeedback(updated.feedback)
      setEditing(false)
      setDisagreeing(false)
      if (updated.feedback) onSaved?.(updated.feedback)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la validación.')
    } finally {
      setSaving(false)
    }
  }

  const handleDisagreeSave = () => {
    const actual = finding === 'Otro' ? otherText.trim() : finding
    if (!actual) {
      setError('Indique el hallazgo real para registrar la discrepancia.')
      return
    }
    save({ agrees: false, actualFinding: actual, comment: comment.trim() || undefined })
  }

  // Estado registrado (y no editando): chip de resultado + botón corregir
  if (feedback && !editing) {
    return (
      <div className="card p-4 space-y-2">
        <p className="tech-label flex items-center gap-2">
          <Stethoscope size={13} /> Validación del radiólogo
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {feedback.agrees ? (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
              <Check size={12} /> Concordancia registrada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
              <X size={12} /> Discrepancia — hallazgo real: {BADGES[feedback.actualFinding ?? ''] ?? feedback.actualFinding}
            </span>
          )}
          <button
            onClick={() => {
              setEditing(true)
              setDisagreeing(!feedback.agrees)
              setFinding(feedback.actualFinding && BADGES[feedback.actualFinding] ? feedback.actualFinding : feedback.actualFinding ? 'Otro' : '')
              setOtherText(feedback.actualFinding && !BADGES[feedback.actualFinding] ? feedback.actualFinding : '')
              setComment(feedback.comment ?? '')
            }}
            className="flex items-center gap-1 text-xs text-[var(--fg-subtle)] hover:text-[var(--fg)] cursor-pointer"
          >
            <Pencil size={11} /> Corregir
          </button>
        </div>
        {feedback.comment && (
          <p className="text-xs text-[var(--fg-subtle)] italic">&ldquo;{feedback.comment}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-3">
      <p className="tech-label flex items-center gap-2">
        <Stethoscope size={13} /> Validación del radiólogo
      </p>
      <p className="text-sm text-[var(--fg)]">
        ¿Concuerda con el hallazgo principal del modelo (
        <strong>{BADGES[predictedClass] ?? predictedClass}</strong>)?
      </p>

      {!disagreeing ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => save({ agrees: true })} disabled={saving} loading={saving}>
            <Check size={13} /> Concuerdo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setDisagreeing(true); setError(null) }} disabled={saving}>
            <X size={13} /> No concuerdo
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="fb-finding" className="text-xs font-semibold text-[var(--fg-muted)] block mb-1">
              Hallazgo real según su lectura
            </label>
            <select
              id="fb-finding"
              value={finding}
              onChange={(e) => setFinding(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Seleccionar hallazgo…</option>
              {FINDING_OPTIONS.map((k) => (
                <option key={k} value={k}>{BADGES[k] ?? k}</option>
              ))}
            </select>
          </div>
          {finding === 'Otro' && (
            <input
              type="text"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Describa el hallazgo…"
              maxLength={120}
              className="w-full h-9 px-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          )}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Comentario opcional (contexto clínico, calidad de imagen…)"
            maxLength={500}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] resize-y"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDisagreeSave} disabled={saving} loading={saving}>
              Guardar discrepancia
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDisagreeing(false); setError(null) }} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      <p className="text-[10px] text-[var(--fg-subtle)]">
        Su validación queda registrada en el historial y alimenta la métrica de concordancia del sistema.
      </p>
    </div>
  )
}
