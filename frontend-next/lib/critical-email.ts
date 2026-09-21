import 'server-only'
import nodemailer from 'cxr-smtp'
import { criticalFindings, type AnalysisRecord, type EmailAlert, type EmailDelivery } from './data/analysis'
import { getDataStore } from './data/store'
import { parseEmail } from './email-address'

export function alertText(record: AnalysisRecord, baseUrl: string, missingEmail: boolean): string {
  const url = new URL('/history', baseUrl)
  url.searchParams.set('q', record.id)
  return [
    'Alerta de IA: posibles hallazgos críticos pendientes de revisión profesional.',
    `ID de estudio: ${record.studyId || record.id}`,
    `ID de análisis: ${record.id}`,
    `Responsable: ${record.userName}`,
    `Fecha y hora (Lima): ${new Date(record.createdAt).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`,
    '',
    'Hallazgos que activaron la alerta (puntuaciones del modelo):',
    ...criticalFindings(record).map((finding) => `${finding}: ${((record.probabilities[finding] ?? 0) * 100).toFixed(1)}%`),
    '',
    ...(missingEmail ? ['El radiólogo tiene pendiente configurar su correo. Se notifica al administrador.'] : []),
    `Revisar estudio: ${url.toString()}`,
    'Uso académico. Esta alerta no confirma un diagnóstico ni sustituye la evaluación del profesional.',
  ].join('\n')
}

/** One attempt per persisted analysis. SMTP acceptance is not proof of inbox delivery. */
export async function notifyCriticalAnalysis(record: AnalysisRecord): Promise<EmailAlert | undefined> {
  if (!criticalFindings(record).length) return undefined
  const store = getDataStore()
  const users = await store.getUsers()
  const responsible = users.find((user) => user.id === record.userId && user.active)
  const admin = users.find((user) => user.role === 'admin' && user.active)
  const address = (value: unknown) => { try { return parseEmail(value) } catch { return null } }
  const adminEmail = address(admin?.email)
  const radioEmail = address(responsible?.email)
  const configured = Boolean(process.env.SMTP_PASSWORD && process.env.SMTP_USER && process.env.AUTH_URL)
  const initial = (email: string | null): EmailDelivery => ({ status: !email ? 'pending_email' : configured ? 'sending' : 'not_configured' })
  const alert: EmailAlert = { createdAt: new Date().toISOString(), admin: initial(adminEmail), radiologist: initial(radioEmail) }
  if (!(await store.claimEmailAlert(record.id, alert))) return (await store.getAnalysis(record.id))?.emailAlert
  if (!configured) return alert

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000, dnsTimeout: 5_000,
  })
  const outcomes = new Map<string, EmailDelivery>()
  try {
    for (const [role, email] of [['admin', adminEmail], ['radiologist', radioEmail]] as const) {
      if (!email) continue
      if (outcomes.has(email)) {
        alert[role] = outcomes.get(email)!
      } else {
        try {
          const info = await transport.sendMail({
            from: { name: 'CXR HNAL', address: process.env.SMTP_USER! },
            to: email,
            subject: `Alerta de IA - Estudio ${(record.studyId || record.id).replace(/[\r\n]/g, ' ')}`,
            messageId: `<cxr-${record.id}-${role}@gmail.com>`,
            text: alertText(record, process.env.AUTH_URL!, !radioEmail),
          })
          alert[role] = info.accepted.length > 0 ? { status: 'sent', sentAt: new Date().toISOString() } : { status: 'failed' }
        } catch {
          alert[role] = { status: 'failed' }
          console.error('[critical-email] envío fallido', { analysisId: record.id, role })
        }
        outcomes.set(email, alert[role])
      }
      await store.setEmailAlert(record.id, alert)
    }
  } finally {
    transport.close()
  }
  return alert
}
