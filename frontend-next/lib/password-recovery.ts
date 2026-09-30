import 'server-only'
import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { parseEmail } from './email-address'
import { getDataStore } from './data/store'
import { configured, transport } from './critical-email'
import { consumeLimit, mutateSecurity, securityId } from './security-state'

export const RECOVERY_MESSAGE = 'Si existe una cuenta activa con ese correo, recibira un codigo valido durante 10 minutos.'

function digest(requestId: string, code: string): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('Servicio de recuperacion no configurado.')
  return createHmac('sha256', secret).update(`${requestId}:${code}`).digest('hex')
}

export function validNewPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72
}

export async function requestPasswordRecovery(emailInput: unknown, ip: string, schedule?: (job: () => Promise<void>) => void): Promise<string> {
  const email = parseEmail(emailInput, true)!
  if (!configured()) throw new Error('Servicio de recuperacion no disponible.')
  const requestId = randomUUID()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = digest(requestId, code)
  if (!(await consumeLimit(`recovery-ip:${ip}`, 10, 900_000))) return requestId
  if (!(await consumeLimit(`recovery-email:${email}`, 1, 60_000))) return requestId
  const users = (await getDataStore().getUsersByEmail(email)).filter(u => u.active)
  // Ambiguous legacy emails must be resolved by an administrator, never pick a random account.
  if (users.length !== 1) return requestId
  const user = users[0]
  await mutateSecurity(`recovery:${requestId}`, () => ({ data: {
    userId: user.id, previousPassword: user.password, email, codeHash, attempts: 0,
    expiresAt: Date.now() + 600_000, consumed: false,
  }, result: undefined }))
  const deliver = async () => {
  const mailer = transport()
  try {
    const info = await mailer.sendMail({
      from: { name: 'CXR Investigacion', address: process.env.SMTP_USER! }, to: email,
      subject: 'Codigo de recuperacion de acceso - CXR',
      text: `Su codigo de recuperacion es: ${code}\n\nCaduca en 10 minutos y solo puede utilizarse una vez. No lo comparta.\nSi no solicito este cambio, ignore este mensaje. Su contrasena no ha cambiado.`,
    })
    if (!info.accepted.length) throw new Error('SMTP did not accept recovery mail')
  } catch {
    await mutateSecurity(`recovery:${requestId}`, current => ({ data: { ...current, consumed: true }, result: undefined }))
    console.error('[password-recovery] envio no confirmado', { request: securityId(requestId) })
    // Same public response even if this specific recipient cannot receive mail.
  } finally { mailer.close() }
  }
  if (schedule) schedule(deliver)
  else await deliver()
  return requestId
}

export async function completePasswordRecovery(requestId: unknown, code: unknown, password: unknown, ip: string): Promise<boolean> {
  if (typeof requestId !== 'string' || !/^[a-f0-9-]{36}$/.test(requestId) || typeof code !== 'string' || !/^\d{6}$/.test(code) || !validNewPassword(password)) return false
  if (!(await consumeLimit(`recovery-verify:${ip}`, 30, 900_000))) return false
  const supplied = digest(requestId, code)
  const passwordHash = await bcrypt.hash(password, 12)
  return mutateSecurity(`recovery:${requestId}`, current => {
    if (current.consumed || Number(current.expiresAt ?? 0) <= Date.now() || Number(current.attempts ?? 0) >= 5) return { data: { ...current, expiresAt: current.expiresAt ?? Date.now() }, result: false }
    const expected = String(current.codeHash ?? '')
    const match = expected.length === supplied.length && timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
    const data = { ...current, attempts: Number(current.attempts ?? 0) + 1, consumed: match }
    return { data, result: match, ...(match ? { passwordChange: {
      id: String(current.userId), previousPassword: String(current.previousPassword), email: String(current.email), password: passwordHash,
    } } : {}) }
  })
}
