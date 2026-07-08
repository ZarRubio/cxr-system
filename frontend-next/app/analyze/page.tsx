'use client'
import { useQuery } from '@tanstack/react-query'
import { Microscope, AlertCircle, FlaskConical, RotateCcw } from 'lucide-react'
import { UploadArea } from '@/components/analyze/UploadArea'
import { StudyMetaForm } from '@/components/analyze/StudyMetaForm'
import { ResultsSection } from '@/components/analyze/ResultsSection'
import { Button } from '@/components/ui/button'
import { SuccessToast } from '@/components/ui/toast'
import { AnalyzingOverlay } from '@/components/analyze/AnalyzingOverlay'
import { StatAlert } from '@/components/analyze/StatAlert'
import { fetchModelInfo } from '@/lib/api'
import { STAT_CLASSES } from '@/lib/constants'
import { useAnalyze } from '@/hooks/useAnalyze'

export default function AnalyzePage() {
  const {
    fileBytes, filename, prediction, analyzing, error,
    pdfLoading, notes, showToast, loadingDemo, statDismissed, studyMeta,
    user, resultsRef, canRetry,
    setNotes, setShowToast, setStatDismissed, setPrediction, setMeta,
    handleFile, clearFile, handleLoadDemo, handleAnalyze, handleDownloadPdf, reset,
  } = useAnalyze()

  const { data: modelInfo } = useQuery({
    queryKey: ['model-info'],
    queryFn: fetchModelInfo,
    retry: 2,
  })

  const backendError = modelInfo?.error
  const thresholds   = modelInfo?.thresholds
  const activeStep   = prediction ? 3 : fileBytes ? 2 : 1

  const steps = [
    { n: 1, label: 'Cargar imagen',      done: !!fileBytes },
    { n: 2, label: 'Analizar',            done: !!prediction },
    { n: 3, label: 'Revisar y reportar', done: false },
  ]

  return (
    <>
      {analyzing && <AnalyzingOverlay fileBytes={fileBytes ?? undefined} filename={filename} />}

      {/* Estado del análisis para lectores de pantalla */}
      <div aria-live="polite" className="sr-only">
        {analyzing ? 'Analizando radiografía…' : prediction ? 'Análisis completado' : ''}
      </div>

      {prediction && STAT_CLASSES.has(prediction.predicted_class) && !statDismissed && (
        <StatAlert
          predictedClass={prediction.predicted_class}
          confidence={prediction.confidence}
          onDismiss={() => setStatDismissed(true)}
        />
      )}

      {showToast && prediction && (
        <SuccessToast
          predicted={prediction.predicted_class}
          confidence={prediction.confidence}
          onClose={() => setShowToast(false)}
        />
      )}

      <div className="space-y-6">
        {/* Page title */}
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--fg)] leading-tight">
            Asistente IA — Radiografía de tórax
          </h1>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Hospital Nacional Arzobispo Loayza · HNAL 2026 · Apoyo al diagnóstico, no reemplaza criterio clínico
          </p>
        </div>

        {/* Workflow steps */}
        <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
          {steps.map(({ n, label, done }, i) => (
            <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
              <span
                className="flex items-center gap-1.5 font-semibold shrink-0"
                style={{ color: done || n === activeStep ? 'var(--primary)' : undefined }}
              >
                <span className={[
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  done         ? 'bg-[#16A34A] text-white' :
                  n === activeStep ? 'bg-[var(--primary)] text-white' :
                  'bg-[var(--border)] text-[var(--fg-subtle)]',
                ].join(' ')}>
                  {done ? '✓' : String(n)}
                </span>
                {label}
              </span>
              {i < steps.length - 1 && <span className="flex-1 h-px bg-[var(--border-subtle)]" />}
            </div>
          ))}
        </div>

        {/* Backend warning */}
        {backendError && (
          <div className="flex items-start gap-3 rounded-xl bg-[#FEF3C7] dark:bg-[#451A03] border border-[#FCD34D] px-4 py-3">
            <AlertCircle size={16} className="text-[#D97706] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#92400E] dark:text-[#FCD34D]">Backend no disponible</p>
              <p className="text-xs text-[#78350F] dark:text-[#92400E] mt-0.5">{backendError}</p>
            </div>
          </div>
        )}

        {/* Upload card */}
        <div className="card p-5 space-y-4">
          <UploadArea
            onFile={handleFile}
            currentFilename={fileBytes ? filename : undefined}
            onClear={clearFile}
          />

          {!fileBytes && (
            <p className="text-xs text-center text-[var(--fg-subtle)]">
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="text-[var(--primary)] font-semibold hover:underline disabled:opacity-50 cursor-pointer"
              >
                <FlaskConical size={11} className="inline mr-0.5 mb-0.5" />
                {loadingDemo ? 'Cargando caso de demostración...' : 'Cargar caso de demostración (cardiomegalia)'}
              </button>
            </p>
          )}

          {fileBytes && (
            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
              <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="w-full">
                <Microscope size={18} />
                Analizar radiografía
              </Button>
              {filename.startsWith('demo_') && (
                <p className="text-[11px] text-[var(--fg-subtle)] text-center">
                  Modo demo · imagen sintética representativa · no diagnóstica
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] dark:bg-[#450A0A] border border-[#FCA5A5] px-4 py-3">
              <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#991B1B] dark:text-[#FCA5A5]">Error de análisis</p>
                <p className="text-xs text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5">{error}</p>
              </div>
              {canRetry && (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#FCA5A5] text-[#991B1B] dark:text-[#FCA5A5] hover:bg-[#FEE2E2] dark:hover:bg-[#7F1D1D] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Study metadata — visible once file is loaded */}
        {fileBytes && (
          <StudyMetaForm
            studyMeta={studyMeta}
            onChange={setMeta}
            radiologistName={user?.name ? String(user.name) : undefined}
            radiologistCmp={user?.cmp ? String(user.cmp) : undefined}
          />
        )}

        {/* Results */}
        {prediction && !('error' in prediction) && (
          <ResultsSection
            prediction={prediction}
            fileBytes={fileBytes!}
            thresholds={thresholds}
            notes={notes}
            onNotesChange={setNotes}
            pdfLoading={pdfLoading}
            onDownloadPdf={handleDownloadPdf}
            onNewAnalysis={reset}
            onPredictionUpdate={setPrediction}
            resultsRef={resultsRef}
          />
        )}

        {/* Empty state */}
        {!fileBytes && !prediction && (
          <div className="text-center py-10 text-[var(--fg-subtle)]">
            <Microscope size={36} className="mx-auto mb-3 opacity-25" />
            <p className="text-sm font-medium">Cargue una radiografía de tórax PA o AP para iniciar el análisis</p>
            <p className="text-xs mt-1 opacity-70">Formatos aceptados: PNG · JPG · DICOM (.dcm) · Máx. 15 MB</p>
          </div>
        )}
      </div>
    </>
  )
}
