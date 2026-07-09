'use client'
import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSession } from 'next-auth/react'
import { fetchAnalyses } from '@/lib/api'
import { filterAnalyses, type AnalysisFilters, type AnalysisRecord, type FeedbackFilter } from '@/lib/data/analysis'
import { formatTimestamp, formatConfidence, downloadBlob, cn } from '@/lib/utils'
import { SEVERITY_COLORS, BADGES, SEVERITY_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { buildPdf, type StudyMeta } from '@/lib/pdf'
import { ClipboardList, Download, ChevronDown, ChevronUp, Search, Check, X, Clock, Loader2, FileText } from 'lucide-react'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { FeedbackCard } from '@/components/analyze/FeedbackCard'
import type { Prediction, Severity } from '@/lib/types'

/**
 * Historial clínico persistente: los análisis se guardan en el servidor al
 * momento de predecir y sobreviven a la sesión del navegador. Cada radiólogo
 * ve los suyos; el administrador ve todos.
 */
export default function HistoryPage() {
  const { data: session } = useSession()
  const sessionUserId = String((session?.user as Record<string, unknown>)?.id ?? '')

  const [expanded, setExpanded] = useState<string | null>(null)
  const [q, setQ]               = useState('')
  const [severity, setSeverity] = useState<Severity | ''>('')
  const [feedback, setFeedback] = useState<FeedbackFilter | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [byUser, setByUser]     = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => fetchAnalyses(),
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

  const exportCSV = () => {
    const rows = [
      ['study_id', 'timestamp', 'radiologo', 'filename', 'predicted', 'confidence', 'severity', 'feedback', 'hallazgo_real', 'image_hash'],
      ...filtered.map((a) => [
        a.studyId ?? '', a.createdAt, a.userName, a.filename, a.predictedClass,
        a.confidence.toFixed(4), a.severity,
        a.feedback ? (a.feedback.agrees ? 'concuerda' : 'discrepa') : 'pendiente',
        a.feedback?.actualFinding ?? '', a.imageHash ?? '',
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n')
    downloadBlob(csv, 'cxr_historial.csv', 'text/csv')
  }

  const exportJSON = () => {
    downloadBlob(JSON.stringify(filtered, null, 2), 'cxr_historial.json', 'application/json')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)]">Historial de análisis</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          {isAdmin ? 'Todos los análisis del servicio (vista administrador)' : 'Sus análisis, persistentes entre sesiones'}
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-[var(--fg-subtle)]">
          <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm">Cargando historial…</p>
        </div>
      ) : isError ? (
        <div className="text-center py-16">
          <p className="text-sm text-[#DC2626]">No se pudo cargar el historial. Intente nuevamente.</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-3 text-[var(--fg-subtle)] opacity-30" />
          <p className="text-sm text-[var(--fg-subtle)]">Aún no hay análisis registrados.</p>
          <p className="text-xs text-[var(--fg-subtle)] mt-1">Ve a <strong>Analizar</strong> para comenzar.</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
              <input
                type="text"
                placeholder="Buscar por ID estudio, hallazgo, archivo…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
              Desde
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Filtrar desde fecha"
                className="h-9 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
              Hasta
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Filtrar hasta fecha"
                className="h-9 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
              />
            </label>
            {isAdmin && radiologists.length > 1 && (
              <select
                value={byUser}
                onChange={(e) => setByUser(e.target.value)}
                aria-label="Filtrar por radiólogo"
                className="h-9 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)] max-w-[190px]"
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
              className="h-9 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Severidad: todas</option>
              {(Object.keys(SEVERITY_LABELS) as Severity[]).map((s) => (
                <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={feedback}
              onChange={(e) => setFeedback(e.target.value as FeedbackFilter | '')}
              aria-label="Filtrar por validación"
              className="h-9 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            >
              <option value="">Validación: todas</option>
              <option value="pending">Pendiente</option>
              <option value="agree">Concuerda</option>
              <option value="disagree">Discrepa</option>
            </select>
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJSON}>
              <Download size={13} /> JSON
            </Button>
          </div>

          <p className="text-xs text-[var(--fg-subtle)]">
            <span className="readout">{filtered.length}</span> análisis
            {analyses.length >= 500 && ' (mostrando los 500 más recientes)'}
          </p>

          {/* Table - desktop */}
          <div className="hidden sm:block card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface2)]">
                  <th className="tech-label text-left px-4 py-3">Fecha</th>
                  <th className="tech-label text-left px-4 py-3">Estudio</th>
                  {isAdmin && <th className="tech-label text-left px-4 py-3">Radiólogo</th>}
                  <th className="tech-label text-left px-4 py-3">Hallazgo</th>
                  <th className="tech-label text-left px-4 py-3">Severidad</th>
                  <th className="tech-label text-left px-4 py-3">Validación</th>
                  <th className="tech-label text-right px-4 py-3">Confianza</th>
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
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards - mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map((a) => (
              <HistoryCard
                key={a.id}
                analysis={a}
                canValidate={a.userId === sessionUserId}
                expanded={expanded === a.id}
                onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
              />
            ))}
          </div>
        </>
      )}
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
}

function HistoryRow({ analysis, isAdmin, canValidate, expanded, onToggle }: RowProps) {
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
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={isAdmin ? 8 : 7} className="px-4 py-4 bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
            <HistoryDetail analysis={analysis} canValidate={canValidate} />
          </td>
        </tr>
      )}
    </>
  )
}

function HistoryCard({ analysis, canValidate, expanded, onToggle }: RowProps) {
  const c = SEVERITY_COLORS[analysis.severity]
  return (
    <div className="card overflow-hidden">
      <button className="w-full p-4 flex items-center gap-3 cursor-pointer text-left" onClick={onToggle}>
        <span
          className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
          style={{ background: c.bar, color: '#fff' }}
        >
          {BADGES[analysis.predictedClass] ?? analysis.predictedClass}
        </span>
        <div className="flex-1 min-w-0">
          <div className="readout text-xs font-bold text-[var(--primary)] truncate">
            {analysis.studyId ?? analysis.filename}
          </div>
          <div className="readout text-[10px] text-[var(--fg-subtle)] truncate">{formatTimestamp(analysis.createdAt)}</div>
        </div>
        <FeedbackChip analysis={analysis} />
        {expanded ? <ChevronUp size={14} className="text-[var(--fg-subtle)]" /> : <ChevronDown size={14} className="text-[var(--fg-subtle)]" />}
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <HistoryDetail analysis={analysis} canValidate={canValidate} />
        </div>
      )}
    </div>
  )
}

