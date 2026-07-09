'use client'
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, Loader2, Stethoscope, CheckCircle2, XCircle, Activity, X } from 'lucide-react'
import { fetchAnalyses } from '@/lib/api'
import { filterAnalyses, type AnalysisRecord } from '@/lib/data/analysis'
import { BADGES, SEVERITY_LABELS } from '@/lib/constants'
import { formatTimestamp, cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'

/**
 * Dashboard interactivo del servicio (solo administración).
 * - Filtros cruzados: clic en una barra de severidad, hallazgo o fila de
 *   radiólogo filtra todo el panel; clic de nuevo (o en el chip) lo quita.
 * - Hover: tooltip por marca en barras; crosshair con lectura por día en la
 *   curva de volumen. Todo valor es accesible también sin hover (etiquetas
 *   directas o vista de tabla).
 * Paleta de barras validada (CVD + contraste) sobre ambas superficies.
 */

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
  // Filtros cruzados (clic en las marcas)
  const [selSeverity, setSelSeverity] = useState<Severity | null>(null)
  const [selFinding, setSelFinding]   = useState<string | null>(null)
  const [selUser, setSelUser]         = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => fetchAnalyses(),
    refetchOnWindowFocus: false,
  })

  const all = useMemo(() => data?.analyses ?? [], [data])

  // El rango de fechas scopea todo; los filtros cruzados scopean todo
  // EXCEPTO el gráfico que posee esa dimensión (para poder cambiar la selección).
  const dated = useMemo(
    () => filterAnalyses(all, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [all, dateFrom, dateTo],
  )
  const applySel = (records: AnalysisRecord[], skip?: 'severity' | 'finding' | 'user') =>
    records.filter((r) =>
      (skip === 'severity' || !selSeverity || r.severity === selSeverity) &&
      (skip === 'finding' || !selFinding || r.predictedClass === selFinding) &&
      (skip === 'user' || !selUser || r.userName === selUser),
    )

  const scoped = useMemo(() => applySel(dated), [dated, selSeverity, selFinding, selUser]) // eslint-disable-line react-hooks/exhaustive-deps
  const stats = useMemo(() => computeStats(scoped), [scoped])
  const sevRows = useMemo(() => countBy(applySel(dated, 'severity'), (r) => r.severity), [dated, selFinding, selUser]) // eslint-disable-line react-hooks/exhaustive-deps
  const findingRows = useMemo(
    () => Object.entries(countBy(applySel(dated, 'finding'), (r) => r.predictedClass)).sort((a, b) => b[1] - a[1]).slice(0, 6),
    [dated, selSeverity, selUser], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const userRows = useMemo(() => computeUsers(applySel(dated, 'user')), [dated, selSeverity, selFinding]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasSel = !!(selSeverity || selFinding || selUser)
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
          Clic en cualquier barra o fila para filtrar todo el panel · clic de nuevo para quitar el filtro
        </p>
      </div>

      {/* Fila única de filtros: rango primero, luego chips de filtros cruzados */}
      <div className="flex flex-wrap items-center gap-2">
        {([['Hoy', 1], ['7 días', 7], ['30 días', 30], ['Todo', null]] as const).map(([label, days]) => {
          const active = days === null ? !dateFrom && !dateTo : dateFrom === daysAgo(days - 1) && dateTo === daysAgo(0)
          return (
            <button
              key={label}
              onClick={() => setPreset(days)}
              className={cn(
                'h-8 px-3 text-xs font-semibold rounded-lg border transition-colors cursor-pointer',
                active
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]'
                  : 'border-[var(--border)] text-[var(--fg-subtle)] hover:text-[var(--fg)]',
              )}
            >
              {label}
            </button>
          )
        })}
        <span className="mx-1 h-5 w-px bg-[var(--border)]" />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Desde"
          className="h-8 px-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />
        <span className="text-xs text-[var(--fg-subtle)]">—</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Hasta"
          className="h-8 px-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]" />

        {/* Chips de filtros cruzados activos */}
        {selSeverity && <FilterChip label={`Severidad: ${SEVERITY_LABELS[selSeverity]}`} onClear={() => setSelSeverity(null)} />}
        {selFinding && <FilterChip label={`Hallazgo: ${BADGES[selFinding] ?? selFinding}`} onClear={() => setSelFinding(null)} />}
        {selUser && <FilterChip label={`Radiólogo: ${selUser}`} onClear={() => setSelUser(null)} />}
        {hasSel && (
          <button
            onClick={() => { setSelSeverity(null); setSelFinding(null); setSelUser(null) }}
            className="text-xs text-[var(--fg-subtle)] hover:text-[var(--fg)] underline cursor-pointer"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {dated.length === 0 ? (
        <div className="text-center py-16 text-[var(--fg-subtle)]">
          <Activity size={36} className="mx-auto mb-3 opacity-25" />
          <p className="text-sm">Sin análisis en el rango seleccionado.</p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="tech-label">Análisis</p>
              <div className="flex items-end justify-between gap-2">
                <p className="readout text-3xl font-extrabold mt-1 text-[var(--fg)]">{stats.total}</p>
                <Sparkline points={stats.daily.map((d) => d.count)} />
              </div>
              <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">{stats.last7} en los últimos 7 días</p>
            </div>
            <StatTile label="Radiólogos activos" value={String(userRows.length)} sub="con al menos un análisis" />
            <StatTile label="Estudios validados" value={`${stats.validatedPct}%`} sub={`${stats.validated} de ${stats.total}`} />
            <div className="card p-4">
              <p className="tech-label">Concordancia clínica</p>
              <p className="readout text-3xl font-extrabold mt-1" style={{ color: 'var(--primary)' }}>
                {stats.validated > 0 ? `${stats.concordancePct}%` : '—'}
              </p>
              {stats.validated > 0 ? (
                <div className="mt-1.5">
                  <div className="flex h-[8px] rounded overflow-hidden gap-[2px]" role="img"
                    aria-label={`${stats.agrees} concuerdan, ${stats.disagrees} discrepan`}>
                    {stats.agrees > 0 && <div className="rounded-l" style={{ flex: stats.agrees, background: '#16A34A' }} />}
                    {stats.disagrees > 0 && <div className="rounded-r" style={{ flex: stats.disagrees, background: '#D97706' }} />}
                  </div>
                  <p className="text-[11px] text-[var(--fg-subtle)] mt-1">{stats.agrees} concuerdan · {stats.disagrees} discrepan</p>
                </div>
              ) : (
                <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">sin validaciones aún</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Volumen diario — área con crosshair + tooltip */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Volumen diario — últimos 14 días</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Análisis por día en el filtro actual</p>
              <VolumeArea days={stats.daily} />
              <details className="mt-2">
                <summary className="text-[10px] text-[var(--fg-subtle)] cursor-pointer hover:text-[var(--fg)] select-none">Ver tabla de datos</summary>
                <div className="grid grid-cols-7 gap-1 mt-2">
                  {stats.daily.map((d) => (
                    <div key={d.date} className="text-center">
                      <div className="readout text-[9px] text-[var(--fg-subtle)]">{d.label}</div>
                      <div className="readout text-xs font-bold text-[var(--fg)]">{d.count}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Severidad — barras clicables */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Distribución por severidad</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Según el hallazgo principal · clic para filtrar</p>
              <div className="space-y-2 mt-4">
                {(Object.keys(SEVERITY_LABELS) as Severity[]).map((sev) => (
                  <HBar
                    key={sev}
                    label={SEVERITY_LABELS[sev]}
                    value={sevRows[sev] ?? 0}
                    max={Math.max(1, ...Object.values(sevRows))}
                    color={SEV_BAR[sev]}
                    selected={selSeverity === sev}
                    dimmed={selSeverity !== null && selSeverity !== sev}
                    onClick={() => setSelSeverity(selSeverity === sev ? null : sev)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Top hallazgos — barras clicables */}
            <div className="card p-4">
              <h2 className="tech-label mb-1">Hallazgos más frecuentes</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-3">Top 6 por hallazgo principal · clic para filtrar</p>
              <div className="space-y-2 mt-4">
                {findingRows.length === 0 && <p className="text-xs text-[var(--fg-subtle)]">Sin datos con el filtro actual.</p>}
                {findingRows.map(([cls, n]) => (
                  <HBar
                    key={cls}
                    label={BADGES[cls] ?? cls}
                    value={n}
                    max={findingRows[0][1]}
                    color={SINGLE_HUE}
                    selected={selFinding === cls}
                    dimmed={selFinding !== null && selFinding !== cls}
                    onClick={() => setSelFinding(selFinding === cls ? null : cls)}
                  />
                ))}
              </div>
            </div>

            {/* Por radiólogo — filas clicables */}
            <div className="card p-4 overflow-x-auto">
              <h2 className="tech-label mb-1">Actividad por radiólogo</h2>
              <p className="text-[10px] text-[var(--fg-subtle)] mb-2">Clic en una fila para filtrar</p>
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
                  {userRows.map((r) => (
                    <tr
                      key={r.name}
                      onClick={() => setSelUser(selUser === r.name ? null : r.name)}
                      className={cn(
                        'border-b border-[var(--border-subtle)] last:border-0 cursor-pointer transition-colors',
                        selUser === r.name
                          ? 'bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]'
                          : selUser ? 'opacity-45 hover:opacity-80' : 'hover:bg-[var(--surface2)]',
                      )}
                    >
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
              <p className="text-xs text-[var(--fg-subtle)]">Sin discrepancias registradas con el filtro actual.</p>
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

// ── helpers de datos ─────────────────────────────────────────────────────────

function countBy<K extends string>(records: AnalysisRecord[], key: (r: AnalysisRecord) => K): Record<K, number> {
  const out = {} as Record<K, number>
  for (const r of records) out[key(r)] = (out[key(r)] ?? 0) + 1
  return out
}

function computeUsers(records: AnalysisRecord[]) {
  const byUser: Record<string, { total: number; validated: number; agrees: number }> = {}
  for (const r of records) {
    byUser[r.userName] ??= { total: 0, validated: 0, agrees: 0 }
    byUser[r.userName].total++
    if (r.feedback) {
      byUser[r.userName].validated++
      if (r.feedback.agrees) byUser[r.userName].agrees++
    }
  }
  return Object.entries(byUser).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total)
}

interface Stats {
  total: number
  last7: number
  validated: number
  validatedPct: number
  agrees: number
  disagrees: number
  concordancePct: number
  daily: Array<{ date: string; label: string; count: number }>
  recentDisagreements: AnalysisRecord[]
}

function computeStats(records: AnalysisRecord[]): Stats {
  const total = records.length
  const cut7 = daysAgo(6)
  const last7 = records.filter((r) => localDate(r.createdAt) >= cut7).length
  const withFb = records.filter((r) => r.feedback)
  const agrees = withFb.filter((r) => r.feedback!.agrees).length

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
    disagrees: withFb.length - agrees,
    concordancePct: withFb.length > 0 ? Math.round((agrees / withFb.length) * 100) : 0,
    daily,
    recentDisagreements: records.filter((r) => r.feedback && !r.feedback.agrees).slice(0, 5),
  }
}

// ── componentes ──────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="tech-label">{label}</p>
      <p className="readout text-3xl font-extrabold mt-1 text-[var(--fg)]">{value}</p>
      <p className="text-[11px] text-[var(--fg-subtle)] mt-0.5">{sub}</p>
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-semibold rounded-lg border border-[var(--primary)] text-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]">
      {label}
      <button onClick={onClear} aria-label={`Quitar filtro ${label}`} className="cursor-pointer hover:opacity-70">
        <X size={12} />
      </button>
    </span>
  )
}

/** Mini tendencia de 14 días dentro del stat tile. */
function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(1, ...points)
  const w = 72
  const h = 26
  const step = w / (points.length - 1)
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * (h - 3)).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} className="mb-1 shrink-0" aria-hidden="true">
      <path d={path} fill="none" stroke={SINGLE_HUE} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Barra horizontal interactiva: hit target = toda la fila, tooltip al hover,
 * lift de la marca, clic para filtrar. Etiqueta y conteo siempre visibles.
 */
function HBar({ label, value, max, color, selected, dimmed, onClick }: {
  label: string; value: number; max: number; color: string
  selected?: boolean; dimmed?: boolean; onClick?: () => void
}) {
  const [hover, setHover] = useState(false)
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <button
      onClick={onClick}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      aria-pressed={selected}
      aria-label={`${label}: ${value}${selected ? ' (filtro activo)' : ''}`}
      className={cn(
        'relative flex items-center gap-3 w-full py-0.5 rounded cursor-pointer text-left transition-opacity duration-150',
        dimmed && !hover && 'opacity-40',
      )}
    >
      <span className="w-[130px] shrink-0 text-xs font-semibold text-[var(--fg-muted)] truncate">{label}</span>
      <div className="flex-1 h-[14px] rounded-r bg-[var(--surface2)] overflow-hidden">
        {value > 0 && (
          <div
            className="h-full rounded-r transition-all duration-300"
            style={{
              width: `${Math.max(pct, 2)}%`,
              background: color,
              filter: hover ? 'brightness(1.15)' : undefined,
              boxShadow: selected ? 'inset 0 0 0 2px var(--surface)' : undefined,
              outline: selected ? `2px solid ${color}` : undefined,
              outlineOffset: selected ? 1 : undefined,
            }}
          />
        )}
      </div>
      <span className="readout w-8 text-right text-xs font-bold text-[var(--fg)]">{value}</span>
      {hover && (
        <span className="absolute -top-7 left-[140px] z-10 px-2 py-1 rounded-md bg-[var(--fg)] text-[var(--bg)] text-[11px] shadow-lg pointer-events-none whitespace-nowrap">
          <strong className="readout">{value}</strong>
          <span className="opacity-70"> · {label}{onClick ? (selected ? ' — clic para quitar' : ' — clic para filtrar') : ''}</span>
        </span>
      )}
    </button>
  )
}

/** Área de volumen diario con crosshair que ajusta al día más cercano. */
function VolumeArea({ days }: { days: Array<{ date: string; label: string; count: number }> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState<number | null>(null)
  const max = Math.max(1, ...days.map((d) => d.count))
  const n = days.length

  const xPct = (i: number) => (i / (n - 1)) * 100
  const yPct = (c: number) => 100 - (c / max) * 88 - 6 // margen sup 6%, inf 6%

  const linePath = days.map((d, i) => `${i === 0 ? 'M' : 'L'}${xPct(i).toFixed(2)},${yPct(d.count).toFixed(2)}`).join(' ')
  const areaPath = `${linePath} L100,100 L0,100 Z`

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const rel = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    setIdx(Math.round(rel * (n - 1)))
  }

  const active = idx !== null ? days[idx] : null

  return (
    <div>
      <div
        ref={ref}
        className="relative h-32 select-none touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setIdx(null)}
        role="img"
        aria-label={`Volumen diario, máximo ${max}`}
      >
        {/* gridlines recesivas */}
        {[0.25, 0.5, 0.75].map((f) => (
          <div key={f} className="absolute left-0 right-0 border-t border-[var(--border-subtle)]" style={{ top: `${f * 100}%` }} />
        ))}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="vol-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SINGLE_HUE} stopOpacity="0.28" />
              <stop offset="100%" stopColor={SINGLE_HUE} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#vol-fill)" />
          <path d={linePath} fill="none" stroke={SINGLE_HUE} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        </svg>

        {/* crosshair + punto + tooltip */}
        {active && idx !== null && (
          <>
            <div className="absolute top-0 bottom-0 w-px bg-[var(--fg-subtle)] opacity-50 pointer-events-none" style={{ left: `${xPct(idx)}%` }} />
            <div
              className="absolute w-[9px] h-[9px] rounded-full pointer-events-none"
              style={{
                left: `calc(${xPct(idx)}% - 4.5px)`,
                top: `calc(${yPct(active.count)}% - 4.5px)`,
                background: SINGLE_HUE,
                boxShadow: '0 0 0 2px var(--surface)',
              }}
            />
            <div
              className="absolute -top-1 z-10 px-2 py-1 rounded-md bg-[var(--fg)] text-[var(--bg)] text-[11px] shadow-lg pointer-events-none whitespace-nowrap"
              style={{ left: `${xPct(idx)}%`, transform: `translateX(${idx > n / 2 ? '-105%' : '5%'})` }}
            >
              <strong className="readout">{active.count}</strong>
              <span className="opacity-70"> análisis · {active.label}</span>
            </div>
          </>
        )}
      </div>
      {/* eje X */}
      <div className="flex justify-between mt-1 border-t border-[var(--border-subtle)] pt-1">
        {days.map((d, i) => (
          <span key={d.date} className={cn('readout text-[9px] text-[var(--fg-subtle)]', idx === i && 'font-bold text-[var(--fg)]')}>
            {i % 2 === 0 ? d.label : ' '}
          </span>
        ))}
      </div>
    </div>
  )
}
