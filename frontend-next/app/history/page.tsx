'use client'
import { Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { fetchAnalyses, fetchAllAnalyses, retryAnalysisEmail } from '@/lib/api'
import { filterAnalyses, nextEmailRetry, type AnalysisFilters, type AnalysisRecord, type FeedbackFilter } from '@/lib/data/analysis'
import { formatTimestamp, formatConfidence, downloadBlob, cn, csvCell } from '@/lib/utils'
import { SEVERITY_COLORS, BADGES, SEVERITY_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { buildPdf, type StudyMeta } from '@/lib/pdf'
import { ClipboardList, Download, ChevronDown, ChevronUp, Search, Check, X, Clock, Loader2, FileText, SlidersHorizontal, Calendar, RotateCcw } from 'lucide-react'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { FeedbackCard } from '@/components/analyze/FeedbackCard'
import { EmailAlertStatus } from '@/components/EmailAlertStatus'
import { DecisionSupportAlert } from '@/components/analyze/DecisionSupportAlert'
import type { Prediction, Severity } from '@/lib/types'

/**
 * Historial clínico persistente: los análisis se guardan en el servidor al
 * momento de predecir y sobreviven a la sesión del navegador. Cada radiólogo
 * ve los suyos; el administrador ve todos.
 */

/** Clase compartida de los selects de filtro; resalta cuando hay valor activo. */
const selectCls = (active: boolean) =>
  cn(
    'min-h-11 px-3 text-sm rounded-md border bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] cursor-pointer max-w-full',
    active ? 'border-[var(--primary)] text-[var(--primary)] font-semibold' : 'border-[var(--border)] text-[var(--fg)]',
  )
export default function HistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryContent />
    </Suspense>
  )
}

