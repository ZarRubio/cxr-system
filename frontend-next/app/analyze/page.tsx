'use client'
import { useQuery } from '@tanstack/react-query'
import { Microscope, AlertCircle, FlaskConical, RotateCcw } from 'lucide-react'
import { UploadArea } from '@/components/analyze/UploadArea'
import { StudyMetaForm } from '@/components/analyze/StudyMetaForm'
import { ResultsSection } from '@/components/analyze/ResultsSection'
import { EmailAlertStatus } from '@/components/EmailAlertStatus'
import { Button } from '@/components/ui/button'
import { SuccessToast } from '@/components/ui/toast'
import { AnalyzingOverlay } from '@/components/analyze/AnalyzingOverlay'
import { StatAlert } from '@/components/analyze/StatAlert'
import { fetchModelInfo } from '@/lib/api'
import { criticalFindings } from '@/lib/data/analysis'
import { useAnalyze } from '@/hooks/useAnalyze'

export default function AnalyzePage() {
  const {
    fileBytes, filename, prediction, analyzing, error,
    pdfLoading, notes, showToast, loadingDemo, statDismissed, studyMeta,
    user, resultsRef, canRetry,
    setNotes, setShowToast, setStatDismissed, setPrediction, setMeta,
    handleFile, clearFile, handleLoadDemo, handleAnalyze, handleDownloadPdf, reset,
  } = useAnalyze()

  const { data: modelInfo, isError: modelInfoError } = useQuery({
    queryKey: ['model-info'],
    queryFn: fetchModelInfo,
    retry: 2,
  })

  const backendError = modelInfo?.error ?? (modelInfoError ? 'No se pudo consultar el modelo. Verifique la conexión antes de iniciar un estudio.' : undefined)
  const thresholds   = modelInfo?.thresholds
  const activeStep   = prediction ? 3 : fileBytes ? 2 : 1
  const priorityFinding = prediction ? criticalFindings({ positiveFindings: prediction.positive_findings }).sort((a, b) => (prediction.probabilities[b] ?? 0) - (prediction.probabilities[a] ?? 0))[0] : undefined

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

      {prediction && priorityFinding && !statDismissed && (
        <StatAlert
          predictedClass={priorityFinding}
          confidence={prediction.probabilities[priorityFinding] ?? prediction.confidence}
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
        <div className="page-heading">
          <h1 className="text-2xl font-extrabold text-[var(--fg)] leading-tight">
            Nuevo estudio
          </h1>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Radiografía de tórax · Análisis asistido para revisión del radiólogo
          </p>
        </div>

        {/* Workflow steps */}
        <ol aria-label="Estado del estudio" className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-[var(--fg-subtle)]">
          {steps.map(({ n, label, done }, i) => (
            <li key={n} aria-current={n === activeStep ? 'step' : undefined} className="flex items-center gap-2">
              <span
                className="flex items-center gap-1.5 font-semibold shrink-0"
                style={{ color: done || n === activeStep ? 'var(--primary)' : undefined }}
              >
                <span className={[
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                  done         ? 'bg-[#16A34A] text-white' :
                  n === activeStep ? 'bg-[var(--action)] text-white' :
                  'bg-[var(--border)] text-[var(--fg-subtle)]',
                ].join(' ')}>
                  {done ? '✓' : String(n)}
                </span>
                {label}
              </span>
              {i < steps.length - 1 && <span className="flex-1 h-px bg-[var(--border-subtle)]" />}
            </li>
          ))}
        </ol>

        {/* Backend warning */}
        {backendError && (
          <div className="flex items-start gap-3 rounded-xl bg-[#FEF3C7] dark:bg-[#451A03] border border-[#FCD34D] px-4 py-3">
            <AlertCircle size={16} className="text-[#D97706] mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#92400E] dark:text-[#FCD34D]">Backend no disponible</p>
              <p className="text-xs text-[#78350F] dark:text-[#FCD34D] mt-0.5">{backendError}</p>
            </div>
          </div>
        )}

        {/* Upload card */}
        <section className="space-y-4" aria-label="Imagen del estudio">
          <UploadArea
            disabled={analyzing}
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
                {loadingDemo ? 'Cargando muestra...' : 'Usar imagen sintética de demostración'}
              </button>
            </p>
          )}

          {fileBytes && (
            <div className="border-t border-[var(--border-subtle)] pt-4 space-y-2">
              <Button onClick={handleAnalyze} disabled={analyzing} size="lg" className="w-full sm:w-auto">
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
        </section>

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
        <EmailAlertStatus alert={prediction?.email_alert} />
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
          <div className="border-t border-[var(--border-subtle)] pt-5 text-[var(--fg-subtle)]">
            <p className="text-xs">Uso académico. Los scores y mapas de activación no sustituyen la lectura de la radiografía original.</p>
          </div>
        )}
      </div>
    </>
  )
}
