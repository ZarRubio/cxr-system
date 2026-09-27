import type { Prediction } from '@/lib/types'
import { criticalFindings } from '@/lib/data/analysis'

export function StudySaveStatus({ prediction }: { prediction: Prediction }) {
  const failed = prediction.persistence?.status === 'failed'
  const saved = prediction.persistence?.status === 'saved' || Boolean(prediction.analysis_id)
  return (
    <div role={failed ? 'alert' : 'status'} className={`border-l-4 px-4 py-3 text-sm ${failed ? 'badge-high' : 'border-[var(--primary)] text-[var(--fg)]'}`}>
      <p>{failed ? prediction.persistence?.message : saved ? 'Estudio guardado en el historial.' : 'Guardado del estudio no confirmado.'}</p>
      {prediction.notification_error && <p>No se pudo confirmar el estado del correo. Revise el historial antes de repetir el envío.</p>}
      {saved && !prediction.email_alert && !prediction.notification_error && !criticalFindings({ positiveFindings: prediction.positive_findings }).length && <p>No se activó una notificación por correo: no hay hallazgos sobre los umbrales de alerta.</p>}
    </div>
  )
}
