'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MoreHorizontal } from 'lucide-react'
import { WORKSPACE_NAV, ADMIN_NAV } from './Sidebar'
import { cn } from '@/lib/utils'

export function BottomNav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const isAdmin = (session?.user as { role?: string })?.role === 'admin'
  const more = [...WORKSPACE_NAV.slice(3), ...(isAdmin ? ADMIN_NAV : [])]
  return (
    <nav className="mobile-navigation lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[var(--border-subtle)] bg-[var(--surface)]" aria-label="Navegación móvil">
      <ul className="flex h-16">
        {WORKSPACE_NAV.slice(0, 3).map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex-1 min-w-0"><Link href={href} aria-current={pathname === href ? 'page' : undefined} className={cn('flex h-full flex-col items-center justify-center gap-1 text-xs', pathname === href ? 'text-[var(--primary)] font-semibold' : 'text-[var(--fg-muted)]')}><Icon size={20} /><span>{label}</span></Link></li>
        ))}
        <li className="flex-1 min-w-0 relative">
          <details key={pathname} className="group h-full">
            <summary className="list-none flex h-full flex-col items-center justify-center gap-1 text-xs cursor-pointer text-[var(--fg-muted)]"><MoreHorizontal size={20} /><span>Más</span></summary>
            <ul className="absolute bottom-full right-2 w-56 p-2 mb-2 card shadow-lg">
              {more.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href} aria-current={pathname === href ? 'page' : undefined} className="flex items-center gap-3 p-3 rounded-md text-sm hover:bg-[var(--surface2)]"><Icon size={18} />{label}</Link></li>)}
            </ul>
          </details>
        </li>
      </ul>
    </nav>
  )
}
