'use client'
import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, Activity, AlertCircle } from 'lucide-react'

const INPUT_BASE = [
  'w-full pl-9 py-3 rounded-[var(--radius-md)] border text-sm',
  'bg-[var(--surface2)] text-[var(--fg)] placeholder:text-[var(--fg-subtle)]',
  'outline-none transition-shadow focus:ring-2 focus:ring-[var(--ring)]',
].join(' ')

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const pwdRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true)
    setError('')

    const result = await signIn('credentials', { username: username.trim(), password, redirect: false })
    if (result?.error) {
      setError('Usuario o contraseña incorrectos. Contacte al administrador si el problema persiste.')
      setLoading(false)
    } else {
      router.push('/analyze')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg)]">

      {/* ── Panel izquierdo — sala de lectura ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-10 relative overflow-hidden"
        style={{ background: '#0C181D' }}
      >
        {/* Fondo tipo radiografía: dos campos pulmonares como gradientes radiales (solo CSS) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'radial-gradient(ellipse 34% 46% at 36% 46%, rgba(34,211,238,0.09), transparent 72%)',
              'radial-gradient(ellipse 34% 46% at 68% 46%, rgba(34,211,238,0.06), transparent 72%)',
              'radial-gradient(ellipse 90% 70% at 50% 110%, rgba(14,116,144,0.14), transparent 70%)',
            ].join(', '),
          }}
        />

        {/* Header / identidad */}
        <div className="relative z-10">
          <p className="tech-label mb-6" style={{ color: 'var(--sidebar-muted)' }}>
            Hospital Nacional Arzobispo Loayza — Lima
          </p>

          <div className="flex items-center gap-3 mb-6">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)]"
              style={{ background: 'var(--sidebar-active-bg)', border: '1px solid rgba(34,211,238,0.25)' }}
            >
              <Activity size={20} style={{ color: 'var(--primary-light)' }} />
            </div>
            <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--sidebar-fg)' }}>
              CXR Classifier
            </h1>
          </div>

          <p className="text-sm leading-relaxed max-w-[34ch]" style={{ color: 'var(--sidebar-muted)' }}>
            Sistema de apoyo al diagnóstico de radiografías de tórax — 14 patologías,
            ensemble CNN-ViT con explicabilidad Grad-CAM.
          </p>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="h-px mb-5" style={{ background: 'rgba(220,232,236,0.08)' }} />
          <p className="tech-label" style={{ color: 'var(--sidebar-muted)' }}>
            Sala de lectura · HNAL 2026
          </p>
          <p className="text-[11px] mt-2 leading-4" style={{ color: '#4A626C' }}>
            Uso exclusivamente académico. No emite diagnóstico clínico definitivo.
            No sustituye el criterio del médico especialista.
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-6 px-1">
            <Activity size={20} className="text-[var(--primary)]" />
            <span className="font-bold text-lg text-[var(--fg)]">CXR Classifier</span>
            <span className="tech-label ml-1">HNAL</span>
          </div>

          <div className="card p-8">
            {/* Heading */}
            <div className="mb-7">
              <p className="tech-label mb-2">Acceso al sistema</p>
              <h2 className="text-2xl font-bold text-[var(--fg)] mb-1">
                Iniciar sesión
              </h2>
              <p className="text-sm text-[var(--fg-subtle)]">
                Acceso exclusivo para personal autorizado HNAL
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              {/* Username */}
              <div>
                <label htmlFor="username" className="tech-label block mb-1.5">
                  Usuario
                </label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError('') }}
                    placeholder="usuario.hnal"
                    aria-invalid={!!error}
                    className={`readout ${INPUT_BASE} pr-4`}
                    style={{ borderColor: error ? '#DC2626' : 'var(--border)' }}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="tech-label block mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]" />
                  <input
                    id="password"
                    ref={pwdRef}
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••"
                    aria-invalid={!!error}
                    className={`${INPUT_BASE} pr-10`}
                    style={{ borderColor: error ? '#DC2626' : 'var(--border)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors cursor-pointer"
                    aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[#FEE2E2] dark:bg-[#450A0A] border border-[#FCA5A5] px-4 py-3"
                >
                  <AlertCircle size={15} className="text-[#DC2626] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5] leading-5">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !username || !password}
                className="w-full py-3 rounded-[var(--radius-md)] text-sm font-bold text-white transition-all duration-150 mt-2 bg-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary)_85%,black)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Verificando…
                  </span>
                ) : 'Ingresar al sistema'}
              </button>
            </form>
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-[10px] text-[var(--fg-subtle)] leading-4 text-center">
            Sistema de uso exclusivamente académico · HNAL Lima 2026<br />
            No emite diagnóstico clínico definitivo · No sustituye al especialista
          </p>
        </div>
      </div>
    </div>
  )
}
