'use client'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Cpu, Target, Layers, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { fetchModelInfo } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const CLASS_NAMES = [
  'Atelectasis', 'Cardiomegaly', 'Consolidation', 'Edema', 'Effusion', 'Emphysema',
  'Fibrosis', 'Hernia', 'Infiltration', 'Mass', 'Nodule', 'Pleural_Thickening',
  'Pneumonia', 'Pneumothorax',
]

const CLASS_COLORS: Record<string, string> = {
  Atelectasis: 'var(--primary)', Cardiomegaly: '#B91C1C', Consolidation: '#0369A1',
  Edema: '#DC2626', Effusion: '#1D4ED8', Emphysema: '#D97706', Fibrosis: '#475569',
  Hernia: '#7C3AED', Infiltration: '#C2410C', Mass: '#7C3AED', Nodule: '#64748B',
  Pleural_Thickening: '#334155', Pneumonia: '#B91C1C', Pneumothorax: '#DC2626',
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 py-3 pr-3 border-b border-[var(--border-subtle)]">
      <p className="tech-label block mb-1">{label}</p>
      <p className="readout text-xl font-semibold text-[var(--fg)] leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-subtle)] mt-1">{sub}</p>}
    </div>
  )
}

export default function ModelPage() {
  const { data: info, isLoading, isError, refetch } = useQuery({ queryKey: ['model-info'], queryFn: fetchModelInfo })
  const [archOpen, setArchOpen] = useState(false)

  const aucTest = info?.auc_macro
  const aucValidation = info?.val_auc_macro
  const live = info?.metrics ?? {}
  const thresholds = info?.thresholds ?? {}
  const checkpointMaps = Object.values(info?.checkpoint_metrics ?? {})
    .map((item) => item.best_val_map)
    .filter((value): value is number => typeof value === 'number')
  const bestMap = checkpointMaps.length ? Math.max(...checkpointMaps) : undefined
  const evaluation = info?.evaluation_status
  const classes = Object.values(info?.classes ?? {}).length
    ? Object.values(info?.classes ?? {})
    : CLASS_NAMES

  const rows = classes.map((cls) => ({
    cls,
    auc: live[cls]?.auc,
    sensitivity: live[cls]?.sensitivity,
    specificity: live[cls]?.specificity,
    color: CLASS_COLORS[cls] ?? 'var(--primary)',
  })).sort((a, b) => (b.auc ?? -1) - (a.auc ?? -1))

  return (
    <div className="space-y-8">
      <div className="page-heading">
        <h1 className="text-2xl font-semibold text-[var(--fg)]">Modelo y evidencia</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Evidencia disponible del proyecto · aún sin validación clínica externa HNAL
        </p>
      </div>

      {isError && <div role="alert" className="badge-high p-4 rounded-md text-sm">No se pudo consultar el modelo. <button onClick={() => refetch()} className="underline font-semibold cursor-pointer">Reintentar</button></div>}

      {isLoading && (
        <div className="flex items-center gap-2 text-[var(--fg-subtle)] text-sm">
          <div className="animate-spin h-4 w-4 rounded-full border-t-2 border-[var(--primary)]" />
          Cargando métricas del backend…
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="AUC macro · prueba" value={aucTest?.toFixed(3) ?? '—'} sub="Reportado por el proyecto" />
        <MetricCard label="AUC macro · validación" value={aucValidation?.toFixed(3) ?? '—'} sub="Reportado por el proyecto" />
        <MetricCard label="Mejor mAP · checkpoint" value={bestMap?.toFixed(3) ?? '—'} sub="Validación del modelo individual" />
        <MetricCard label="Validación HNAL" value="Pendiente" sub="No documentada" />
      </div>

      <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4 text-[#78350F] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FDE68A]">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold">Estado de evidencia clínica</h2>
            <p className="mt-1 text-xs leading-5">
              Calibración: <strong>{evaluation?.calibration === 'configured' ? 'configurada' : 'no verificada'}</strong>
              {' · '}Partición por paciente: <strong>no documentada en el repositorio</strong>
              {' · '}Validación externa HNAL: <strong>pendiente</strong>.
            </p>
            <p className="mt-1 text-[11px] leading-4">
              Los scores sigmoid sirven para ordenar señales del modelo, pero no deben interpretarse como probabilidad clínica hasta completar calibración y validación externa.
            </p>
          </div>
        </div>
      </div>

      {/* AUC bars */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--fg)]">Área bajo la curva ROC por clase</h3>
        </div>
        {rows.map(({ cls, auc: a, color }) => (
          <div key={cls} className="flex items-center gap-3">
            <div className="w-36 shrink-0 flex items-center gap-1.5">
              <span className="text-xs font-medium truncate text-[var(--fg)]">{cls}</span>
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-[var(--border-subtle)]">
              {a !== undefined && (
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${(a * 100).toFixed(1)}%`, background: color }}
                />
              )}
            </div>
            <span className="readout w-12 text-right text-xs font-semibold text-[var(--fg)]">
              {a?.toFixed(3) ?? '—'}
            </span>
          </div>
        ))}
        <p className="text-[10px] text-[var(--fg-subtle)] pt-1">
          AUC por clase reportado por el proyecto. El repositorio aún no contiene el conjunto de evaluación ni un script que reproduzca estas cifras.
        </p>
      </div>

      {/* Sensitivity / Specificity table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <Target size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--fg)]">Sensibilidad y especificidad</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
                {['Clase', 'Sensibilidad', 'Especificidad', 'Umbral', 'Nota'].map((h) => (
                  <th key={h} className="tech-label text-left px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cls, sensitivity, specificity, color }) => {
                const thrRaw = thresholds[cls]
                const thrStr = thrRaw !== undefined ? `${(Number(thrRaw) * 100).toFixed(0)}%` : '—'
                return (
                  <tr key={cls} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3 text-sm" style={{ color }}>
                      <span className="font-bold">{cls}</span>
                    </td>
                    <td className="readout px-4 py-3 text-sm font-bold">
                      {sensitivity !== undefined ? `${(sensitivity * 100).toFixed(1)}%` : 'No calculada'}
                    </td>
                    <td className="readout px-4 py-3 font-bold text-sm">
                      {specificity !== undefined ? `${(specificity * 100).toFixed(1)}%` : 'No calculada'}
                    </td>
                    <td className="readout px-4 py-3 text-sm text-[var(--fg-muted)]">{thrStr}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-subtle)]">
                      {sensitivity === undefined || specificity === undefined
                        ? 'Falta evaluación reproducible para este umbral.'
                        : 'Reportada por el backend.'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Architecture (collapsible) */}
      <div className="card overflow-hidden p-0">
        <button
          onClick={() => setArchOpen(!archOpen)}
          className={cn('w-full px-5 py-4 flex items-center gap-2 cursor-pointer hover:bg-[var(--surface2)] transition-colors text-left')}
        >
          <Layers size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--fg)] flex-1">Arquitectura del modelo</h3>
          {archOpen ? <ChevronUp size={16} className="text-[var(--fg-subtle)]" /> : <ChevronDown size={16} className="text-[var(--fg-subtle)]" />}
        </button>

        {archOpen && (
          <div className="px-5 pb-5 border-t border-[var(--border-subtle)] space-y-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm text-[var(--fg-muted)] leading-6">
              <div>
                <p className="font-bold text-[var(--fg)] mb-2 flex items-center gap-1.5">
                  <Cpu size={14} className="text-[#1D4ED8]" /> Backbone CNN
                </p>
                <ul className="space-y-1 text-sm">
                  <li>DenseNet121 preentrenado en NIH ChestX-ray14</li>
                  <li>Normalización torchxrayvision: [−1024, 1024]</li>
                  <li>Extrae feature maps 7×7 → 49 patches</li>
                </ul>
              </div>
              <div>
                <p className="font-bold text-[var(--fg)] mb-2 flex items-center gap-1.5">
                  <Layers size={14} className="text-[#7C3AED]" /> Vision Transformer
                </p>
                <ul className="space-y-1 text-sm">
                  <li>Patches: 49 · Embedding: {info?.embedding_dim ?? 512}</li>
                  <li>Heads: {info?.num_heads ?? 8} · Layers: {info?.num_layers ?? 4}</li>
                  <li>MLP: {info?.mlp_dim ?? 1024} · Dropout: {info?.dropout ?? 0.1}</li>
                </ul>
              </div>
            </div>

            <div className="bg-[var(--surface2)] border border-[var(--border-subtle)] border-l-4 border-l-[#2563EB] rounded-lg p-4 font-mono text-xs leading-7 overflow-x-auto text-[var(--fg)]">
              CXR (224×224) →{' '}
              <span className="text-[#1D4ED8] font-bold">DenseNet121</span> →
              feature maps 7×7 →{' '}
              <span className="text-[#15803D] font-bold">49 patches</span> →{' '}
              <span className="text-[#7C3AED] font-bold">ViT (4 bloques, 8 heads)</span> →
              sigmoid multi-label →{' '}
              <span className="text-[#B91C1C] font-bold">14 scores independientes no calibrados</span>
            </div>

            <p className="text-[11px] text-[var(--fg-subtle)]">
              Ensemble: 0.3 × modelo v1 (4 capas) + 0.7 × modelo v2 (6 capas).
              Métricas reportadas por el proyecto. No constituyen aprobación clínica ni regulatoria.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
