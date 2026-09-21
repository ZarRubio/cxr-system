import { Mail } from 'lucide-react'
import type { EmailAlert, DeliveryStatus } from '@/lib/data/analysis'

const labels: Record<DeliveryStatus, string> = {
  sending: 'Envío pendiente de confirmación',
  sent: 'Enviado al servidor de correo',
  failed: 'Error de envío',
  pending_email: 'Pendiente de configurar correo',
  not_configured: 'Servicio de correo no configurado',
}

export function EmailAlertStatus({ alert }: { alert?: EmailAlert }) {
  if (!alert) return null
  return (
    <div role="status" className="my-3 border-y border-[var(--border)] py-3 text-sm text-[var(--fg)]">
      <p className="flex items-center gap-2 font-semibold"><Mail size={16} /> Notificación de hallazgo crítico</p>
      <p className="mt-1">Administrador: {labels[alert.admin.status]}</p>
      <p>Radiólogo: {labels[alert.radiologist.status]}</p>
    </div>
  )
}
