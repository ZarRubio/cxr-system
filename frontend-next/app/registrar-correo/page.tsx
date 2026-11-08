'use client'
import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Mail, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AccessLayout } from '@/components/layout/AccessLayout'

/**
 * Primer ingreso de un radiólogo creado sin correo. El proxy redirige aquí cualquier otra página
 * (y responde 403 a la API) hasta que el correo quede guardado.
 */
export default function RegisterEmailPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'No se pudo guardar el correo. Intente nuevamente.'); return }
      window.location.assign('/analyze')
    } catch {
      setError('No se pudo conectar con el servicio.')
    } finally {
      setBusy(false)
    }
  }

  return <AccessLayout>
    <p className="text-sm font-medium text-[var(--primary)] mb-3">CXR Classifier</p>
    <h1 className="text-2xl font-semibold mb-3">Registre su correo</h1>
    <p className="text-sm text-[var(--fg-muted)] mb-6">
      Antes de usar el sistema debe registrar un correo propio. Se usará para recuperar su contraseña y para
      avisarle de posibles hallazgos críticos en sus estudios. No podrá continuar hasta guardarlo.
    </p>
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="setup-email" className="block text-sm font-medium mb-2">Correo electrónico</label>
        <input id="setup-email" type="email" autoComplete="email" required maxLength={254} value={email}
          onChange={e => setEmail(e.target.value)} className="field-input" />
      </div>
      {error && <p role="alert" className="badge-critical p-3 rounded text-sm">{error}</p>}
      <Button type="submit" size="lg" className="w-full" loading={busy}><Mail size={17} />Guardar y continuar</Button>
    </form>
    <button type="button" className="access-link mt-4" onClick={() => signOut({ redirectTo: '/login' })}>
      <LogOut size={16} />Cerrar sesión
    </button>
  </AccessLayout>
}
