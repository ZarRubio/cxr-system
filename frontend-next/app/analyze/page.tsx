'use client'
import { useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Microscope, Download, AlertCircle, FileText, FlaskConical, ClipboardList, Hash } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { UploadArea } from '@/components/analyze/UploadArea'
import { MultipleFindingsCard } from '@/components/analyze/FindingCard'
import { ClinicalRecommendations } from '@/components/analyze/ClinicalRecommendations'
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
import type { StudyMeta } from '@/lib/pdf'

function genStudyId() {
  const d = new Date()
  const date = d.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `EST-${date}-${rand}`
}

const INPUT_CLS = [
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)]',
  'text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
  'px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0891B2] transition-shadow',
].join(' ')

export default function AnalyzePage() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined

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
  const [studyMeta, setStudyMeta] = useState<StudyMeta>({
    studyId:            genStudyId(),
    projection:         'PA',
    clinicalIndication: '',
  })

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
    setStudyMeta((m) => ({ ...m, studyId: genStudyId() }))
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
      addEntry(filename, result, fileBytes, {
        ...studyMeta,
        radiologistName: String(user?.name ?? ''),
        radiologistCmp:  String(user?.cmp  ?? ''),
      })
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
      const meta: StudyMeta = {
        ...studyMeta,
        radiologistName: String(user?.name ?? ''),
        radiologistCmp:  String(user?.cmp  ?? ''),
      }
      const bytes = await buildPdf(filename, fileBytes, prediction, notes, meta)
      downloadBlob(bytes, `${studyMeta.studyId}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  const backendError = modelInfo?.error
  const thresholds   = modelInfo?.thresholds

  const setMeta = (k: keyof StudyMeta, v: string) =>
    setStudyMeta((m) => ({ ...m, [k]: v }))

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
            Asistente IA — Radiografía de tórax
          </h1>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Hospital Nacional Arzobispo Loayza · HNAL 2026 · Apoyo al diagnóstico, no reemplaza criterio clínico
          </p>
        </div>

        {/* Workflow steps */}
        {(() => {
          const activeStep = prediction ? 3 : fileBytes ? 2 : 1
          const steps = [
            { n: 1, label: 'Cargar imagen',      done: !!fileBytes },
            { n: 2, label: 'Analizar',            done: !!prediction },
            { n: 3, label: 'Revisar y reportar', done: false },
          ]
          return (
            <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
              {steps.map(({ n, label, done }, i) => (
                <div key={n} className="flex items-center gap-2 flex-1 last:flex-none">
                  <span
                    className="flex items-center gap-1.5 font-semibold shrink-0"
                    style={{ color: done || n === activeStep ? '#0891B2' : undefined }}
                  >
                    <span className={[
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                      done         ? 'bg-[#16A34A] text-white' :
                      n === activeStep ? 'bg-[#0891B2] text-white' :
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
          )
        })()}

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

          {!fileBytes && (
            <p className="text-xs text-center text-[var(--fg-subtle)]">
              <button
                onClick={handleLoadDemo}
                disabled={loadingDemo}
                className="text-[#0891B2] font-semibold hover:underline disabled:opacity-50 cursor-pointer"
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
              <div>
                <p className="text-sm font-semibold text-[#991B1B] dark:text-[#FCA5A5]">Error de análisis</p>
                <p className="text-xs text-[#7F1D1D] dark:text-[#FCA5A5] mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Study metadata — visible once file is loaded */}
        {fileBytes && (
          <div className="card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList size={13} className="text-[var(--fg-subtle)]" />
              <span className="text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider">
                Datos del estudio · para el reporte PDF
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Study ID */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--fg-subtle)]">ID de estudio</label>
                <div className="relative">
                  <Hash size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    value={studyMeta.studyId}
                    onChange={(e) => setMeta('studyId', e.target.value)}
                    className={INPUT_CLS + ' pl-7'}
                    placeholder="EST-20260626-001"
                  />
                </div>
                <p className="text-[10px] text-[var(--fg-subtle)]">Identificador anónimo — no incluye datos del paciente</p>
              </div>

              {/* Projection */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--fg-subtle)]">Proyección</label>
                <select
                  value={studyMeta.projection}
                  onChange={(e) => setMeta('projection', e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="PA">Posteroanterior (PA)</option>
                  <option value="AP">Anteroposterior (AP)</option>
                  <option value="Lateral">Lateral</option>
                  <option value="PA + Lateral">PA + Lateral</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              {/* Clinical indication */}
              <div className="col-span-2 space-y-1">
                <label className="text-[11px] font-semibold text-[var(--fg-subtle)]">Indicación clínica</label>
                <input
                  value={studyMeta.clinicalIndication}
                  onChange={(e) => setMeta('clinicalIndication', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Ej: Tos persistente 3 semanas, fiebre, pérdida de peso…"
                />
              </div>

              {/* Radiologist — read from session, not editable */}
              {!!(user?.name || user?.cmp) && (
                <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface2)] border border-[var(--border-subtle)]">
                  <span className="text-[11px] text-[var(--fg-subtle)]">Informante:</span>
                  <span className="text-[11px] font-semibold text-[var(--fg)]">{String(user?.name ?? '')}</span>
                  {!!user?.cmp && (
                    <span className="text-[11px] text-[var(--fg-subtle)]">· CMP {String(user.cmp)}</span>
                  )}
                  <span className="ml-auto text-[10px] text-[#0891B2]">desde tu sesión</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {prediction && !('error' in prediction) && (
          <div
            ref={resultsRef}
            className="space-y-5"
            style={{ animation: 'results-enter 400ms cubic-bezier(0.16,1,0.3,1) both' }}
          >
            {/* Nuevo análisis */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--fg-subtle)]">
                Análisis completado · {new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <button
                onClick={() => {
                  setFileBytes(null)
                  setFilename('')
                  setPrediction(null)
                  setNotes('')
                  setStudyMeta({ studyId: genStudyId(), projection: 'PA', clinicalIndication: '' })
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg)] hover:border-[#0891B2] hover:bg-[rgba(8,145,178,0.06)] transition-all cursor-pointer"
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
                originalBytes={fileBytes!}
                onPredictionUpdate={setPrediction}
              />
            </div>


            {/* Row 2: Notes + PDF */}
            <div className="card p-4 space-y-3">
              <label
                htmlFor="clinical-notes"
                className="flex items-center gap-2 text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider"
              >
                <FileText size={13} />
                Observaciones del radiólogo
              </label>
              <textarea
                id="clinical-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Correlación clínica, hallazgos adicionales, recomendaciones… (se incluirán como impresión diagnóstica en el PDF)"
                rows={3}
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0891B2] transition-shadow leading-relaxed"
              />
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