function HistoryDetail({ analysis, canValidate }: { analysis: AnalysisRecord; canValidate: boolean }) {
  const queryClient = useQueryClient()
  const [pdfLoading, setPdfLoading] = useState(false)

  // Pseudo-predicción para reutilizar los componentes de resultados.
  // El historial no guarda imágenes ni Grad-CAM (privacidad): solo scores.
  const prediction: Prediction = {
    predicted_class: analysis.predictedClass,
    confidence: analysis.confidence,
    probabilities: analysis.probabilities,
    positive_findings: analysis.positiveFindings,
    processing_time_ms: analysis.processingTimeMs ?? 0,
    image_hash: analysis.imageHash ?? undefined,
    model_version: analysis.modelVersion ?? undefined,
  }

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      const meta: StudyMeta = {
        studyId:            analysis.studyId ?? analysis.dicomStudyHash ?? '',
        projection:         analysis.projection ?? '',
        clinicalIndication: analysis.clinicalIndication ?? '',
        radiologistName:    analysis.userName,
        patientAge:         analysis.patientAge,
        patientSex:         analysis.patientSex,
      }
      const bytes = await buildPdf(analysis.filename, null, prediction, '', meta, analysis.feedback)
      downloadBlob(bytes, `${meta.studyId || analysis.id.slice(0, 8)}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-[var(--fg-subtle)] pb-3 border-b border-[var(--border-subtle)]">
        {analysis.studyId && (
          <span>Estudio <span className="readout font-bold text-[var(--fg)]">{analysis.studyId}</span></span>
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
