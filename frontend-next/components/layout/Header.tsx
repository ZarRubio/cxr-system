'use client'
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useSession, signOut } from 'next-auth/react'
import { Moon, Sun, LogOut, UserRound, X } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { ProfileEmail } from '../ProfileEmail'
import { Button } from '../ui/button'

const subscribe = () => () => {}

export function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const { data: session } = useSession()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <header className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-8 min-h-16 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
      <div className="min-w-0">
        <p className="lg:hidden font-semibold text-sm">CXR Classifier</p>
        <p className="hidden lg:block text-sm text-[var(--fg-muted)]">Hospital Nacional Arzobispo Loayza</p>
        <p className="lg:hidden text-xs text-[var(--fg-subtle)]">HNAL · Investigación</p>
      </div>
      <div className="flex items-center gap-1">
        <button className="icon-button" title={dark ? 'Modo claro' : 'Modo oscuro'} aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button className="flex items-center gap-2 min-h-11 px-2 rounded-md text-sm cursor-pointer hover:bg-[var(--surface2)]" aria-label="Abrir mi cuenta">
              <UserRound size={18} aria-hidden="true" /><span className="hidden sm:block max-w-44 truncate">{session?.user?.name ?? 'Mi cuenta'}</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 z-[60]" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[85dvh] overflow-y-auto card p-6 z-[61]">
              <div className="flex items-center justify-between gap-3">
                <Dialog.Title className="text-lg font-semibold">Mi cuenta</Dialog.Title>
                <Dialog.Close className="icon-button" aria-label="Cerrar cuenta"><X size={18} /></Dialog.Close>
              </div>
              <Dialog.Description className="text-sm text-[var(--fg-muted)] mb-5">{session?.user?.name}</Dialog.Description>
              <ProfileEmail />
              <Button variant="outline" onClick={() => signOut({ redirectTo: '/login' })}><LogOut size={16} />Cerrar sesión</Button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </header>
  )
}
