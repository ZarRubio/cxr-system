'use client'
import { ClipboardList, Hash } from 'lucide-react'
import type { StudyMeta } from '@/lib/pdf'

const INPUT_CLS = [
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface2)]',
  'text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
  'px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] transition-shadow',
].join(' ')

interface StudyMetaFormProps {
  studyMeta: StudyMeta
  onChange: (key: keyof StudyMeta, value: string) => void
  radiologistName?: string
  radiologistCmp?: string
}

/** Tarjeta "Datos del estudio" — metadatos para el reporte PDF. */
export function StudyMetaForm({ studyMeta, onChange, radiologistName, radiologistCmp }: StudyMetaFormProps) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList size={13} className="text-[var(--fg-subtle)]" />
        <span className="tech-label">
          Datos del estudio · para el reporte PDF
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Study ID */}
        <div className="space-y-1">
          <label htmlFor="study-id" className="text-[11px] font-semibold text-[var(--fg-subtle)]">ID de estudio</label>
          <div className="relative">
            <Hash size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
            <input
              id="study-id"
              value={studyMeta.studyId}
              onChange={(e) => onChange('studyId', e.target.value)}
              className={`readout ${INPUT_CLS} pl-7`}
              placeholder="EST-20260626-001"
            />
          </div>
          <p className="text-[10px] text-[var(--fg-subtle)]">Identificador anónimo — no incluye datos del paciente</p>
        </div>

        {/* Projection */}
        <div className="space-y-1">
          <label htmlFor="study-projection" className="text-[11px] font-semibold text-[var(--fg-subtle)]">Proyección</label>
          <select
            id="study-projection"
            value={studyMeta.projection}
            onChange={(e) => onChange('projection', e.target.value)}
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
          <label htmlFor="study-indication" className="text-[11px] font-semibold text-[var(--fg-subtle)]">Indicación clínica</label>
          <input
            id="study-indication"
            value={studyMeta.clinicalIndication}
            onChange={(e) => onChange('clinicalIndication', e.target.value)}
            className={INPUT_CLS}
            placeholder="Ej: Tos persistente 3 semanas, fiebre, pérdida de peso…"
          />
        </div>

        {/* Radiologist — read from session, not editable */}
        {!!(radiologistName || radiologistCmp) && (
          <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--surface2)] border border-[var(--border-subtle)]">
            <span className="text-[11px] text-[var(--fg-subtle)]">Informante:</span>
            <span className="text-[11px] font-semibold text-[var(--fg)]">{radiologistName ?? ''}</span>
            {!!radiologistCmp && (
              <span className="readout text-[11px] text-[var(--fg-subtle)]">· CMP {radiologistCmp}</span>
            )}
            <span className="ml-auto text-[10px] text-[var(--primary)]">desde tu sesión</span>
          </div>
        )}
      </div>
    </div>
  )
}