function HistoryContent() {
  const { data: session } = useSession()
  const sessionUserId = String((session?.user as Record<string, unknown>)?.id ?? '')

  // Búsqueda desde la URL (p.ej. /history?q=LOTE-20260709-042 desde /batch).
  // El router de Next puede reusar esta página ya montada al navegar, así que
  // no basta el estado inicial: se adopta el q de la URL cada vez que cambia
  // (patrón "adjust state during render").
  const searchParams = useSearchParams()
  const urlQ = searchParams.get('q') ?? ''

  const [expanded, setExpanded] = useState<string | null>(null)
  const [q, setQ]               = useState(urlQ)
  const [lastUrlQ, setLastUrlQ] = useState(urlQ)
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ)
    setQ(urlQ)
  }
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [feedback, setFeedback] = useState<FeedbackFilter | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [byUser, setByUser]     = useState('')
  const [cursor, setCursor] = useState<string | undefined>()
  const [pages, setPages] = useState<Array<string | undefined>>([])
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)
  const criteria = JSON.stringify([q, severity, feedback, dateFrom, dateTo, byUser])
  const [lastCriteria, setLastCriteria] = useState(criteria)
  if (criteria !== lastCriteria) { setLastCriteria(criteria); setCursor(undefined); setPages([]) }
  const serverFilters: AnalysisFilters = { q, severity: severity || undefined, feedback: feedback || undefined, dateFrom, dateTo, userName: byUser || undefined }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analyses', criteria, cursor],
    queryFn: () => fetchAnalyses(serverFilters, cursor),
    refetchOnWindowFocus: false,
  })

  const analyses = useMemo(() => data?.analyses ?? [], [data])
  const isAdmin  = data?.isAdmin ?? false
  const radiologists = useMemo(
    () => [...new Set(analyses.map((a) => a.userName))].sort((a, b) => a.localeCompare(b)),
    [analyses],
  )

  const filters: AnalysisFilters = {
    q: q || undefined,
    severity: severity || undefined,
    feedback: feedback || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    userName: (isAdmin && byUser) || undefined,
  }
  const filtered = useMemo(() => filterAnalyses(analyses, filters), [analyses, q, severity, feedback, dateFrom, dateTo, byUser, isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  const exportCSV = async () => {
    if (exporting) return
    setExporting('csv')
    setExportError('')
    try {
    const complete = (await fetchAllAnalyses(serverFilters)).analyses
    const rows = [
      ['study_id', 'lote', 'timestamp', 'radiologo', 'filename', 'predicted', 'confidence', 'severity', 'feedback', 'hallazgo_real', 'image_hash'],
      ...complete.map((a) => [
        a.studyId ?? '', a.batchId ?? '', a.createdAt, a.userName, a.filename, a.predictedClass,
        a.confidence.toFixed(4), a.severity,
        a.feedback ? (a.feedback.agrees ? 'concuerda' : 'discrepa') : 'pendiente',
        a.feedback?.actualFinding ?? '', a.imageHash ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n')
    downloadBlob(csv, 'cxr_historial.csv', 'text/csv')
    } catch (error) { setExportError((error as Error).message) }
    finally { setExporting(null) }
  }

  const exportJSON = async () => {
    if (exporting) return
    setExporting('json')
    setExportError('')
    try { downloadBlob(JSON.stringify((await fetchAllAnalyses(serverFilters)).analyses, null, 2), 'cxr_historial.json', 'application/json') }
    catch (error) { setExportError((error as Error).message) }
    finally { setExporting(null) }
  }

  return (
    <div className="space-y-6">
      <div className="page-heading">
        <h1 className="text-2xl font-extrabold text-[var(--fg)]">Historial de análisis</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          {isAdmin ? 'Análisis del servicio' : 'Sus análisis'} · Página {pages.length + 1}
        </p>
      </div>
      {exportError && <p role="alert" className="badge-high p-3 text-sm">{exportError}</p>}
      <nav aria-label="Páginas del historial" className="flex flex-wrap gap-3 items-center">
        <Button variant="secondary" size="lg" disabled={!pages.length || isLoading} onClick={() => { setCursor(pages.at(-1)); setPages(pages.slice(0, -1)) }}>Anterior</Button>
        <Button variant="secondary" size="lg" disabled={!data?.nextCursor || isLoading} onClick={() => { setPages([...pages, cursor]); setCursor(data?.nextCursor ?? undefined) }}>Siguiente</Button>
        <span className="text-xs text-[var(--fg-muted)]">{analyses.length} estudios en esta página</span>
      </nav>

        <>
          {/* Toolbar: búsqueda + export arriba, filtros compactos debajo */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-0 basis-full sm:basis-auto">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                <input
                  type="text"
                  aria-label="Buscar estudios"
                  placeholder="Buscar por estudio, lote, hallazgo, archivo…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="field-input pl-9 pr-12 placeholder:text-[var(--fg-subtle)]"
                />
                {q && (
                  <button
                    onClick={() => setQ('')}
                    aria-label="Limpiar búsqueda"
                    className="icon-button absolute right-0 top-1/2 -translate-y-1/2"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <Button variant="secondary" size="lg" disabled={!!exporting || isLoading || isError} loading={exporting === 'csv'} onClick={exportCSV}>
                <Download size={13} /> CSV
              </Button>
              <Button variant="secondary" size="lg" disabled={!!exporting || isLoading || isError} loading={exporting === 'json'} onClick={exportJSON}>
                <Download size={13} /> JSON
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <span className="tech-label flex items-center gap-1.5 mr-1">
                <SlidersHorizontal size={12} /> Filtros
              </span>

              {/* Rango de fechas agrupado */}
              <div className="flex items-center gap-1 min-h-11 max-w-full px-2 rounded-md border border-[var(--border)] bg-[var(--surface)]">
                <Calendar size={13} className="text-[var(--fg-subtle)] shrink-0" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="Desde fecha"
                  className="bg-transparent text-xs text-[var(--fg)] focus:outline-none w-[108px] cursor-pointer"
                />
                <span className="text-[var(--fg-subtle)] text-xs">—</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  aria-label="Hasta fecha"
                  className="bg-transparent text-xs text-[var(--fg)] focus:outline-none w-[108px] cursor-pointer"
                />
              </div>

              {isAdmin && radiologists.length > 1 && (
                <select
                  value={byUser}
                  onChange={(e) => setByUser(e.target.value)}
                  aria-label="Filtrar por radiólogo"
                  className={selectCls(!!byUser)}
                >
                  <option value="">Radiólogo: todos</option>
                  {radiologists.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity | '')}
                aria-label="Filtrar por severidad"
                className={selectCls(!!severity)}
              >
                <option value="">Prioridad IA: todas</option>
                {(Object.keys(SEVERITY_LABELS) as Severity[]).map((s) => (
                  <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
                ))}
              </select>
              <select
                value={feedback}
                onChange={(e) => setFeedback(e.target.value as FeedbackFilter | '')}
                aria-label="Filtrar por validación"
                className={selectCls(!!feedback)}
              >
                <option value="">Validación: todas</option>
                <option value="pending">Pendiente</option>
                <option value="agree">Concuerda</option>
                <option value="disagree">Discrepa</option>
              </select>

              {(q || severity || feedback || dateFrom || dateTo || byUser) && (
                <button
                  onClick={() => { setQ(''); setSeverity(''); setFeedback(''); setDateFrom(''); setDateTo(''); setByUser('') }}
                  className="min-h-11 px-2 text-sm text-[var(--primary)] hover:underline cursor-pointer"
                >
                  Limpiar
                </button>
              )}

              <span className="ml-auto text-xs text-[var(--fg-subtle)]">
                <span className="readout font-bold text-[var(--fg)]">{filtered.length}</span>
                {filtered.length === analyses.length ? ' análisis' : ` de ${analyses.length} análisis`}
              </span>
            </div>
          </div>

          {isLoading ? (
            <div role="status" className="text-center py-12 text-[var(--fg-muted)]"><Loader2 size={24} className="mx-auto mb-3 animate-spin" aria-hidden="true" /><p>Cargando estudios…</p></div>
          ) : isError ? (
            <div role="alert" className="badge-critical rounded-md p-5 space-y-3"><p>No se pudo cargar el historial.</p><Button variant="secondary" onClick={() => refetch()}><RotateCcw size={16} />Reintentar</Button></div>
          ) : filtered.length === 0 ? (
            <div role="status" className="border-y border-[var(--border-subtle)] py-12 text-center space-y-3">
              <ClipboardList size={28} className="mx-auto text-[var(--fg-muted)]" aria-hidden="true" />
              <h2 className="section-heading">{q || severity || feedback || dateFrom || dateTo || byUser ? 'Sin resultados para estos filtros' : 'Aún no hay estudios registrados'}</h2>
              {q || severity || feedback || dateFrom || dateTo || byUser ? <p className="text-sm text-[var(--fg-muted)]">Cambie los filtros o límpielos para volver a consultar.</p> : <Link href="/analyze" className="access-link">Nuevo estudio</Link>}
              {data?.nextCursor && <p className="text-sm text-[var(--fg-muted)]">Hay más registros por consultar. Continúe en la siguiente página.</p>}
            </div>
          ) : <>

          {/* Table - desktop */}
          <div className="hidden md:block border-y border-[var(--border-subtle)] overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface2)]">
                  <th className="tech-label text-left px-4 py-3">Fecha</th>
                  <th className="tech-label text-left px-4 py-3">Estudio</th>
                  {isAdmin && <th className="tech-label text-left px-4 py-3">Radiólogo</th>}
                  <th className="tech-label text-left px-4 py-3">Hallazgo</th>
                  <th className="tech-label text-left px-4 py-3">Prioridad IA</th>
                  <th className="tech-label text-left px-4 py-3">Validación</th>
                  <th className="tech-label text-right px-4 py-3">Score IA</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <HistoryRow
                    key={a.id}
                    analysis={a}
                    isAdmin={isAdmin}
                    canValidate={a.userId === sessionUserId}
                    expanded={expanded === a.id}
                    onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                    onBatchClick={(id) => setQ(id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards - mobile */}
          <div className="md:hidden space-y-3">
            {filtered.map((a) => (
              <HistoryCard
                key={a.id}
                analysis={a}
                isAdmin={isAdmin}
                canValidate={a.userId === sessionUserId}
                expanded={expanded === a.id}
                onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
              />
            ))}
          </div>
          </>}
        </>
    </div>
  )
}

function FeedbackChip({ analysis }: { analysis: AnalysisRecord }) {
  if (!analysis.feedback) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border border-[var(--border)] text-[var(--fg-subtle)]">
        <Clock size={9} /> Pendiente
      </span>
    )
  }
  if (analysis.feedback.agrees) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]">
        <Check size={9} /> Concuerda
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
      <X size={9} /> Discrepa
    </span>
  )
}

interface RowProps {
  analysis: AnalysisRecord
  isAdmin?: boolean
  canValidate: boolean
  expanded: boolean
  onToggle: () => void
  onBatchClick?: (batchId: string) => void
}

/** Chip del lote: clic filtra el historial por ese lote. */
function BatchChip({ batchId, onClick }: { batchId: string; onClick?: (id: string) => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(batchId) }}
      title={`Filtrar por ${batchId}`}
      className="readout inline-flex items-center rounded px-1.5 py-px text-[9px] font-bold border border-[var(--primary)] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] cursor-pointer"
    >
      {batchId}
    </button>
  )
}

function HistoryRow({ analysis, isAdmin, canValidate, expanded, onToggle, onBatchClick }: RowProps) {
  const c = SEVERITY_COLORS[analysis.severity]
  return (
    <>
      <tr
        className={cn(
          'border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors cursor-pointer',
          expanded && 'bg-[var(--surface2)]',
        )}
        onClick={onToggle}
      >
        <td className="readout px-4 py-3 text-xs text-[var(--fg-muted)] whitespace-nowrap">{formatTimestamp(analysis.createdAt)}</td>
        <td className="px-4 py-3 max-w-[200px]">
          <div className="readout text-xs font-bold text-[var(--primary)] truncate">
            {analysis.studyId ?? '—'}
          </div>
          <div className="text-[10px] text-[var(--fg-subtle)] truncate mt-0.5">{analysis.filename}</div>
          {analysis.batchId && (
            <div className="mt-1"><BatchChip batchId={analysis.batchId} onClick={onBatchClick} /></div>
          )}
        </td>
        {isAdmin && (
          <td className="px-4 py-3 text-xs text-[var(--fg-muted)] max-w-[140px] truncate">{analysis.userName}</td>
        )}
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
            style={{ background: c.bar, color: '#fff' }}
          >
            {BADGES[analysis.predictedClass] ?? analysis.predictedClass}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
            style={{ background: c.bg, color: c.text, borderColor: c.border }}
          >
            {SEVERITY_LABELS[analysis.severity]}
          </span>
        </td>
        <td className="px-4 py-3"><FeedbackChip analysis={analysis} /></td>
        <td className="readout px-4 py-3 text-right font-bold text-sm" style={{ color: c.bar }}>
          {formatConfidence(analysis.confidence)}
        </td>
        <td className="px-4 py-3 text-[var(--fg-subtle)]">
          <button type="button" className="icon-button" aria-expanded={expanded} aria-label={`${expanded ? 'Cerrar' : 'Abrir'} estudio ${analysis.studyId ?? analysis.filename}`} onClick={event => { event.stopPropagation(); onToggle() }}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-4 bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
            <HistoryDetail analysis={analysis} canValidate={canValidate} isAdmin={Boolean(isAdmin)} />
          </td>
        </tr>
      )}
    </>
  )
}

function HistoryCard({ analysis, isAdmin, canValidate, expanded, onToggle }: RowProps) {
  return (
    <div className="card overflow-hidden">
      <button className="w-full p-4 flex flex-wrap items-center gap-3 cursor-pointer text-left" onClick={onToggle} aria-expanded={expanded}>
        <span
          className={`badge-${analysis.severity} inline-flex items-center rounded px-2 py-1 text-xs font-medium`}
        >
          {BADGES[analysis.predictedClass] ?? analysis.predictedClass}
        </span>
        <div className="order-first basis-full min-w-0">
          <div className="readout text-sm font-medium text-[var(--primary)] break-all">
            {analysis.studyId ?? analysis.filename}
          </div>
          <div className="text-xs text-[var(--fg-subtle)] mt-1">{formatTimestamp(analysis.createdAt)}</div>
        </div>
        <FeedbackChip analysis={analysis} />
        {expanded ? <ChevronUp size={14} className="text-[var(--fg-subtle)]" /> : <ChevronDown size={14} className="text-[var(--fg-subtle)]" />}
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <HistoryDetail analysis={analysis} canValidate={canValidate} isAdmin={Boolean(isAdmin)} />
        </div>
      )}
    </div>
  )
}

