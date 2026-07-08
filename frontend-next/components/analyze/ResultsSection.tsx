'use client'
import type { RefObject } from 'react'
import { Microscope, Download, FileText } from 'lucide-react'
import { MultipleFindingsCard } from '@/components/analyze/FindingCard'
import { FeedbackCard } from '@/components/analyze/FeedbackCard'
import { ClinicalRecommendations } from '@/components/analyze/ClinicalRecommendations'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { GradCamView } from '@/components/analyze/GradCamView'
import { SecondaryFindings } from '@/components/analyze/SecondaryFindings'
import { Button } from '@/components/ui/button'
import type { Prediction } from '@/lib/types'

interface ResultsSectionProps {
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
}: ResultsSectionProps) {
  return (
    <div
      ref={resultsRef}
      className="space-y-5"
      style={{ animation: 'results-enter 400ms cubic-bezier(0.16,1,0.3,1) both' }}
    >
      {/* Nuevo análisis */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--fg-subtle)]">
          Análisis completado ·{' '}
          <span className="readout">
            {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
        <button
          onClick={onNewAnalysis}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:border-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_6%,transparent)] transition-all cursor-pointer"
        >
          <Microscope size={13} />
          Nuevo análisis
        </button>
      </div>

      {/* Row 1: Finding + Grad-CAM */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <MultipleFindingsCard prediction={prediction} />
          <ClinicalRecommendations prediction={prediction} />
        </div>
        <GradCamView
          prediction={prediction}
          originalBytes={fileBytes}
          onPredictionUpdate={onPredictionUpdate}
        />
      </div>

      {/* Row 2: Validación del radiólogo (solo si el análisis quedó persistido) */}
      {prediction.analysis_id && (
        <FeedbackCard
          analysisId={prediction.analysis_id}
          predictedClass={prediction.predicted_class}
        />
      )}

      {/* Row 3: Notes + PDF */}
      <div className="card p-4 space-y-3">
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
          placeholder="Correlación clínica, hallazgos adicionales, recomendaciones… (se incluirán como impresión diagnóstica en el PDF)"
          rows={3}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow leading-relaxed"
        />
        <Button
          variant="secondary"
          size="lg"
          className="w-full"
          loading={pdfLoading}
          onClick={onDownloadPdf}
        >
          <Download size={16} />
          {pdfLoading ? 'Generando PDF...' : 'Descargar reporte PDF'}
        </Button>
      </div>

      {/* Row 3: Technical detail — collapsible */}
      <details className="group">
        <summary className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors list-none px-1 py-1 select-none">
          <span className="w-4 h-4 rounded border border-[var(--border)] flex items-center justify-center text-[10px] group-open:rotate-90 transition-transform">▶</span>
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
        <p className="text-[10px] text-[var(--fg-subtle)] italic leading-4 px-1">
          {prediction.disclaimer}
        </p>
      )}
    </div>
  )
}
