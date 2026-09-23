'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ClipboardList, Images, ScanLine, GitCompare, ChartNoAxesCombined, Users, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export const WORKSPACE_NAV = [
  { href: '/analyze', label: 'Nuevo estudio', icon: ScanLine },
  { href: '/history', label: 'Estudios', icon: ClipboardList },
  { href: '/batch', label: 'Carga por lote', icon: Images },
  { href: '/compare', label: 'Comparar', icon: GitCompare },
  { href: '/model', label: 'Modelo y evidencia', icon: BookOpen },
]
export const ADMIN_NAV = [
  { href: '/admin/stats', label: 'Actividad', icon: ChartNoAxesCombined },
  { href: '/admin', label: 'Usuarios', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'admin'
  return (
    <aside className="hidden lg:flex w-[224px] shrink-0 flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--border-subtle)]">
      <Link href="/analyze" className="px-6 py-6 border-b border-[var(--border-subtle)]">
        <span className="block text-lg font-semibold text-[var(--fg)]">CXR Classifier</span>
        <span className="text-xs text-[var(--sidebar-muted)]">Radiografía de tórax · HNAL</span>
      </Link>
      <nav aria-label="Navegación principal" className="flex-1 overflow-y-auto px-3 py-5">
        {[WORKSPACE_NAV, ...(isAdmin ? [ADMIN_NAV] : [])].map((group, index) => (
          <div key={index} className={index ? 'mt-6 border-t border-[var(--border-subtle)] pt-5' : ''}>
            <p className="px-3 mb-2 text-xs font-medium text-[var(--sidebar-muted)]">{index ? 'Administración' : 'Espacio de trabajo'}</p>
            <ul className="space-y-1">
              {group.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={pathname === href ? 'page' : undefined}
                    className={cn('flex items-center gap-3 px-3 min-h-11 rounded-md text-sm transition-colors', pathname === href ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-fg)] font-semibold' : 'text-[var(--sidebar-fg)] hover:bg-[var(--border-subtle)]')}>
                    <Icon size={18} aria-hidden="true" /><span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-6 py-5 border-t border-[var(--border-subtle)] text-xs text-[var(--sidebar-muted)] leading-5">
        <p className="font-semibold">Proyecto de investigación</p>
        <p>Uso académico. Los resultados requieren revisión del radiólogo.</p>
      </div>
    </aside>
  )
}
