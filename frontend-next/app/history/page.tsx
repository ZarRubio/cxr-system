'use client'
import { useState } from 'react'
import { useSessionStore } from '@/store/session'
import { formatTimestamp, formatConfidence, downloadBlob } from '@/lib/utils'
import { SEVERITY_COLORS, BADGES, SEVERITY_LABELS } from '@/lib/constants'
import { getSeverity } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ClipboardList, Download, Trash2, ChevronDown, ChevronUp, Search, FileText } from 'lucide-react'
import { ProbabilityBars } from '@/components/analyze/ProbabilityBars'
import { FindingCard } from '@/components/analyze/FindingCard'
import { GradCamView } from '@/components/analyze/GradCamView'
import type { HistoryEntry } from '@/lib/types'
import { cn } from '@/lib/utils'
import { buildPdf } from '@/lib/pdf'
import type { StudyMeta } from '@/lib/pdf'

export default function HistoryPage() {
  const { history, clearHistory } = useSessionStore()
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [filter, setFilter]       = useState('')

  const filtered = history.filter((h) =>
    !filter ||
    h.predicted.toLowerCase().includes(filter.toLowerCase()) ||
    h.filename.toLowerCase().includes(filter.toLowerCase()) ||
    (h.studyMeta?.studyId ?? '').toLowerCase().includes(filter.toLowerCase()),
  )

  const exportCSV = () => {
    const rows = [
      ['study_id', 'timestamp', 'filename', 'predicted', 'confidence', 'severity', 'image_hash'],
      ...history.map((h) => [h.studyMeta?.studyId ?? '', h.timestamp, h.filename, h.predicted, h.confidence.toFixed(4), h.severity, h.imageHash ?? '']),
    ]
    const csv = rows.map((r) => r.join(',')).join('\n')
    downloadBlob(csv, 'cxr_historial.csv', 'text/csv')
  }

  const exportJSON = () => {
    const data = history.map(({ fileBytes: _fb, prediction: _p, ...h }) => h)
    downloadBlob(JSON.stringify(data, null, 2), 'cxr_historial.json', 'application/json')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)]">Historial de análisis</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">Análisis realizados en esta sesión</p>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-3 text-[var(--fg-subtle)] opacity-30" />
          <p className="text-sm text-[var(--fg-subtle)]">Aún no hay análisis en esta sesión.</p>
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
                placeholder="Filtrar por ID estudio, hallazgo o archivo…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[#0891B2]"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download size={13} /> CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportJSON}>
              <Download size={13} /> JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={clearHistory} className="text-[#DC2626] hover:bg-[#FEE2E2]">
              <Trash2 size={13} /> Limpiar
            </Button>
          </div>

          <p className="text-xs text-[var(--fg-subtle)]">{filtered.length} análisis</p>

          {/* Table - desktop */}
          <div className="hidden sm:block card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface2)]">
                  <th className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">Fecha</th>
                  <th className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">Estudio</th>
                  <th className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">Hallazgo</th>
                  <th className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">Severidad</th>
                  <th className="text-right text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">Confianza</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    expanded={expanded === entry.id}
                    onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards - mobile */}
          <div className="sm:hidden space-y-3">
            {filtered.map((entry) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                expanded={expanded === entry.id}
                onToggle={() => setExpanded(expanded === entry.id ? null : entry.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function HistoryRow({ entry, expanded, onToggle }: { entry: HistoryEntry; expanded: boolean; onToggle: () => void }) {
  const sv = getSeverity(entry.predicted)
  const c  = SEVERITY_COLORS[sv]
  return (
    <>
      <tr
        className={cn(
          'border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors cursor-pointer',
          expanded && 'bg-[var(--surface2)]',
        )}
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-xs text-[var(--fg-muted)] whitespace-nowrap">{formatTimestamp(entry.timestamp)}</td>
        <td className="px-4 py-3 max-w-[200px]">
          <div className="text-xs font-bold font-mono text-[#0891B2] truncate">
            {entry.studyMeta?.studyId ?? '—'}
          </div>
          <div className="text-[10px] text-[var(--fg-subtle)] truncate mt-0.5">{entry.filename}</div>
        </td>
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
            style={{ background: c.bar, color: '#fff' }}
          >
            {BADGES[entry.predicted] ?? entry.predicted}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
            style={{ background: c.bg, color: c.text, borderColor: c.border }}
          >
            {SEVERITY_LABELS[sv]}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-bold tabular-nums text-sm" style={{ color: c.bar }}>
          {formatConfidence(entry.confidence)}
        </td>
        <td className="px-4 py-3 text-[var(--fg-subtle)]">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6} className="px-4 py-4 bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
            <HistoryDetail entry={entry} />
          </td>
        </tr>
      )}
    </>
  )
}

function HistoryCard({ entry, expanded, onToggle }: { entry: HistoryEntry; expanded: boolean; onToggle: () => void }) {
  const sv = getSeverity(entry.predicted)
  const c  = SEVERITY_COLORS[sv]
  return (
    <div className="card overflow-hidden">
      <button className="w-full p-4 flex items-center gap-3 cursor-pointer text-left" onClick={onToggle}>
        <span
          className="shrink-0 inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
          style={{ background: c.bar, color: '#fff' }}
        >
          {BADGES[entry.predicted] ?? entry.predicted}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold font-mono text-[#0891B2] truncate">
            {entry.studyMeta?.studyId ?? entry.filename}
          </div>
          <div className="text-[10px] text-[var(--fg-subtle)] truncate">{formatTimestamp(entry.timestamp)}</div>
        </div>
        <span className="text-sm font-extrabold tabular-nums" style={{ color: c.bar }}>
          {formatConfidence(entry.confidence)}
        </span>
        {expanded ? <ChevronUp size={14} className="text-[var(--fg-subtle)]" /> : <ChevronDown size={14} className="text-[var(--fg-subtle)]" />}
      </button>
      {expanded && (
        <div className="border-t border-[var(--border-subtle)] p-4">
          <HistoryDetail entry={entry} />
        </div>
      )}
    </div>
  )
}

function HistoryDetail({ entry }: { entry: HistoryEntry }) {
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDownloadPdf = async () => {
    if (!entry.fileBytes) return
    setPdfLoading(true)
    try {
      const meta: StudyMeta = entry.studyMeta ?? {
        studyId:            `EST-${entry.timestamp.slice(0, 10).replace(/-/g, '')}-HST`,
        projection:         'PA',
        clinicalIndication: '',
      }
      const bytes = await buildPdf(entry.filename, entry.fileBytes, entry.prediction, '', meta)
      downloadBlob(bytes, `${meta.studyId}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* PDF download bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs text-[var(--fg-subtle)]">
          <FileText size={13} />
          {entry.studyMeta?.studyId
            ? <span>Estudio <span className="font-mono font-bold text-[var(--fg)]">{entry.studyMeta.studyId}</span></span>
            : <span className="italic">Sin ID de estudio</span>
          }
          {entry.studyMeta?.radiologistName && (
            <span className="ml-2">· Dr. {entry.studyMeta.radiologistName}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleDownloadPdf}
          loading={pdfLoading}
          disabled={!entry.fileBytes || pdfLoading}
          title={!entry.fileBytes ? 'Imagen no disponible para generar PDF' : 'Descargar reporte PDF'}
        >
          <Download size={13} />
          {pdfLoading ? 'Generando…' : 'Reporte PDF'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-4">
          <FindingCard prediction={entry.prediction} />
          <ProbabilityBars prediction={entry.prediction} />
        </div>
        {entry.prediction.gradcam_image && entry.fileBytes && (
          <GradCamView prediction={entry.prediction} originalBytes={entry.fileBytes} />
        )}
      </div>
    </div>
  )
}
