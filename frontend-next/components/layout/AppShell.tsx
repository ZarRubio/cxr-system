'use client'
import { usePathname } from 'next/navigation'
import { Sidebar }   from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header }    from './Header'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublic = pathname === '/login'

  if (isPublic) {
    return <div className="h-full w-full overflow-auto">{children}</div>
  }

  return (
    <>
      <a href="#main-content" className="skip-link">Ir al contenido</a>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-8 py-6 sm:py-8">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
