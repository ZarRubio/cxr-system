'use client'
import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Link from 'next/link'
import {
  Layers, Upload, X, AlertCircle, FileImage, ClipboardList,
  AlertTriangle, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { predictBatch, type BatchResultItem } from '@/lib/api'
import { triageRank } from '@/lib/data/analysis'
import { SEVERITY_MAP, SEVERITY_COLORS, SEVERITY_LABELS, BADGES } from '@/lib/constants'
import { formatConfidence, cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'

const MAX_FILES = 8
const MAX_BYTES = 15 * 1024 * 1024
const ACCEPTED = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'application/octet-stream': ['.dcm'] }

interface QueuedFile {
  bytes: Uint8Array
  name: string
}

/**
 * Análisis por lote con triage: hasta 8 placas en una pasada, resultados
 * ordenados por severidad (críticos primero) para priorizar la lectura.
 * Cada análisis queda registrado en el historial.
 */
export default function BatchPage() {
  const [queue, setQueue]       = useState<QueuedFile[]>([])
  const [results, setResults]   = useState<BatchResultItem[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setError(null)
    accepted.forEach((file) => {
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" supera el límite de 15 MB y fue omitida.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const bytes = new Uint8Array(e.target!.result as ArrayBuffer)
        setQueue((q) => {
          if (q.length >= MAX_FILES) return q
          if (q.some((f) => f.name === file.name)) return q
          return [...q, { bytes, name: file.name }]
        })
      }
      reader.readAsArrayBuffer(file)
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    multiple: true,
    maxFiles: MAX_FILES,
  })

  const handleAnalyze = async () => {
    if (queue.length === 0) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await predictBatch(queue)
      setResults(res.results)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAnalyzing(false)
    }
  }

  const reset = () => {
    setQueue([])
    setResults(null)
    setError(null)
  }

  // Triage: severidad más grave primero, luego confianza descendente;
  // los archivos con error quedan al final.
  const triaged = useMemo(() => {
    if (!results) return []
    return [...results].sort((a, b) => {
      if (!a.result && !b.result) return 0
      if (!a.result) return 1
      if (!b.result) return -1
      const sa = SEVERITY_MAP[a.result.predicted_class] ?? 'normal'
      const sb = SEVERITY_MAP[b.result.predicted_class] ?? 'normal'
      return triageRank(sa, a.result.confidence) - triageRank(sb, b.result.confidence)
    })
  }, [results])

  const criticalCount = triaged.filter(
    (r) => r.result && (SEVERITY_MAP[r.result.predicted_class] ?? 'normal') === 'critical',
  ).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)] flex items-center gap-2">
          <Layers size={22} className="text-[var(--primary)]" />
          Análisis por lote — Triage
        </h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Hasta {MAX_FILES} placas por pasada. Los resultados se ordenan por severidad para priorizar la lectura.
        </p>
      </div>

      {!results && (
        <>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            aria-label="Zona de carga: arrastra hasta 8 radiografías o haz clic para seleccionar"
            className={cn(
              'card flex flex-col items-center justify-center gap-3 py-10 px-6 cursor-pointer transition-all duration-150',
              'border-2 border-dashed hover:border-[var(--primary)] hover:bg-[#F0FDFA]',
              isDragActive && 'border-[var(--primary)] bg-[#E0F7FA] scale-[1.01]',
              'dark:hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]',
            )}
          >
            <input {...getInputProps()} aria-label="Cargar radiografías de tórax" />
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              isDragActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted,#E8F1F6)] text-[var(--primary)]',
            )}>
              <Upload size={22} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--fg)]">
                {isDragActive ? 'Suelta las imágenes aquí' : 'Arrastra varias radiografías o haz clic'}
              </p>
              <p className="text-xs text-[var(--fg-subtle)] mt-1">
                PNG · JPG · DICOM (.dcm) · Máx. {MAX_FILES} archivos · 15 MB c/u
              </p>
            </div>
          </div>

          {/* Cola de archivos */}
          {queue.length > 0 && (
            <div className="card p-4 space-y-3">
              <p className="tech-label">{queue.length} / {MAX_FILES} placas en cola</p>
              <ul className="space-y-1.5">
                {queue.map((f) => (
                  <li key={f.name} className="flex items-center gap-2 text-sm text-[var(--fg)]">
                    <FileImage size={14} className="text-[var(--primary)] shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <button
                      onClick={() => setQueue((q) => q.filter((x) => x.name !== f.name))}
                      className="text-[var(--fg-subtle)] hover:text-[var(--fg)] p-1 cursor-pointer"
                      aria-label={`Quitar ${f.name}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
              <Button onClick={handleAnalyze} disabled={analyzing} loading={analyzing} size="lg" className="w-full">
                <Layers size={16} />
                {analyzing ? `Analizando ${queue.length} placas…` : `Analizar lote (${queue.length})`}
              </Button>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-[#FEE2E2] dark:bg-[#450A0A] border border-[#FCA5A5] px-4 py-3">
          <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
          <p className="text-sm text-[#991B1B] dark:text-[#FCA5A5]">{error}</p>
        </div>
      )}

      {/* Resultados triados */}
      {results && (
        <>
          {criticalCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-[#FEE2E2] dark:bg-[#450A0A] border border-[#FCA5A5] px-4 py-3">
              <AlertTriangle size={18} className="text-[#DC2626] shrink-0" />
              <p className="text-sm font-bold text-[#991B1B] dark:text-[#FCA5A5]">
                {criticalCount} {criticalCount === 1 ? 'placa con hallazgo crítico' : 'placas con hallazgos críticos'} — priorizar lectura inmediata
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--fg-subtle)]">
              <span className="readout">{triaged.length}</span> placas · orden de triage (mayor severidad primero)
            </p>
            <div className="flex gap-2">
              <Link href="/history">
                <Button variant="secondary" size="sm">
                  <ClipboardList size={13} /> Ver en historial
                </Button>
              </Link>
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw size={13} /> Nuevo lote
              </Button>
            </div>
          </div>

          <div className="card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface2)]">
                  <th className="tech-label text-left px-4 py-3 w-10">#</th>
                  <th className="tech-label text-left px-4 py-3">Archivo</th>
                  <th className="tech-label text-left px-4 py-3">Hallazgo</th>
                  <th className="tech-label text-left px-4 py-3">Severidad</th>
                  <th className="tech-label text-right px-4 py-3">Confianza</th>
                </tr>
              </thead>
              <tbody>
                {triaged.map((item, i) => (
                  <TriageRow key={item.filename + i} item={item} position={i + 1} />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-[var(--fg-subtle)] italic">
            Los análisis del lote quedaron registrados en el historial. El orden de triage es orientativo y no
            reemplaza el criterio del radiólogo.
          </p>
        </>
      )}

      {!results && queue.length === 0 && (
        <div className="text-center py-10 text-[var(--fg-subtle)]">
          <Layers size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm font-medium">Cargue un lote de radiografías para priorizar su lectura</p>
          <p className="text-xs mt-1 opacity-70">Los casos críticos (neumotórax, edema, masa…) aparecen primero</p>
        </div>
      )}
    </div>
  )
}

function TriageRow({ item, position }: { item: BatchResultItem; position: number }) {
  if (!item.result) {
    return (
      <tr className="border-b border-[var(--border-subtle)] opacity-60">
        <td className="readout px-4 py-3 text-xs">{position}</td>
        <td className="px-4 py-3 text-xs truncate max-w-[200px]">{item.filename}</td>
        <td className="px-4 py-3 text-xs text-[#DC2626]" colSpan={3}>
          <span className="inline-flex items-center gap-1.5"><AlertCircle size={12} /> {item.error ?? 'Error de análisis'}</span>
        </td>
      </tr>
    )
  }

  const severity: Severity = SEVERITY_MAP[item.result.predicted_class] ?? 'normal'
  const c = SEVERITY_COLORS[severity]

  return (
    <tr className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors">
      <td className="readout px-4 py-3 text-xs font-bold" style={{ color: c.bar }}>{position}</td>
      <td className="px-4 py-3 max-w-[220px]">
        <span className="text-xs text-[var(--fg)] truncate block">{item.filename}</span>
        {item.result.dicom_meta?.patient_age != null && (
          <span className="text-[10px] text-[var(--fg-subtle)]">
            {item.result.dicom_meta.patient_age} años{item.result.dicom_meta.patient_sex ? ` · ${item.result.dicom_meta.patient_sex}` : ''}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
          style={{ background: c.bar, color: '#fff' }}
        >
          {BADGES[item.result.predicted_class] ?? item.result.predicted_class}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold border"
          style={{ background: c.bg, color: c.text, borderColor: c.border }}
        >
          {SEVERITY_LABELS[severity]}
        </span>
      </td>
      <td className="readout px-4 py-3 text-right font-bold" style={{ color: c.bar }}>
        {formatConfidence(item.result.confidence)}
      </td>
    </tr>
  )
}