function HistoryDetail({ analysis, canValidate, isAdmin }: { analysis: AnalysisRecord; canValidate: boolean; isAdmin: boolean }) {
  const queryClient = useQueryClient()
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<'admin' | 'radiologist' | null>(null)
  const [retryError, setRetryError] = useState<string | null>(null)

  const retryEmail = async (role: 'admin' | 'radiologist') => {
    if (!window.confirm('El envío anterior pudo haber llegado aunque figure como fallido. ¿Reintentar?')) return
    setRetrying(role)
    setRetryError(null)
    try {
      await retryAnalysisEmail(analysis.id, role)
      await queryClient.invalidateQueries({ queryKey: ['analyses'] })
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'No se pudo reintentar el envío.')
    } finally { setRetrying(null) }
  }

  // Pseudo-predicción para reutilizar los componentes de resultados.
  // El historial no guarda imágenes ni Grad-CAM (privacidad): solo scores.
  const prediction: Prediction = {
    analysis_id: analysis.id,
    persistence: { status: 'saved' },
    predicted_class: analysis.predictedClass,
    confidence: analysis.confidence,
    probabilities: analysis.probabilities,
    positive_findings: analysis.positiveFindings,
    processing_time_ms: analysis.processingTimeMs ?? 0,
    image_hash: analysis.imageHash ?? undefined,
    model_version: analysis.modelVersion ?? undefined,
    thresholds_used: analysis.thresholdsUsed,
    decision_support: analysis.decisionSupport ?? undefined,
    image_warnings: analysis.imageWarnings ?? [],
    cxr_screening: analysis.cxrScreening ?? undefined,
  }

  const handleDownloadPdf = async () => {
    if (pdfLoading) return
    setPdfLoading(true)
    setPdfError(null)
    try {
      const meta: StudyMeta = {
        analyzedAt: analysis.createdAt,
        studyId:            analysis.studyId ?? analysis.dicomStudyHash ?? '',
        projection:         analysis.projection ?? '',
        clinicalIndication: analysis.clinicalIndication ?? '',
        radiologistName:    analysis.userName,
        patientAge:         analysis.patientAge,
        patientSex:         analysis.patientSex,
      }
      const bytes = await buildPdf(analysis.filename, null, prediction, analysis.notes ?? '', meta, analysis.feedback)
      downloadBlob(bytes, `${meta.studyId || analysis.id.slice(0, 8)}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : 'No se pudo generar el PDF. Intente nuevamente.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <EmailAlertStatus alert={analysis.emailAlert} />
      {analysis.emailAlert && (
        <div>
        <p className="text-xs text-[var(--fg-muted)] mb-2">Reintento manual: un envío sin confirmación podría haber llegado. Verifique antes de reenviar.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          {(['admin', 'radiologist'] as const).map(role => {
            if (role === 'admin' && !isAdmin) return null
            if (role === 'radiologist' && !isAdmin && !canValidate) return null
            const delivery = analysis.emailAlert?.[role]
            if (!delivery || !nextEmailRetry(analysis.emailAlert!, role, new Date())) return null
            return <Button key={role} variant="secondary" size="sm" disabled={!!retrying} loading={retrying === role} onClick={() => retryEmail(role)}>
              <RotateCcw size={13} /> Reintentar correo al {role === 'admin' ? 'administrador' : 'radiólogo'}
            </Button>
          })}
        </div>
        </div>
      )}
      {retryError && <p role="alert" className="text-xs badge-high p-2">{retryError}</p>}
      {pdfError && <p role="alert" className="text-sm badge-high p-3">{pdfError}</p>}
      <DecisionSupportAlert support={prediction.decision_support} />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[var(--fg-subtle)] pb-3 border-b border-[var(--border-subtle)]">
        {analysis.studyId && (
          <span>Estudio <span className="readout font-bold text-[var(--fg)]">{analysis.studyId}</span></span>
        )}
        {analysis.batchId && (
          <span>Lote <span className="readout font-bold text-[var(--primary)]">{analysis.batchId}</span></span>
        )}
        <span>Dr(a). {analysis.userName}</span>
        {analysis.patientAge != null && <span>Edad: {analysis.patientAge} años</span>}
        {analysis.patientSex && <span>Sexo: {analysis.patientSex}</span>}
        {analysis.projection && <span>Proyección: {analysis.projection}</span>}
        {analysis.clinicalIndication && <span>Indicación: {analysis.clinicalIndication}</span>}
        {analysis.modelVersion && <span>Modelo: <span className="readout">{analysis.modelVersion}</span></span>}
        {analysis.imageHash && <span>Hash: <span className="readout">{analysis.imageHash.slice(0, 12)}…</span></span>}
        <span className="ml-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadPdf}
            loading={pdfLoading}
            title="Reporte regenerado desde el historial (sin imágenes: no se almacenan)"
          >
            <FileText size={13} />
            {pdfLoading ? 'Generando…' : 'Reporte PDF'}
          </Button>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-4">
          <ProbabilityBars prediction={prediction} />
        </div>
        <div className="space-y-4">
          {analysis.notes && <section className="space-y-2"><h3 className="tech-label">Observaciones del radiólogo</h3><p className="text-sm text-[var(--fg)] whitespace-pre-wrap break-words">{analysis.notes}</p></section>}
          {canValidate ? (
            <FeedbackCard
              analysisId={analysis.id}
              predictedClass={analysis.predictedClass}
              initialFeedback={analysis.feedback}
              onSaved={() => queryClient.invalidateQueries({ queryKey: ['analyses'] })}
            />
          ) : analysis.feedback ? (
            <div className="card p-4 space-y-2">
              <p className="tech-label">Validación del radiólogo</p>
              <FeedbackChip analysis={analysis} />
              {analysis.feedback.actualFinding && (
                <p className="text-xs text-[var(--fg-muted)]">
                  Hallazgo real: <strong>{BADGES[analysis.feedback.actualFinding] ?? analysis.feedback.actualFinding}</strong>
                </p>
              )}
              {analysis.feedback.comment && (
                <p className="text-xs text-[var(--fg-subtle)] italic">&ldquo;{analysis.feedback.comment}&rdquo;</p>
              )}
            </div>
          ) : (
            <div className="card p-4">
              <p className="tech-label">Validación del radiólogo</p>
              <p className="text-xs text-[var(--fg-subtle)] mt-2">Pendiente de validación por su autor.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
