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
  const linkedEvidence = info?.metrics_provenance === 'local_reproduced_historical_test'
  const live = info?.metrics ?? {}
  const thresholds = info?.thresholds ?? {}
  const evaluation = info?.evaluation_status
  const classes = Object.values(info?.classes ?? {}).length
    ? Object.values(info?.classes ?? {})
    : CLASS_NAMES

  const rows = classes.map((cls) => ({
    cls,
    auc: live[cls]?.auc,
    ap: live[cls]?.ap,
    positives: live[cls]?.n_positive,
    sensitivity: live[cls]?.sensitivity,
    specificity: live[cls]?.specificity,
    color: CLASS_COLORS[cls] ?? 'var(--primary)',
  })).sort((a, b) => linkedEvidence ? (a.auc ?? 1) - (b.auc ?? 1) : CLASS_NAMES.indexOf(a.cls) - CLASS_NAMES.indexOf(b.cls))

  return (
    <div className="space-y-8">
      <div className="page-heading">
        <h1 className="text-2xl font-semibold text-[var(--fg)]">Modelo y evidencia</h1>
        <p className="text-sm text-[var(--fg-subtle)] mt-1">
          Evidencia disponible del proyecto · aún sin validación clínica externa independiente
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
        <MetricCard label="AUROC macro · prueba NIH" value={aucTest?.toFixed(3) ?? '—'} sub={linkedEvidence ? 'Test histórico reproducido' : 'Sin vínculo por hash'} />
        <MetricCard label="AUROC macro · validación NIH" value={aucValidation?.toFixed(3) ?? '—'} sub={linkedEvidence ? 'Peso elegido antes de prueba' : 'Sin vínculo por hash'} />
        <MetricCard label="AUPRC macro · prueba NIH" value={info?.test_map?.toFixed(3) ?? '—'} sub={linkedEvidence ? `${info?.test_images ?? 4023} estudios en prueba` : 'Sin vínculo por hash'} />
        <MetricCard label="Validación externa" value="Pendiente" sub="No documentada" />
      </div>

      <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4 text-[#78350F] dark:border-[#92400E] dark:bg-[#451A03] dark:text-[#FDE68A]">
        <div className="flex items-start gap-3">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <div>
            <h2 className="text-sm font-bold">Estado de evidencia clínica</h2>
            <p className="mt-1 text-xs leading-5">
              Calibración: <strong>{evaluation?.calibration === 'configured' ? 'configurada' : 'no verificada'}</strong>
              {' · '}Partición por paciente: <strong>{linkedEvidence ? 'auditada para el test histórico' : 'sin vínculo con los artefactos cargados'}</strong>
              {' · '}Validación externa independiente: <strong>pendiente</strong>.
            </p>
            <p className="mt-1 text-[11px] leading-4">
              {linkedEvidence
                ? 'Estas métricas corresponden al test NIH histórico, no a una cohorte clínica externa. Los scores sigmoid no son probabilidades clínicas calibradas.'
                : 'No se muestran métricas históricas hasta comprobar que los checkpoints y la configuración cargados coinciden con los evaluados.'}
            </p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--primary)]" />
          <h3 className="text-sm font-bold text-[var(--fg)]">Rendimiento por hallazgo · test NIH histórico</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
                {['Hallazgo', 'AUROC', 'AUPRC', 'Positivos'].map((heading) => (
                  <th key={heading} scope="col" className="tech-label text-left px-4 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cls, auc, ap, positives }) => (
                <tr key={cls} className="border-b border-[var(--border-subtle)]">
                  <th scope="row" className="px-4 py-3 text-left font-medium text-[var(--fg)]">{cls}</th>
                  <td className="readout px-4 py-3 text-[var(--fg)]">{auc?.toFixed(3) ?? '—'}</td>
                  <td className="readout px-4 py-3 text-[var(--fg)]">{ap?.toFixed(3) ?? '—'}</td>
                  <td className="readout px-4 py-3 text-[var(--fg)]">{positives ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs text-[var(--fg-subtle)]">
          {linkedEvidence
            ? '4 023 imágenes de prueba, una por paciente. AUROC mide discriminación; AUPRC debe leerse junto al número de positivos. No hay validación clínica externa.'
            : 'Las métricas por clase se ocultan porque esta versión no está vinculada por hash a la evaluación local.'}
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
              <span className="text-[#7C3AED] font-bold">ViT (4 y 6 bloques, 8 heads)</span> →
              sigmoid multi-label →{' '}
              <span className="text-[#B91C1C] font-bold">14 scores independientes no calibrados</span>
            </div>

            <p className="text-[11px] text-[var(--fg-subtle)]">
              Ensemble: 0.3 × modelo v1 (4 capas) + 0.7 × modelo v2 (6 capas).
              Evaluación NIH histórica vinculada por hash solo cuando los artefactos coinciden. No constituye aprobación clínica ni regulatoria.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
