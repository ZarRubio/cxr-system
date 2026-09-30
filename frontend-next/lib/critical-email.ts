import 'server-only'
import nodemailer from 'cxr-smtp'
import { criticalFindings, type AnalysisRecord, type EmailAlert, type EmailDelivery, type EmailRecipientRole } from './data/analysis'
import { getDataStore } from './data/store'
import { parseEmail } from './email-address'

export function alertText(record: AnalysisRecord, baseUrl: string, missingEmail: boolean): string {
  const url = new URL('/history', baseUrl)
  url.searchParams.set('q', record.id)
  return [
    'Alerta de IA: hallazgos que requieren revision profesional prioritaria. No determina gravedad clinica.',
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

export function configured(): boolean {
  return Boolean(process.env.SMTP_PASSWORD && process.env.SMTP_USER && process.env.AUTH_URL)
}

export function transport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000, dnsTimeout: 5_000,
  })
}

function address(value: unknown): string | null {
  try { return parseEmail(value) } catch { return null }
}

export class EmailRetryError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

/** Explicit retry only. A failed SMTP response can still mean uncertain delivery. */
export async function retryCriticalEmail(record: AnalysisRecord, role: EmailRecipientRole): Promise<EmailAlert> {
  if (!criticalFindings(record).length) throw new EmailRetryError('El estudio no tiene una alerta crítica.', 409)
  if (!configured()) throw new EmailRetryError('El servicio de correo no está configurado.', 503)
  const store = getDataStore()
  const current = await store.getAnalysis(record.id)
  if (!current?.emailAlert) throw new EmailRetryError('No existe un intento de alerta registrado para este estudio.', 409)
  const users = await store.getUsers()
  const user = role === 'admin'
    ? users.find(u => u.role === 'admin' && u.active)
    : users.find(u => u.id === record.userId && u.active)
  const recipient = address(user?.email)
  if (!recipient) throw new EmailRetryError('El destinatario debe configurar un correo válido.', 409)
  const other = role === 'admin' ? 'radiologist' : 'admin'
  const otherUser = role === 'admin'
    ? users.find(u => u.id === record.userId && u.active)
    : users.find(u => u.role === 'admin' && u.active)
  if (recipient === address(otherUser?.email) && current.emailAlert[other].status === 'sent') {
    throw new EmailRetryError('Este correo ya fue aceptado para el otro destinatario del mismo estudio.', 409)
  }
  const alert = await store.claimEmailRetry(record.id, role, new Date())
  if (!alert) throw new EmailRetryError('El reintento no está disponible: ya se envió, está en curso, excedió el límite o requiere esperar un minuto.', 409)
  const mailer = transport()
  try {
    try {
      const info = await mailer.sendMail({
        from: { name: 'CXR Investigación', address: process.env.SMTP_USER! },
        to: recipient,
        subject: `Alerta de IA - Estudio ${(record.studyId || record.id).replace(/[\r\n]/g, ' ')}`,
        messageId: `<cxr-${record.id}-${role}-${alert[role].attempts}@gmail.com>`,
        text: alertText(record, process.env.AUTH_URL!, !address(users.find(u => u.id === record.userId)?.email)),
      })
      alert[role] = { ...alert[role], status: info.accepted.length > 0 ? 'sent' : 'failed', sentAt: info.accepted.length > 0 ? new Date().toISOString() : undefined }
    } catch {
      alert[role] = { ...alert[role], status: 'failed' }
      console.error('[critical-email] reintento fallido', { analysisId: record.id, role })
    }
    await store.setEmailDelivery(record.id, role, alert[role])
    return alert
  } finally {
    mailer.close()
  }
}

/** One attempt per persisted analysis. SMTP acceptance is not proof of inbox delivery. */
export async function notifyCriticalAnalysis(record: AnalysisRecord): Promise<EmailAlert | undefined> {
  if (!criticalFindings(record).length) return undefined
  const store = getDataStore()
  const users = await store.getUsers()
  const responsible = users.find((user) => user.id === record.userId && user.active)
  const admin = users.find((user) => user.role === 'admin' && user.active)
  const adminEmail = address(admin?.email)
  const radioEmail = address(responsible?.email)
  const canSend = configured()
  const createdAt = new Date().toISOString()
  const initial = (email: string | null): EmailDelivery => ({ status: !email ? 'pending_email' : canSend ? 'sending' : 'not_configured', ...(email && canSend ? { attempts: 1, lastAttemptAt: createdAt } : {}) })
  const alert: EmailAlert = { createdAt, admin: initial(adminEmail), radiologist: initial(radioEmail) }
  if (!(await store.claimEmailAlert(record.id, alert))) return (await store.getAnalysis(record.id))?.emailAlert
  if (!canSend) return alert

  const mailer = transport()
  const outcomes = new Map<string, EmailDelivery>()
  try {
    for (const [role, email] of [['admin', adminEmail], ['radiologist', radioEmail]] as const) {
      if (!email) continue
      if (outcomes.has(email)) {
        alert[role] = outcomes.get(email)!
      } else {
        try {
          const info = await mailer.sendMail({
            from: { name: 'CXR Investigación', address: process.env.SMTP_USER! },
            to: email,
            subject: `Alerta de IA - Estudio ${(record.studyId || record.id).replace(/[\r\n]/g, ' ')}`,
            messageId: `<cxr-${record.id}-${role}@gmail.com>`,
            text: alertText(record, process.env.AUTH_URL!, !radioEmail),
          })
          alert[role] = { ...alert[role], status: info.accepted.length > 0 ? 'sent' : 'failed', sentAt: info.accepted.length > 0 ? new Date().toISOString() : undefined }
        } catch {
          alert[role] = { ...alert[role], status: 'failed' }
          console.error('[critical-email] envío fallido', { analysisId: record.id, role })
        }
        outcomes.set(email, alert[role])
      }
      await store.setEmailDelivery(record.id, role, alert[role])
    }
  } finally {
    mailer.close()
  }
  return alert
}
