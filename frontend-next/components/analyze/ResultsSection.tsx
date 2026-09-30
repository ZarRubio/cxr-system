'use client'
import type { RefObject } from 'react'
import { Microscope, Download, FileText, ChevronRight } from 'lucide-react'
import { MultipleFindingsCard } from '@/components/analyze/FindingCard'
import { FeedbackCard } from '@/components/analyze/FeedbackCard'
import { ClinicalRecommendations } from '@/components/analyze/ClinicalRecommendations'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { GradCamView } from '@/components/analyze/GradCamView'
import { SecondaryFindings } from '@/components/analyze/SecondaryFindings'
import { CXRScreeningAlert } from '@/components/analyze/CXRScreeningAlert'
import { DecisionSupportAlert } from '@/components/analyze/DecisionSupportAlert'
import { Button } from '@/components/ui/button'
import { EmailAlertStatus } from '@/components/EmailAlertStatus'
import { StudySaveStatus } from '@/components/StudySaveStatus'
import type { Prediction } from '@/lib/types'

interface ResultsSectionProps {
  filename?: string
  notesSaving?: boolean
  notesDirty?: boolean
  notesError?: string | null
  onSaveNotes?: () => void
  prediction: Prediction
  fileBytes: Uint8Array
  thresholds?: Record<string, number>
  notes: string
  onNotesChange: (v: string) => void
  pdfLoading: boolean
  onDownloadPdf: () => void
  onNewAnalysis: () => void
  onPredictionUpdate: (p: Prediction) => void
  resultsRef: RefObject<HTMLDivElement | null>
}

/** Bloque completo de resultados del análisis (hallazgos, Grad-CAM, notas, PDF, detalle técnico). */
export function ResultsSection({
  prediction,
  fileBytes,
  thresholds,
  notes,
  onNotesChange,
  pdfLoading,
  onDownloadPdf,
  onNewAnalysis,
  onPredictionUpdate,
  resultsRef,
  filename, notesSaving, notesDirty, notesError, onSaveNotes,
}: ResultsSectionProps) {
  return (
    <div
      ref={resultsRef}
      className="space-y-5"
    >
      {/* Nuevo análisis */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-5">
        <h2 className="section-heading">Resultado del estudio</h2>
        <button
          onClick={onNewAnalysis}
          className="flex items-center gap-2 min-h-11 text-sm font-medium px-3 rounded-md border border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--surface2)] transition-colors cursor-pointer"
        >
          <Microscope size={13} />
          Nuevo análisis
        </button>
      </div>

      <StudySaveStatus prediction={prediction} />
      <EmailAlertStatus alert={prediction.email_alert} />
      <CXRScreeningAlert screening={prediction.cxr_screening} />
      <DecisionSupportAlert support={prediction.decision_support} />

      {/* Row 1: Finding + Grad-CAM */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-6 items-start">
        <div className="space-y-4">
          <MultipleFindingsCard prediction={prediction} />
          <details className="workspace-section">
            <summary className="text-sm font-medium cursor-pointer">Información orientativa del hallazgo</summary>
            <p className="text-xs text-[var(--fg-muted)] my-3">Contenido de referencia, no una indicación de tratamiento. Requiere validación clínica independiente.</p>
            <ClinicalRecommendations prediction={prediction} />
          </details>
        </div>
        <GradCamView
          prediction={prediction}
          originalBytes={fileBytes}
          filename={filename}
          onPredictionUpdate={onPredictionUpdate}
        />
      </div>

      {/* Row 2: Validación del radiólogo (solo si el análisis quedó persistido) */}
      {prediction.analysis_id && (
        <FeedbackCard
          analysisId={prediction.analysis_id}
          predictedClass={prediction.predicted_class}
          initialFeedback={prediction.feedback}
          onSaved={feedback => onPredictionUpdate({ ...prediction, feedback })}
        />
      )}

      {/* Row 3: Notes + PDF */}
      <div className="workspace-section space-y-3">
        <label
          htmlFor="clinical-notes"
          className="tech-label flex items-center gap-2"
        >
          <FileText size={13} />
          Observaciones del radiólogo
        </label>
        <textarea
          id="clinical-notes"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Observaciones e interpretación del radiólogo"
          rows={3}
          maxLength={5000}
          className="field-input resize-y min-h-28 placeholder:text-[var(--fg-subtle)] leading-relaxed"
        />
        {prediction.analysis_id && onSaveNotes ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={onSaveNotes} loading={notesSaving} disabled={!notesDirty || notesSaving}>Guardar observaciones</Button>
            <p role="status" className="text-xs text-[var(--fg-muted)]">{notesDirty ? 'Cambios sin guardar en el historial' : 'Observaciones guardadas en el historial'}</p>
          </div>
        ) : <p className="text-xs text-[var(--fg-muted)]">Las observaciones solo se incluirán en este PDF; el estudio no está guardado.</p>}
        {notesError && <p role="alert" className="text-sm badge-high p-3">{notesError}</p>}
        <Button
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
          loading={pdfLoading}
          onClick={onDownloadPdf}
        >
          <Download size={16} />
          {pdfLoading ? 'Generando PDF...' : 'Descargar reporte PDF'}
        </Button>
      </div>

      {/* Row 3: Technical detail — collapsible */}
      <details className="group">
        <summary className="flex items-center gap-2 min-h-11 cursor-pointer text-sm font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors list-none px-1 select-none">
          <ChevronRight size={18} className="shrink-0 group-open:rotate-90 transition-transform" aria-hidden="true" />
          Ver detalle técnico (scores por clase y hallazgos sub-umbral)
        </summary>
        <div className="mt-3 space-y-4">
          <SecondaryFindings prediction={prediction} thresholds={thresholds} />
          <div className="card p-4">
            <ProbabilityBars prediction={prediction} thresholds={thresholds} />
          </div>
        </div>
      </details>

      {prediction.disclaimer && (
        <p className="text-xs text-[var(--fg-subtle)] leading-5 px-1">
          {prediction.disclaimer}
        </p>
      )}
    </div>
  )
}
