'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Mail, KeyRound, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function RecoveryPage() {
  const [email, setEmail] = useState('')
  const [requestId, setRequestId] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const input = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 min-h-11 text-base text-[var(--fg)]'
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    if (requestId && password !== confirmation) { setError('Las contraseñas no coinciden.'); return }
    if (requestId && new TextEncoder().encode(password).length > 72) { setError('La contraseña excede el límite de 72 bytes. Use menos caracteres.'); return }
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/auth/recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestId ? { action: 'confirm', requestId, code, password } : { action: 'request', email }) })
      const data = await res.json()
      if (!res.ok) { setError(data.message); return }
      setMessage(data.message)
      if (requestId) { setDone(true); setPassword(''); setConfirmation(''); setCode('') }
      else setRequestId(data.requestId)
    } catch { setError('No se pudo conectar con el servicio.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-dvh flex items-center justify-center px-6 py-12">
    <div className="w-full max-w-sm">
      <p className="text-sm font-medium text-[var(--primary)] mb-3">CXR Classifier</p>
      <h1 className="text-2xl font-semibold mb-6">Recuperar acceso</h1>
      {message && <p role="status" className="mb-5 text-sm text-[var(--fg-muted)]">{message}</p>}
      {!done && <form onSubmit={submit} className="space-y-5">
        {!requestId ? <div><label htmlFor="recovery-email" className="block text-sm font-medium mb-2">Correo registrado</label>
          <input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={input} /></div>
          : <>
            <div><label htmlFor="recovery-code" className="block text-sm font-medium mb-2">Código recibido</label>
              <input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className={input} /></div>
            <div><label htmlFor="new-password" className="block text-sm font-medium mb-2">Nueva contraseña (mínimo 12 caracteres)</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e => setPassword(e.target.value)} className={input} /></div>
            <div><label htmlFor="confirm-password" className="block text-sm font-medium mb-2">Confirmar contraseña</label>
              <input id="confirm-password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={input} /></div>
          </>}
        {error && <p role="alert" className="badge-critical p-3 rounded text-sm">{error}</p>}
        <Button type="submit" className="w-full" loading={busy}>{requestId ? <KeyRound size={17} /> : <Mail size={17} />}{requestId ? 'Actualizar contraseña' : 'Enviar código'}</Button>
        {requestId && <button type="button" disabled={busy} className="text-sm text-[var(--primary)]" onClick={() => { setRequestId(''); setCode(''); setMessage(''); setError('') }}>Solicitar otro código</button>}
      </form>}
      <Link href="/login" className="mt-6 inline-flex gap-2 items-center text-sm text-[var(--primary)]"><ArrowLeft size={16} />Volver al inicio de sesión</Link>
    </div>
  </main>
}
