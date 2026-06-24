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
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </>
  )
}
