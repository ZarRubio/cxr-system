'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon, Activity } from 'lucide-react'
import { useSessionStore } from '@/store/session'

export function Header() {
  const { theme, setTheme } = useTheme()
  const total = useSessionStore((s) => s.totalAnalyses)

  return (
    <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-[var(--sidebar-bg)] border-b border-[#1F2937]">
      <div>
        <span className="text-white font-extrabold text-base">CXR Classifier</span>
        <span className="text-[#6B7280] text-xs ml-2">HNAL 2026</span>
      </div>
      <div className="flex items-center gap-3">
        {total > 0 && (
          <div className="flex items-center gap-1 text-[#22D3EE] text-xs font-bold">
            <Activity size={13} />
            {total}
          </div>
        )}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="text-[#9CA3AF] hover:text-white transition-colors p-1.5 rounded cursor-pointer"
          aria-label="Cambiar tema"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
