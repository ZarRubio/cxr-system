'use client'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Cpu, Target, Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { fetchModelInfo } from '@/lib/api'
import { SEVERITY_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const CLASS_COLORS: Record<string, string> = {
  'No Finding':   '#15803D',
  Cardiomegaly:   '#B91C1C',
  Effusion:       '#1D4ED8',
  Infiltration:   '#C2410C',
}

const DEFAULT_METRICS: Record<string, { auc: number; sensitivity: number; specificity: number }> = {
  'No Finding':  { auc: 0.818, sensitivity: 0.765, specificity: 0.740 },
  Cardiomegaly:  { auc: 0.931, sensitivity: 0.857, specificity: 0.874 },
  Effusion:      { auc: 0.926, sensitivity: 0.706, specificity: 0.931 },
  Infiltration:  { auc: 0.786, sensitivity: 0.167, specificity: 0.978 },
}

const CLASS_NOTES: Record<string, string> = {
  'No Finding':  'Lectura base para descartar hallazgos relevantes.',
  Cardiomegaly:  'Mejor AUC reportado del modelo.',
  Effusion:      'Alta especificidad reportada.',
  Infiltration:  'Umbral bajo para aumentar cobertura en contexto TB.',
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-extrabold text-[var(--fg-subtle)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-extrabold text-[var(--fg)] leading-none">{value}</p>
      {sub && <p className="text-[11px] text-[var(--fg-subtle)] mt-1">{sub}</p>}
    </div>
  )
}

export default function ModelPage() {
  const { data: info, isLoading } = useQuery({ queryKey: ['model-info'], queryFn: fetchModelInfo })
  const [archOpen, setArchOpen] = useState(false)

  const auc  = info?.auc_macro ?? 0.865
  const live = info?.metrics ?? {}
  const thresholds = info?.thresholds ?? {}

  const rows = Object.entries(DEFAULT_METRICS).map(([cls, def]) => ({
    cls,
    auc:         live[cls]?.auc         ?? def.auc,
    sensitivity: live[cls]?.sensitivity ?? def.sensitivity,
    specificity: live[cls]?.specificity ?? def.specificity,
  })).sort((a, b) => b.auc - a.auc)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--fg)]">Rendimiento del modelo</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Métricas reportadas en el conjunto de validación · HNAL 2026
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-[var(--fg-subtle)] text-sm">
          <div className="animate-spin h-4 w-4 rounded-full border-t-2 border-[#0891B2]" />
          Cargando métricas del backend…
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="AUC Macro" value={auc.toFixed(3)} sub="Promedio no ponderado" />
        <MetricCard label="Arquitectura" value="CNN-ViT" sub="DenseNet121 + Transformer" />
        <MetricCard label="Clases" value="4" sub="No Finding, Cardio, Effusion, Infiltration" />
        <MetricCard label="Entrada" value="224×224" sub="Imagen normalizada" />
      </div>

      {/* AUC bars */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 size={16} className="text-[#0891B2]" />
          <h3 className="text-sm font-bold text-[var(--fg)]">Área bajo la curva ROC por clase</h3>
        </div>
        {rows.map(({ cls, auc: a }) => {
          const color = CLASS_COLORS[cls] ?? '#475569'
          return (
            <div key={cls} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-sm font-bold" style={{ color }}>{cls}</span>
              <div className="flex-1 h-3 rounded-full bg-[var(--border-subtle)]">
                <div
                  className="h-3 rounded-full transition-all duration-700"
                  style={{ width: `${(a * 100).toFixed(1)}%`, background: color }}
                />
              </div>
              <span className="w-12 text-right text-sm font-extrabold tabular-nums" style={{ color }}>
                {a.toFixed(3)}
              </span>
            </div>
          )
        })}
      </div>

      {/* Sensitivity / Specificity table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <Target size={16} className="text-[#0891B2]" />
          <h3 className="text-sm font-bold text-[var(--fg)]">Sensibilidad y especificidad</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
                {['Clase', 'Sensibilidad', 'Especificidad', 'Umbral', 'Nota'].map((h) => (
                  <th key={h} className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cls, sensitivity, specificity }, i) => {
                const color = CLASS_COLORS[cls] ?? '#475569'
                const thrRaw = thresholds[i] ?? thresholds[cls]
                const thrStr = thrRaw !== undefined ? `${(Number(thrRaw) * 100).toFixed(0)}%` : '—'
                return (
                  <tr key={cls} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3 font-bold text-sm" style={{ color }}>{cls}</td>
                    <td className="px-4 py-3 font-bold text-sm">{(sensitivity * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 font-bold text-sm">{(specificity * 100).toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm font-mono text-[var(--fg-muted)]">{thrStr}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-subtle)]">{CLASS_NOTES[cls] ?? '—'}</td>
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
          <Layers size={16} className="text-[#0891B2]" />
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
              <span className="text-[#B91C1C] font-bold">4 probabilidades independientes</span>
            </div>

            <p className="text-[11px] text-[var(--fg-subtle)]">
              Ensemble: 0.3 × modelo v1 (4 capas) + 0.7 × modelo v2 (6 capas).
              Métricas reportadas sobre el conjunto de validación del proyecto. No constituyen aprobación clínica regulatoria.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
