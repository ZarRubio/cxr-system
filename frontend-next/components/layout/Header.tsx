'use client'
import { useTheme }  from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { Sun, Moon, Activity, LogOut } from 'lucide-react'
import { useSessionStore } from '@/store/session'

export function Header() {
  const { theme, setTheme } = useTheme()
  const { data: session }   = useSession()
  const total = useSessionStore((s) => s.totalAnalyses)

  const user     = session?.user
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? ''

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[var(--sidebar-bg)] border-b border-[#1F2937]">
      <div>
        <span className="text-white font-extrabold text-base">CXR Classifier</span>
        <span className="text-[#6B7280] text-xs ml-2">HNAL 2026</span>
      </div>
      <div className="flex items-center gap-2">
        {total > 0 && (
          <div className="flex items-center gap-1 text-[var(--sidebar-active-fg)] text-xs font-bold">
            <Activity size={13} />
            <span className="readout">{total}</span>
          </div>
        )}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-[#9CA3AF] hover:text-white transition-colors p-1.5 rounded cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        {user && (
          <>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-fg)' }}
              title={user.name}
            >
              {initials}
            </div>
            <button
              onClick={() => signOut({ redirectTo: '/login' })}
              className="text-[#6B7280] hover:text-white transition-colors p-1 rounded cursor-pointer"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </>
        )}
      </div>
    </header>
  )
}
