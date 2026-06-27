'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Microscope, ClipboardList, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/analyze',  label: 'Analizar',  icon: Microscope   },
  { href: '/history',  label: 'Historial', icon: ClipboardList },
  { href: '/model',    label: 'Modelo',    icon: BarChart3    },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--sidebar-bg)] border-t border-[#1F2937] safe-area-inset-bottom"
      role="navigation"
      aria-label="Navegación principal"
    >
      <ul className="flex h-16 pb-safe">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 h-full w-full text-[10px] font-semibold transition-colors duration-150',
                  active
                    ? 'text-[var(--sidebar-active-fg)]'
                    : 'text-[#6B7280] hover:text-[#9CA3AF]',
                )}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
