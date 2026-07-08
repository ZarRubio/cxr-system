'use client'
import { useState, useEffect, useCallback } from 'react'
import { UserPlus, ToggleLeft, ToggleRight, Shield, Stethoscope, X, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'

interface UserRow {
  id:        string
  name:      string
  username:  string
  role:      'admin' | 'radiologist'
  cmp:       string | null
  specialty?: string
  active:    boolean
  createdAt: string
}

function InitialsAvatar({ name, role }: { name: string; role: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{
        background: role === 'admin' ? 'rgba(220,38,38,0.12)' : 'color-mix(in srgb, var(--primary) 12%, transparent)',
        color:      role === 'admin' ? '#B91C1C' : 'var(--primary)',
      }}
    >
      {initials}
    </div>
  )
}

export default function AdminPage() {
  const [users,   setUsers]   = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const [form, setForm] = useState({ name: '', username: '', cmp: '', specialty: 'Radiología', password: '', confirm: '' })
  const [showPwd, setShowPwd] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [formErr, setFormErr] = useState('')

  const fetchUsers = useCallback(async () => {
    try {
      const res  = await fetch('/api/admin/users')
      const data = await res.json()
      setUsers(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const handleToggle = async (user: UserRow) => {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: !u.active } : u))
      showToast('ok', `${user.name} ${!user.active ? 'activado' : 'desactivado'}`)
    } else {
      showToast('err', 'No se pudo cambiar el estado.')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErr('')
    if (form.password !== form.confirm) { setFormErr('Las contraseñas no coinciden.'); return }
    if (form.password.length < 6)       { setFormErr('La contraseña debe tener al menos 6 caracteres.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, username: form.username, cmp: form.cmp, specialty: form.specialty, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setFormErr(data.error ?? 'Error al crear usuario.'); return }
      setUsers(prev => [...prev, data])
      setForm({ name: '', username: '', cmp: '', specialty: 'Radiología', password: '', confirm: '' })
      setShowForm(false)
      showToast('ok', `Dr./Dra. ${data.name} creado correctamente.`)
    } finally {
      setSaving(false)
    }
  }

  const active   = users.filter(u => u.active).length
  const total    = users.length
  const admins   = users.filter(u => u.role === 'admin').length

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{
            background:   toast.type === 'ok' ? '#DCFCE7' : '#FEE2E2',
            color:        toast.type === 'ok' ? '#166534' : '#991B1B',
            border:       `1px solid ${toast.type === 'ok' ? '#86EFAC' : '#FCA5A5'}`,
          }}
        >
          {toast.type === 'ok' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--fg)] leading-tight">
            Gestión de radiólogos
          </h1>
          <p className="text-sm text-[var(--fg-subtle)] mt-1">
            Solo el administrador puede crear o deshabilitar cuentas.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shrink-0"
          style={{ background: 'var(--primary)' }}
        >
          <UserPlus size={16} />
          Nuevo radiólogo
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Usuarios totales', value: total,   color: '#0F172A' },
          { label: 'Activos',          value: active,  color: '#16A34A' },
          { label: 'Administradores',  value: admins,  color: '#B91C1C' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-[11px] font-bold text-[var(--fg-subtle)] uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-extrabold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-bold text-[var(--fg)]">Usuarios del sistema</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-[var(--fg-subtle)] text-sm">
            <div className="animate-spin h-4 w-4 rounded-full border-2 border-[var(--primary)] border-t-transparent" />
            Cargando usuarios…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--surface2)] border-b border-[var(--border-subtle)]">
                  {['Radiólogo', 'Usuario', 'CMP', 'Especialidad', 'Rol', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface2)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={user.name} role={user.role} />
                        <div>
                          <p className="font-semibold text-[var(--fg)]">{user.name}</p>
                          <p className="text-[11px] text-[var(--fg-subtle)]">
                            {new Date(user.createdAt).toLocaleDateString('es-PE')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--fg-muted)]">{user.username}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{user.cmp ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-[var(--fg-muted)]">{user.specialty ?? '—'}</td>
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEE2E2] text-[#B91C1C]">
                          <Shield size={10} /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F2FE] text-[#0369A1]">
                          <Stethoscope size={10} /> Radiólogo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {user.role === 'admin' ? (
                        <span className="text-[11px] text-[var(--fg-subtle)]">Siempre activo</span>
                      ) : (
                        <button
                          onClick={() => handleToggle(user)}
                          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                          style={{ color: user.active ? '#16A34A' : '#9CA3AF' }}
                          title={user.active ? 'Deshabilitar cuenta' : 'Habilitar cuenta'}
                        >
                          {user.active
                            ? <><ToggleRight size={20} /> Activo</>
                            : <><ToggleLeft  size={20} /> Inactivo</>
                          }
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create user drawer/modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-[#0F172A] border border-[var(--border-subtle)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-subtle)]">
              <div>
                <h3 className="text-base font-bold text-[var(--fg)]">Nuevo radiólogo</h3>
                <p className="text-xs text-[var(--fg-subtle)] mt-0.5">La cuenta se activa inmediatamente.</p>
              </div>
              <button onClick={() => { setShowForm(false); setFormErr('') }} className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 py-5 space-y-4">
              {[
                { id: 'name',      label: 'Nombre completo',  placeholder: 'Dr. Juan Pérez García',  type: 'text',     required: true  },
                { id: 'username',  label: 'Usuario de acceso', placeholder: 'jperez',                 type: 'text',     required: true  },
                { id: 'cmp',       label: 'N° CMP',           placeholder: '12345',                   type: 'text',     required: false },
                { id: 'specialty', label: 'Especialidad',     placeholder: 'Radiología',              type: 'text',     required: false },
              ].map(({ id, label, placeholder, type, required }) => (
                <div key={id}>
                  <label htmlFor={`f-${id}`} className="block text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider mb-1.5">
                    {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
                  </label>
                  <input
                    id={`f-${id}`}
                    type={type}
                    required={required}
                    value={(form as Record<string,string>)[id]}
                    onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:ring-2 focus:ring-[var(--ring)] transition"
                  />
                </div>
              ))}

              {/* Password */}
              {(['password', 'confirm'] as const).map(field => (
                <div key={field}>
                  <label htmlFor={`f-${field}`} className="block text-xs font-bold text-[var(--fg-subtle)] uppercase tracking-wider mb-1.5">
                    {field === 'password' ? 'Contraseña' : 'Confirmar contraseña'}<span className="text-[#EF4444] ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id={`f-${field}`}
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={form[field]}
                      onChange={e => { setForm(f => ({ ...f, [field]: e.target.value })); setFormErr('') }}
                      placeholder="••••••••"
                      className="w-full px-3 pr-9 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface2)] text-sm text-[var(--fg)] placeholder:text-[var(--fg-subtle)] outline-none focus:ring-2 focus:ring-[var(--ring)] transition"
                    />
                    {field === 'confirm' && (
                      <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-subtle)]">
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {formErr && (
                <div className="flex items-center gap-2 text-xs text-[#B91C1C] bg-[#FEE2E2] border border-[#FECACA] rounded-lg px-3 py-2">
                  <AlertCircle size={13} />
                  {formErr}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setFormErr('') }}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--fg)] hover:bg-[var(--surface2)] transition">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
                  style={{ background: 'var(--primary)' }}>
                  {saving ? 'Creando…' : 'Crear cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
