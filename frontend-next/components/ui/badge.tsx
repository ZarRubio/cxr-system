import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'
import { SEVERITY_LABELS } from '@/lib/constants'

const variantClasses: Record<Severity | string, string> = {
  critical: 'badge-critical',
  high:     'badge-high',
  moderate: 'badge-moderate',
  normal:   'badge-normal',
}

interface BadgeProps {
  label?: string
  severity?: Severity
  className?: string
}

export function SeverityBadge({ severity = 'moderate', label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide',
        variantClasses[severity],
        className,
      )}
    >
      {label ?? SEVERITY_LABELS[severity]}
    </span>
  )
}

export function ClassBadge({ label, severity = 'moderate', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-extrabold tracking-widest uppercase',
        variantClasses[severity],
        className,
      )}
    >
      {label}
    </span>
  )
}
