import { AlertTriangle, ScanLine, ShieldCheck } from 'lucide-react'
import type { Prediction } from '@/lib/types'

export function CXRScreeningAlert({ screening }: { screening: Prediction['cxr_screening'] }) {
  if (!screening) return null

  const compatible = screening.status === 'likely_cxr'
  const Icon = compatible ? ShieldCheck : AlertTriangle

  return (
    <section
      aria-label="Control de compatibilidad de imagen"
      className={[
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        compatible
          ? 'border-[#86EFAC] bg-[#F0FDF4] dark:border-[#166534] dark:bg-[#052E16]'
          : 'border-[#FCD34D] bg-[#FFFBEB] dark:border-[#92400E] dark:bg-[#451A03]',
      ].join(' ')}
    >
      <Icon
        size={18}
        className={compatible ? 'text-[#15803D] dark:text-[#86EFAC]' : 'text-[#B45309] dark:text-[#FCD34D]'}
      />
      <div className="min-w-0">
        <p className={[
          'text-sm font-bold',
          compatible ? 'text-[#166534] dark:text-[#BBF7D0]' : 'text-[#92400E] dark:text-[#FDE68A]',
        ].join(' ')}>
          {compatible ? 'Entrada compatible con radiografía de tórax' : 'Compatibilidad de imagen no confirmada'}
        </p>
        <p className="mt-1 text-xs leading-5 text-[var(--fg-muted)]">
          {compatible
            ? 'El control técnico de modalidad y apariencia fue satisfactorio.'
            : screening.reasons[0] ?? 'Revise la modalidad y la adquisición antes de interpretar el resultado.'}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-[var(--fg-subtle)]">
          <ScanLine size={11} />
          Control automático {screening.method}; no valida calidad diagnóstica.
        </p>
      </div>
    </section>
  )
}
