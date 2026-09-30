'use client'
import Link from 'next/link'
import { Moon, Sun, ScanLine } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function AccessLayout({ children }: { children: React.ReactNode }) {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <div className="access-layout">
      <a href="#access-content" className="skip-link">Ir al contenido</a>
      <header className="access-header">
        <Link href="/login" className="flex items-center gap-3 min-w-0">
          <ScanLine size={24} className="text-[var(--primary)] shrink-0" aria-hidden="true" />
          <span className="font-semibold text-lg">CXR Classifier</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden sm:block text-sm text-[var(--fg-muted)]">Investigación en radiografía de tórax</span>
          <button type="button" className="icon-button" title={dark ? 'Modo claro' : 'Modo oscuro'} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      <main id="access-content" tabIndex={-1} className="access-main">
        <div className="access-form">{children}</div>
      </main>
      <footer className="access-footer">
        <span>Proyecto académico · Lima, Perú</span>
        <span>Los resultados requieren revisión del especialista.</span>
      </footer>
    </div>
  )
}
