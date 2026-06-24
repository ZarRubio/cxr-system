'use client'
import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Microscope, Download, AlertCircle, FileText, FlaskConical } from 'lucide-react'
import { UploadArea } from '@/components/analyze/UploadArea'
import { FindingCard, MultipleFindingsCard } from '@/components/analyze/FindingCard'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { GradCamView } from '@/components/analyze/GradCamView'
import { SecondaryFindings } from '@/components/analyze/SecondaryFindings'
import { Button } from '@/components/ui/button'
import { SuccessToast } from '@/components/ui/toast'
import { AnalyzingOverlay } from '@/components/analyze/AnalyzingOverlay'
import { StatAlert } from '@/components/analyze/StatAlert'
import { fetchModelInfo, predict } from '@/lib/api'
import { STAT_CLASSES } from '@/lib/constants'
import { useSessionStore } from '@/store/session'
import { buildPdf } from '@/lib/pdf'
import { downloadBlob } from '@/lib/utils'
import type { Prediction } from '@/lib/types'

export default function AnalyzePage() {
  const [fileBytes, setFileBytes]   = useState<Uint8Array | null>(null)
  const [filename, setFilename]     = useState<string>('')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [notes, setNotes]           = useState<string>('')
  const [showToast, setShowToast]   = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [statDismissed, setStatDismissed] = useState(false)

  const resultsRef = useRef<HTMLDivElement>(null)
  const addEntry   = useSessionStore((s) => s.addEntry)

  const { data: modelInfo } = useQuery({
    queryKey: ['model-info'],
    queryFn: fetchModelInfo,
    retry: 2,
  })

  const handleFile = useCallback((bytes: Uint8Array, name: string) => {
    setFileBytes(bytes)
    setFilename(name)
    setPrediction(null)
    setNotes('')
    setError(null)
  }, [])

  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    try {
      const res = await fetch('/demo/demo_cardiomegaly.png')
      if (!res.ok) throw new Error('Demo no disponible')
      const buf = await res.arrayBuffer()
      handleFile(new Uint8Array(buf), 'demo_cardiomegaly.png')
    } catch {
      setError('No se pudo cargar la imagen de ejemplo.')
    } finally {
      setLoadingDemo(false)
    }
  }

  const handleAnalyze = async () => {
    if (!fileBytes || !filename) return
    setAnalyzing(true)
    setError(null)
    try {
      const result = await predict(fileBytes, filename, 'gradcam', 1, true)
      setPrediction(result)
      setStatDismissed(false)
      addEntry(filename, result, fileBytes)
      setShowToast(true)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!prediction || !fileBytes) return
    setPdfLoading(true)
    try {
      const bytes = await buildPdf(filename, fileBytes, prediction, notes)
      downloadBlob(bytes, `${filename.replace(/\.[^.]+$/, '')}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  const backendError = modelInfo?.error
  const thresholds   = modelInfo?.thresholds

  return (
    <>
      {analyzing && <AnalyzingOverlay fileBytes={fileBytes ?? undefined} filename={filename} />}

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
            Análisis de radiografía de tórax
          </h1>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Hospital Nacional Arzobispo Loayza · HNAL 2026
          </p>
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
            onClear={() => { setFileBytes(null); setFilename(''); setPrediction(null) }}
          />

          {/* Demo link — only when no image loaded */}
          {!fileBytes && (
            <p className="text-xs text-center text-[var(--fg-subtle)]">
              ¿No tienes imagen a mano?{' '}
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="text-[#0891B2] font-semibold hover:underline disabled:opacity-50 cursor-pointer"
              >
                <FlaskConical size={11} className="inline mr-0.5 mb-0.5" />
                {loadingDemo ? 'Cargando...' : 'Probar con caso de ejemplo →'}
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
              <div>
                <p className="text-sm font-semibold text-[#991B1B] dark:text-[#FCA5A5]">Error de análisis</p>
                <p className="text-xs text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Results — scroll target + fade-in animation */}
        {prediction && !('error' in prediction) && (
          <div
            ref={resultsRef}
            className="grid grid-cols-1 lg:grid-cols-2 gap-5"
            style={{ animation: 'results-enter 400ms cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Left: findings */}
            <div className="space-y-4">
              <MultipleFindingsCard prediction={prediction} />
              <SecondaryFindings prediction={prediction} thresholds={thresholds} />

              <div className="card p-4">
                <ProbabilityBars prediction={prediction} thresholds={thresholds} />
              </div>

              {/* Clinical notes */}
              <div className="card p-4 space-y-2">
                <label
                  htmlFor="clinical-notes"
                  className="flex items-center gap-2 text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider"
                >
                  <FileText size={13} />
                  Notas clínicas del radiólogo
                </label>
                <textarea
                  id="clinical-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones adicionales, correlación clínica, recomendaciones… (opcional, se incluyen en el PDF)"
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0891B2] transition-shadow leading-relaxed"
                />
                <p className="text-[10px] text-[var(--fg-subtle)]">
                  Las notas se incluyen en el reporte PDF descargable.
                </p>
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                loading={pdfLoading}
                onClick={handleDownloadPdf}
              >
                <Download size={16} />
                {pdfLoading ? 'Generando PDF...' : 'Descargar reporte PDF'}
              </Button>

              {prediction.disclaimer && (
                <p className="text-[10px] text-[var(--fg-subtle)] italic leading-4 px-1">
                  {prediction.disclaimer}
                </p>
              )}
            </div>

            {/* Right: Grad-CAM */}
            <div>
              <GradCamView
                prediction={prediction}
                originalBytes={fileBytes!}
                onPredictionUpdate={setPrediction}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!fileBytes && !prediction && (
          <div className="text-center py-12 text-[var(--fg-subtle)]">
            <Microscope size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Carga una radiografía de tórax para comenzar el análisis</p>
          </div>
        )}
      </div>
    </>
  )
}
