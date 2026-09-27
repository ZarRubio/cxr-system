import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { StudySaveStatus } from './StudySaveStatus'
import { EmailAlertStatus } from './EmailAlertStatus'
import type { Prediction } from '@/lib/types'
const prediction: Prediction = { predicted_class: 'No Finding', confidence: .8, probabilities: {}, positive_findings: [], processing_time_ms: 10 }
afterEach(cleanup)
it('does not confuse inference success with saved history', () => {
  render(<StudySaveStatus prediction={{ ...prediction, persistence: { status: 'failed', message: 'No se guardó. No se enviaron notificaciones.' } }} />)
  expect(screen.getByRole('alert').textContent).toContain('No se guardó')
})
it('explains why a noncritical result did not send email', () => {
  render(<StudySaveStatus prediction={{ ...prediction, analysis_id: 'a' }} />)
  expect(screen.getByRole('status').textContent).toContain('no hay hallazgos')
})
it('shows unknown notification status without claiming successful delivery', () => {
  render(<StudySaveStatus prediction={{ ...prediction, analysis_id: 'a', notification_error: true }} />)
  expect(screen.getByRole('status').textContent).toContain('No se pudo confirmar')
})
it('shows administrator delivery separately from missing radiologist email', () => {
  render(<EmailAlertStatus alert={{ createdAt: 'now', admin: { status: 'sent' }, radiologist: { status: 'pending_email' } }} />)
  expect(screen.getByRole('status').textContent).toContain('Administrador: Enviado al servidor')
  expect(screen.getByRole('status').textContent).toContain('Radiólogo: Pendiente de configurar correo')
})
