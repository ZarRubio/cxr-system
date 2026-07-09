'use client'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Loader2, Stethoscope, CheckCircle2, XCircle, Activity } from 'lucide-react'
import { fetchAnalyses } from '@/lib/api'
import { filterAnalyses, type AnalysisRecord } from '@/lib/data/analysis'
import { BADGES, SEVERITY_LABELS } from '@/lib/constants'
import { formatTimestamp } from '@/lib/utils'
import type { Severity } from '@/lib/types'

/**
 * Panel de estadísticas del servicio (solo administración / jefe de servicio).
 * Todo se deriva del historial clínico persistente. Colores de barras
 * validados (CVD + contraste) sobre las superficies claras y oscuras del
 * design system; cada barra lleva etiqueta y conteo visibles.
 */

// Paleta de severidad para barras — validada; el "moderate" usa un teal más
// cromático que el petrol de UI para no leer como gris entre las demás.
const SEV_BAR: Record<Severity, string> = {
  critical: '#DC2626',
  high:     '#D97706',
  moderate: '#0891B2',
  normal:   '#16A34A',
}
const SINGLE_HUE = '#0891B2'

function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function StatsPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => fetchAnalyses(),
    refetchOnWindowFocus: false,
  })

  const all = useMemo(() => data?.analyses ?? [], [data])
  const records = useMemo(
    () => filterAnalyses(all, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [all, dateFrom, dateTo],
  )

  const stats = useMemo(() => computeStats(records), [records])

  const setPreset = (days: number | null) => {
    if (days === null) { setDateFrom(''); setDateTo('') }
    else { setDateFrom(daysAgo(days - 1)); setDateTo(daysAgo(0)) }
  }

  if (isLoading) {
    return (
      <div className="text-center py-16 text-[var(--fg-subtle)]">
        <Loader2 size={28} className="mx-auto mb-3 animate-spin opacity-40" />
        <p className="text-sm">Cargando estadísticas…</p>
      </div>
    )
  }
  if (isError) {
    return <p className="text-sm text-[#DC2626] py-16 text-center">No se pudieron cargar las estadísticas.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)] flex items-center gap-2">
          <TrendingUp size={22} className="text-[var(--primary)]" />
          Estadísticas del servicio
        </h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Volumen, hallazgos y concordancia clínica del sistema de apoyo diagnóstico
        </p>
      </div>

      {/* Filtros — una fila encima de los gráficos */}
      <div className="flex flex-wrap items-center gap-2">
        {([['7 días', 7], ['30 días', 30], ['Todo', null]] as const).map(([label, days]) => {
          const active = days === null ? !dateFrom && !dateTo : dateFrom === daysAgo(days - 1) && dateTo === daysAgo(0)
          return (
            <button
              key={label}
              onClick={() => setPreset(days)}
              className={`h-8 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                active
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                  : 'border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg)]'
              }`}
            >
              {label}
            </button>
          )
        })}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <label className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          Desde
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
          Hasta
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        </label>
      </div>

      {records.length === 0 ? (
        <div className="text-center py-16 text-[var(--fg-subtle)]">
          <Activity size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">Sin análisis en el rango seleccionado.</p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Análisis totales" value={String(stats.total)} sub={`${stats.last7} en los últimos 7 días`} />
            <StatTile label="Radiólogos activos" value={String(stats.radiologists.length)} sub="con al menos un análisis" />
            <StatTile label="Estudios validados" value={`${stats.validatedPct}%`} sub={`${stats.validated} de ${stats.total}`} />
            <StatTile
              label="Concordancia clínica"
              value={stats.validated > 0 ? `${stats.concordancePct}%` : '—'}
              sub={stats.validated > 0 ? `${stats.agrees} concuerdan · ${stats.disagrees} discrepan` : 'sin validaciones aún'}
              highlight
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Volumen diario — columnas, un solo matiz */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Volumen diario — últimos 14 días</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Análisis por día (todos los radiólogos)</p>
              <DailyColumns days={stats.daily} />
            </div>

            {/* Severidad — barras de estado, etiqueta + conteo siempre visibles */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Distribución por severidad</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Según el hallazgo principal del modelo</p>
              <div className="space-y-2 mt-4">
                {(Object.keys(SEVERITY_LABELS) as Severity[]).map((sev) => (
                  <HBar
                    key={sev}
                    label={SEVERITY_LABELS[sev]}
                    value={stats.bySeverity[sev] ?? 0}
                    max={stats.maxSeverity}
                    color={SEV_BAR[sev]}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top hallazgos — un solo matiz (magnitud) */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Hallazgos más frecuentes</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Top 6 por hallazgo principal</p>
              <div className="space-y-2 mt-4">
                {stats.topFindings.map(([cls, n]) => (
                  <HBar key={cls} label={BADGES[cls] ?? cls} value={n} max={stats.topFindings[0][1]} color={SINGLE_HUE} />
                ))}
              </div>
            </div>

            {/* Por radiólogo — tabla */}
            <div className="card p-4 overflow-x-auto">
              <h2 className="tech-label mb-3">Actividad por radiólogo</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="tech-label text-left py-2">Radiólogo</th>
                    <th className="tech-label text-right py-2">Análisis</th>
                    <th className="tech-label text-right py-2">Validados</th>
                    <th className="tech-label text-right py-2">Concordancia</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.radiologists.map((r) => (
                    <tr key={r.name} className="border-b border-[var(--border-subtle)] last:border-0">
                      <td className="py-2 text-[var(--fg)] font-medium truncate max-w-[160px]">{r.name}</td>
                      <td className="readout py-2 text-right">{r.total}</td>
                      <td className="readout py-2 text-right">{r.validated}</td>
                      <td className="readout py-2 text-right font-bold">
                        {r.validated > 0 ? `${Math.round((r.agrees / r.validated) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Discrepancias recientes */}
          <div className="card p-4">
            <h2 className="tech-label mb-3 flex items-center gap-2">
              <Stethoscope size={13} /> Discrepancias recientes
            </h2>
            {stats.recentDisagreements.length === 0 ? (
              <p className="text-xs text-[var(--fg-subtle)]">Sin discrepancias registradas en el rango.</p>
            ) : (
              <ul className="space-y-2">
                {stats.recentDisagreements.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="readout text-[var(--fg-subtle)]">{formatTimestamp(a.createdAt)}</span>
                    <span className="text-[var(--fg-muted)]">{a.userName}:</span>
                    <span className="inline-flex items-center gap-1 text-[#991B1B] dark:text-[#FCA5A5]">
                      <XCircle size={11} /> modelo: <strong>{BADGES[a.predictedClass] ?? a.predictedClass}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1 text-[#166534] dark:text-[#86EFAC]">
                      <CheckCircle2 size={11} /> radiólogo: <strong>{BADGES[a.feedback?.actualFinding ?? ''] ?? a.feedback?.actualFinding}</strong>
                    </span>
                    {a.feedback?.comment && <span className="italic text-[var(--fg-subtle)]">&ldquo;{a.feedback.comment}&rdquo;</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-[var(--fg-subtle)] italic">
            Derivado de los últimos {all.length} análisis registrados. La concordancia se calcula solo sobre
            estudios validados por su autor.
          </p>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface Stats {
  total: number
  last7: number
  validated: number
  validatedPct: number
  agrees: number
  disagrees: number
  concordancePct: number
  bySeverity: Partial<Record<Severity, number>>
  maxSeverity: number
  topFindings: Array<[string, number]>
  daily: Array<{ date: string; label: string; count: number }>
  radiologists: Array<{ name: string; total: number; validated: number; agrees: number }>
  recentDisagreements: AnalysisRecord[]
}

function computeStats(records: AnalysisRecord[]): Stats {
  const total = records.length
  const cut7 = daysAgo(6)
  const last7 = records.filter((r) => localDate(r.createdAt) >= cut7).length

  const withFb = records.filter((r) => r.feedback)
  const agrees = withFb.filter((r) => r.feedback!.agrees).length
  const disagrees = withFb.length - agrees

  const bySeverity: Partial<Record<Severity, number>> = {}
  const byFinding: Record<string, number> = {}
  const byUser: Record<string, { total: number; validated: number; agrees: number }> = {}

  for (const r of records) {
    bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1
    byFinding[r.predictedClass] = (byFinding[r.predictedClass] ?? 0) + 1
    byUser[r.userName] ??= { total: 0, validated: 0, agrees: 0 }
    byUser[r.userName].total++
    if (r.feedback) {
      byUser[r.userName].validated++
      if (r.feedback.agrees) byUser[r.userName].agrees++
    }
  }

  const daily: Stats['daily'] = []
  for (let i = 13; i >= 0; i--) {
    const date = daysAgo(i)
    const d = new Date()
    d.setDate(d.getDate() - i)
    daily.push({
      date,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      count: records.filter((r) => localDate(r.createdAt) === date).length,
    })
  }

  return {
    total,
    last7,
    validated: withFb.length,
    validatedPct: total > 0 ? Math.round((withFb.length / total) * 100) : 0,
    agrees,
    disagrees,
    concordancePct: withFb.length > 0 ? Math.round((agrees / withFb.length) * 100) : 0,
    bySeverity,
    maxSeverity: Math.max(1, ...Object.values(bySeverity)),
    topFindings: Object.entries(byFinding).sort((a, b) => b[1] - a[1]).slice(0, 6),
    daily,
    radiologists: Object.entries(byUser)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total),
    recentDisagreements: records.filter((r) => r.feedback && !r.feedback.agrees).slice(0, 5),
  }
}

// ---------------------------------------------------------------------------

function StatTile({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="card p-4">
      <p className="tech-label">{label}</p>
      <p
        className="readout text-3xl font-extrabold mt-1"
        style={{ color: highlight ? 'var(--primary)' : 'var(--fg)' }}
      >
        {value}
      </p>
      <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">{sub}</p>
    </div>
  )
}

/** Barra horizontal fina con extremo redondeado, etiqueta y conteo visibles. */
function HBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="flex items-center gap-3" title={`${label}: ${value}`}>
      <span className="w-[130px] shrink-0 text-xs font-semibold text-[var(--fg-muted)] truncate">{label}</span>
      <div className="flex-1 h-[14px] rounded-r bg-[var(--surface2)] overflow-hidden">
        {value > 0 && (
          <div
            className="h-full rounded-r"
            style={{ width: `${Math.max(pct, 2)}%`, background: color }}
            role="img"
            aria-label={`${label}: ${value}`}
          />
        )}
      </div>
      <span className="readout w-8 text-right text-xs font-bold text-[var(--fg)]">{value}</span>
    </div>
  )
}

/** Columnas diarias, un solo matiz; solo el pico lleva etiqueta (tooltip en el resto). */
function DailyColumns({ days }: { days: Stats['daily'] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  return (
    <div>
      <div className="flex items-end gap-[3px] h-28" role="img" aria-label="Análisis por día, últimos 14 días">
        {days.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full" title={`${d.label}: ${d.count}`}>
            {d.count === max && d.count > 0 && (
              <span className="readout text-[10px] font-bold text-[var(--fg)] mb-0.5">{d.count}</span>
            )}
            <div
              className="w-full max-w-[26px] rounded-t"
              style={{ height: `${(d.count / max) * 100}%`, background: SINGLE_HUE, minHeight: d.count > 0 ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1 border-t border-[var(--border-subtle)] pt-1">
        {days.map((d, i) => (
          <span key={d.date} className="readout flex-1 text-center text-[9px] text-[var(--fg-subtle)]">
            {i % 2 === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}
