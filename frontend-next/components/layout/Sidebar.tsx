'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Microscope, ClipboardList, GitCompare, BarChart3,
  Sun, Moon, ChevronLeft, ChevronRight, Activity,
  LogOut, Shield, Settings,
} from 'lucide-react'
import { useTheme }    from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { cn }          from '@/lib/utils'
import { useSessionStore } from '@/store/session'
import { CLASSES_INFO } from '@/lib/constants'
import { useState } from 'react'

const NAV = [
  { href: '/analyze',  label: 'Analizar',  icon: Microscope  },
  { href: '/history',  label: 'Historial', icon: ClipboardList },
  { href: '/compare',  label: 'Comparar',  icon: GitCompare  },
  { href: '/model',    label: 'Modelo',    icon: BarChart3   },
]

const NAV_ADMIN = { href: '/admin', label: 'Admin', icon: Settings }

export function Sidebar() {
  const pathname  = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session }   = useSession()
  const total     = useSessionStore((s) => s.totalAnalyses)
  const [collapsed, setCollapsed] = useState(false)

  const user     = session?.user
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '??'
  const isAdmin  = (user as Record<string,unknown>)?.role === 'admin'

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col h-screen sticky top-0 shrink-0 transition-all duration-200',
        'bg-[var(--sidebar-bg)] border-r border-[#1F2937]',
        collapsed ? 'w-[60px]' : 'w-[240px]',
      )}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#1F2937]">
        {!collapsed && (
          <div>
            <div className="text-white font-extrabold text-lg leading-tight">CXR Classifier</div>
            <div className="text-[#6B7280] text-[11px] mt-0.5">HNAL 2026</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-[var(--sidebar-muted)] hover:text-white transition-colors p-1 rounded cursor-pointer"
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-2">
          {[...NAV, ...(isAdmin ? [NAV_ADMIN] : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    active
                      ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)]'
                      : 'text-[var(--sidebar-fg)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white',
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span>{label}</span>}
                  {href === '/admin' && !collapsed && (
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-[rgba(220,38,38,0.2)] text-[#FCA5A5]">
                      ADMIN
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Model info */}
        {!collapsed && (
          <div className="mx-4 mt-6 pt-4 border-t border-[#1F2937]">
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Modelo</p>
            <p className="text-[11px] text-[#9CA3AF] leading-5">Ensemble CNN-ViT v1 + v2</p>
            <p className="text-[11px] text-[#9CA3AF]">DenseNet121 · NIH ChestX-ray14</p>
            <p className="text-[11px] text-[#9CA3AF]">Pesos: 0.3×v1 + 0.7×v2</p>
          </div>
        )}

        {/* 14 classes */}
        {!collapsed && (
          <div className="mx-4 mt-4 pt-4 border-t border-[#1F2937]">
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">14 clases</p>
            <ul className="space-y-0.5">
              {Object.entries(CLASSES_INFO).map(([cls, desc]) => (
                <li key={cls} className="text-[10px] text-[#6B7280] leading-5">
                  <span className="text-[#9CA3AF]">{cls}:</span> {desc}
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1F2937] space-y-2">
        {/* Session counter */}
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[rgba(8,145,178,0.1)]">
            <Activity size={14} className="text-[#22D3EE] shrink-0" />
            <span className="text-[12px] text-[#9CA3AF]">Análisis sesión:</span>
            <span className="text-[12px] font-bold text-[#22D3EE] ml-auto">{total}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] text-[var(--sidebar-muted)] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer',
            collapsed && 'justify-center',
          )}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>

        {/* User card + logout */}
        {user && (
          <div className={cn('border-t border-[#1F2937] pt-2', collapsed ? 'flex justify-center' : '')}>
            {collapsed ? (
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-lg text-[#6B7280] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            ) : (
              <div className="px-2 py-2 rounded-lg bg-[rgba(255,255,255,0.04)]">
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                    style={{ background: isAdmin ? 'rgba(220,38,38,0.2)' : 'rgba(8,145,178,0.2)', color: isAdmin ? '#FCA5A5' : '#22D3EE' }}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{user.name}</p>
                    <div className="flex items-center gap-1">
                      {isAdmin && <Shield size={9} className="text-[#FCA5A5]" />}
                      <p className="text-[10px] text-[#6B7280] truncate">
                        {isAdmin ? 'Administrador' : `CMP ${(user as Record<string,unknown>).cmp ?? '—'}`}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[12px] text-[#6B7280] hover:text-white hover:bg-[rgba(255,255,255,0.06)] transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}

        {!collapsed && (
          <p className="text-[10px] text-[#4B5563] text-center px-2 leading-4">
            Uso exclusivamente académico. No reemplaza el criterio del radiólogo.
          </p>
        )}
      </div>
    </aside>
  )
}
