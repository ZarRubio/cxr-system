'use client'
import { useState, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Lock, User, Activity, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen flex" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>

      {/* ── Panel izquierdo — branding clínico ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10 relative overflow-hidden"
        style={{ background: '#060E1C' }}
      >
        {/* Grid decorativo de fondo */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#0891B2 1px, transparent 1px), linear-gradient(90deg, #0891B2 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Círculos decorativos */}
        <div
          className="absolute top-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full opacity-[0.06]"
          style={{ border: '1px solid #0891B2' }}
        />
        <div
          className="absolute top-[-40px] right-[-40px] w-[200px] h-[200px] rounded-full opacity-[0.08]"
          style={{ border: '1px solid #0891B2' }}
        />
        <div
          className="absolute bottom-[-60px] left-[-60px] w-[260px] h-[260px] rounded-full opacity-[0.05]"
          style={{ border: '1px solid #0891B2' }}
        />

        {/* Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-10">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg"
              style={{ background: 'rgba(8,145,178,0.15)', border: '1px solid rgba(8,145,178,0.3)' }}
            >
              <Activity size={18} style={{ color: '#0891B2' }} />
            </div>
            <span className="text-white font-extrabold text-base tracking-tight">CXR Classifier</span>
          </div>

          {/* Big display text */}
          <div className="mb-8">
            <div
              className="text-[80px] font-extrabold leading-none mb-1 select-none"
              style={{ color: 'rgba(8,145,178,0.18)', letterSpacing: '-4px' }}
            >
              CXR
            </div>
            <h1 className="text-3xl font-extrabold text-white leading-tight mb-3">
              Sistema de apoyo<br />diagnóstico
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#6B7280' }}>
              Clasificación automatizada de radiografías de tórax mediante red neuronal CNN-ViT —
              14 patologías independientes.
            </p>
          </div>

          {/* Stats pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: '14 clases', sub: 'patológicas' },
              { label: 'AUC 0.80', sub: 'macro test' },
              { label: 'Grad-CAM', sub: 'explicabilidad' },
            ].map(({ label, sub }) => (
              <div
                key={label}
                className="px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.2)' }}
              >
                <span className="text-xs font-bold" style={{ color: '#22D3EE' }}>{label}</span>
                <span className="text-xs ml-1" style={{ color: '#4B5563' }}>{sub}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <div className="h-px mb-6" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#374151' }}>
            Hospital Nacional Arzobispo Loayza
          </p>
          <p className="text-xs" style={{ color: '#374151' }}>Lima, Perú · 2026</p>
          <p className="text-[10px] mt-3 leading-4" style={{ color: '#1F2937' }}>
            Uso exclusivamente académico. No emite diagnóstico clínico definitivo.
            No sustituye el criterio del médico especialista.
          </p>
        </div>
      </div>

      {/* ── Panel derecho — formulario ── */}
      <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#0B1120] p-8">
        <div className="w-full max-w-[380px]">

          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Activity size={20} className="text-[#0891B2]" />
            <span className="font-extrabold text-lg text-[#0F172A] dark:text-white">CXR Classifier</span>
            <span className="text-xs text-[#6B7280] ml-1">HNAL</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-[#0F172A] dark:text-white mb-1">
              Iniciar sesión
            </h2>
            <p className="text-sm text-[#6B7280]">
              Acceso exclusivo para personal autorizado HNAL
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-bold text-[#374151] dark:text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError('') }}
                  placeholder="usuario.hnal"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border text-sm bg-[#F8FAFC] dark:bg-[#1E293B] text-[#0F172A] dark:text-white placeholder:text-[#CBD5E1] transition-all outline-none"
                  style={{
                    borderColor: error ? '#EF4444' : '#E2E8F0',
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#0891B2'; e.target.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.1)' }}
                  onBlur={(e)  => { e.target.style.borderColor = error ? '#EF4444' : '#E2E8F0'; e.target.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-bold text-[#374151] dark:text-[#9CA3AF] uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  id="password"
                  ref={pwdRef}
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-3 rounded-xl border text-sm bg-[#F8FAFC] dark:bg-[#1E293B] text-[#0F172A] dark:text-white placeholder:text-[#CBD5E1] transition-all outline-none"
                  style={{
                    borderColor: error ? '#EF4444' : '#E2E8F0',
                    boxShadow: 'none',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#0891B2'; e.target.style.boxShadow = '0 0 0 3px rgba(8,145,178,0.1)' }}
                  onBlur={(e)  => { e.target.style.borderColor = error ? '#EF4444' : '#E2E8F0'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#475569] transition-colors"
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-[#FEF2F2] border border-[#FECACA] px-4 py-3">
                <AlertCircle size={15} className="text-[#EF4444] mt-0.5 shrink-0" />
                <p className="text-xs text-[#B91C1C] leading-5">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all duration-150 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#0E7490' : '#0891B2' }}
              onMouseEnter={(e) => { if (!loading) (e.target as HTMLElement).style.background = '#0E7490' }}
              onMouseLeave={(e) => { if (!loading) (e.target as HTMLElement).style.background = '#0891B2' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Verificando…
                </span>
              ) : 'Ingresar al sistema'}
            </button>
          </form>

          {/* Disclaimer */}
          <div className="mt-8 pt-6 border-t border-[#F1F5F9] dark:border-[#1E293B]">
            <p className="text-[10px] text-[#94A3B8] leading-4 text-center">
              Sistema de uso exclusivamente académico · HNAL Lima 2026<br />
              No emite diagnóstico clínico definitivo · No sustituye al especialista
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
