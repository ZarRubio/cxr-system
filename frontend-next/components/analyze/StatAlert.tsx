'use client'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle } from 'lucide-react'
import { BADGES } from '@/lib/constants'
import { Button } from '@/components/ui/button'

interface StatAlertProps { predictedClass: string; confidence: number; onDismiss: () => void }

export function StatAlert({ predictedClass, confidence, onDismiss }: StatAlertProps) {
  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onDismiss() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[calc(100%-2rem)] max-w-md card p-6">
          <div className="flex items-start gap-3"><AlertTriangle className="text-[#b42318] dark:text-[#ffb8b1] shrink-0 mt-1" size={22} /><Dialog.Title className="text-lg font-semibold">Hallazgo marcado para revisión prioritaria</Dialog.Title></div>
          <Dialog.Description className="text-sm text-[var(--fg-muted)] mt-4">El modelo superó el umbral para una clase incluida en las reglas de alerta del proyecto. Esta señal no confirma una emergencia ni establece la gravedad clínica del paciente.</Dialog.Description>
          <div className="flex flex-wrap justify-between gap-3 border-y border-[var(--border-subtle)] py-4 my-5"><p className="font-medium text-sm">{BADGES[predictedClass] ?? predictedClass}</p><p className="readout text-sm">Score IA {(confidence * 100).toFixed(1)}%</p></div>
          <p className="text-xs text-[var(--fg-muted)] mb-5">Score no calibrado. La prioridad definitiva corresponde al profesional responsable y al protocolo institucional vigente.</p>
          <Button onClick={onDismiss} className="w-full">Revisar resultado</Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
