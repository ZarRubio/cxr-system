export const DEFAULT_ADMIN_EMAIL = 'aerubio2305@gmail.com'

export function parseEmail(value: unknown, required = false): string | null {
  if (value == null || value === '') {
    if (required) throw new Error('El correo del administrador es obligatorio.')
    return null
  }
  if (typeof value !== 'string') throw new Error('Correo no válido.')
  const email = value.trim().toLowerCase()
  if (!email && !required) return null
  if (email.length > 254 || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    throw new Error('Ingresa un correo válido.')
  }
  return email
}
