export const DEFAULT_ADMIN_EMAIL = 'aerubio2305@gmail.com'

/** Mensaje para cualquier acción de un radiólogo que aún no registró su correo. */
export const EMAIL_SETUP_REQUIRED = 'Registre su correo de alertas y recuperación antes de continuar.'
export const EMAIL_SETUP_PATH = '/registrar-correo'

/**
 * Un radiólogo creado sin correo debe registrarlo al ingresar: hasta entonces solo puede usar la
 * pantalla de registro de correo. El administrador siempre tiene correo (es obligatorio).
 */
export function needsEmailSetup(user: { role: string; email?: string | null }): boolean {
  return user.role === 'radiologist' && !user.email
}

export function parseEmail(value: unknown, required = false): string | null {
  if (value == null || value === '') {
    if (required) throw new Error('El correo es obligatorio.')
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
