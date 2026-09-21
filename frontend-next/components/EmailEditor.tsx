'use client'
import { useState } from 'react'
import { Save, Mail } from 'lucide-react'

export function EmailEditor({ initialEmail, required, endpoint }: { initialEmail: string | null; required: boolean; endpoint: string }) {
  const [email, setEmail] = useState(initialEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  return (
    <form className="min-w-0 space-y-1" onSubmit={async (event) => {
      event.preventDefault()
      setSaving(true)
      setMessage('')
      try {
        const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar.')
        setEmail(data.email ?? '')
        setFailed(false)
        setMessage('Correo guardado')
      } catch (error) {
        setFailed(true)
        setMessage(error instanceof Error ? error.message : 'No se pudo guardar.')
      } finally { setSaving(false) }
    }}>
      <div className="flex items-center gap-2">
        <Mail size={15} className="shrink-0 text-[var(--fg-subtle)]" />
        <input aria-label="Correo de notificaciones" type="email" required={required} maxLength={254} value={email}
          onChange={(event) => setEmail(event.target.value)} placeholder="Correo de notificaciones"
          className="w-full min-w-0 h-9 rounded border border-[var(--border)] bg-[var(--surface2)] px-2 text-sm text-[var(--fg)]" />
        <button type="submit" disabled={saving} aria-label="Guardar correo" title="Guardar correo"
          className="h-9 w-9 shrink-0 flex items-center justify-center rounded border border-[var(--border)] text-[var(--fg)] disabled:opacity-50">
          <Save size={16} />
        </button>
      </div>
      {message && <p role="status" className={`text-xs ${failed ? 'text-red-700 dark:text-red-300' : 'text-[var(--fg-muted)]'}`}>{message}</p>}
    </form>
  )
}
