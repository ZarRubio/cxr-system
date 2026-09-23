'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loading || !username.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn('credentials', { username: username.trim(), password, redirect: false })
      if (!result || result.error) {
        setError('Usuario o contraseña incorrectos. Si no puede ingresar, contacte al administrador.')
      } else {
        router.push('/analyze')
        router.refresh()
      }
    } catch {
      setError('No se pudo conectar con el servicio. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }
  const inputClass = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 min-h-11 text-base text-[var(--fg)]'
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 sm:px-10 py-5 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg font-semibold">CXR Classifier</span>
        <span className="text-sm text-[var(--fg-muted)]">Hospital Nacional Arzobispo Loayza</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="text-sm text-[var(--primary)] font-medium mb-3">Radiografía de tórax</p>
          <h1 className="text-2xl font-semibold">Acceso al sistema</h1>
          <p className="text-sm text-[var(--fg-muted)] mt-2 mb-8">Personal autorizado · Proyecto de investigación</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">Usuario</label>
              <input id="username" name="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className={inputClass} aria-describedby={error ? 'login-error' : undefined} />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2">Contraseña</label>
              <div className="relative">
                <input id="password" name="password" type={showPwd ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} aria-describedby={error ? 'login-error' : undefined} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} className="icon-button absolute right-0 top-0" aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPwd}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p id="login-error" role="alert" className="badge-critical rounded-md p-3 text-sm">{error}</p>}
            <Button type="submit" size="lg" className="w-full" loading={loading}><LogIn size={17} />{loading ? 'Verificando acceso...' : 'Iniciar sesión'}</Button>
          </form>
          <p className="mt-8 border-t border-[var(--border-subtle)] pt-5 text-xs leading-5 text-[var(--fg-subtle)]">Uso exclusivamente académico. Los resultados del modelo no constituyen un diagnóstico ni sustituyen la evaluación del especialista.</p>
        </div>
      </main>
      <footer className="px-6 py-5 text-xs text-[var(--fg-subtle)] border-t border-[var(--border-subtle)]">HNAL · Lima, Perú</footer>
    </div>
  )
}
