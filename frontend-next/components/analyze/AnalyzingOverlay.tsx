'use client'
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Loader2 } from 'lucide-react'

interface Props { fileBytes?: Uint8Array; filename?: string }

export function AnalyzingOverlay({ filename }: Props) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content onEscapeKeyDown={e => e.preventDefault()} onPointerDownOutside={e => e.preventDefault()} className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md card p-6">
          <div className="flex items-center gap-3 mb-3"><Loader2 size={20} className="animate-spin text-[var(--primary)]" aria-hidden="true" /><Dialog.Title className="text-lg font-semibold">Procesando estudio</Dialog.Title></div>
          <Dialog.Description className="text-sm text-[var(--fg-muted)]">Esperando el resultado del servicio de análisis.</Dialog.Description>
          <p className="text-sm break-all mt-4">{filename}</p>
          <p className="text-sm text-[var(--fg-subtle)] mt-4">Tiempo transcurrido: <span className="readout">{elapsed} s</span></p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
