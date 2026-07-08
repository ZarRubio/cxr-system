'use client'
import { useEffect, useRef } from 'react'
import { AlertTriangle, Phone, X } from 'lucide-react'
import { BADGES, DESCRIPTIONS } from '@/lib/constants'

interface StatAlertProps {
  predictedClass: string
  confidence: number
  onDismiss: () => void
}

const STAT_MESSAGES: Record<string, string> = {
  Pneumothorax:
    'El modelo detecta posible neumotórax. Si es a tensión (desviación mediastinal, hipotensión, disnea severa), es emergencia médica inmediata.',
  Mass:
    'El modelo detecta una lesión mayor de 3 cm. Requiere estudio tomográfico urgente para caracterización y estadificación.',
  Edema:
    'El modelo detecta posible edema pulmonar. Evaluar signos de insuficiencia cardíaca aguda o causa no cardiogénica (SDRA).',
  Pneumonia:
    'El modelo detecta posible consolidación neumónica. En contexto HNAL Lima: descartar tuberculosis activa según protocolo local.',
}

export function StatAlert({ predictedClass, confidence, onDismiss }: StatAlertProps) {
  const badge   = BADGES[predictedClass] ?? predictedClass.toUpperCase()
  const message = STAT_MESSAGES[predictedClass] ?? DESCRIPTIONS[predictedClass] ?? ''
  const pct     = (confidence * 100).toFixed(1)
  const btnRef  = useRef<HTMLButtonElement>(null)

  // Focus dismiss button on mount; restore focus on unmount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    btnRef.current?.focus()
    return () => { prev?.focus() }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stat-alert-title"
      aria-describedby="stat-alert-body"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}
    >
      <div className="bg-white dark:bg-[#1a0505] border-2 border-[#DC2626] rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden animate-scale-in">

        {/* Header rojo */}
        <div className="bg-[#DC2626] px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={26} className="text-white shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p id="stat-alert-title" className="text-white font-extrabold text-lg leading-tight">
              HALLAZGO URGENTE — STAT
            </p>
            <p className="text-red-100 text-sm mt-0.5">Requiere evaluación médica inmediata</p>
          </div>
        </div>

        {/* Cuerpo */}
        <div id="stat-alert-body" className="px-5 py-5 space-y-4">

          {/* Badge + confianza */}
          <div className="flex items-center justify-between gap-3">
            <span className="bg-[#DC2626] text-white px-3 py-1.5 rounded text-xs font-extrabold uppercase tracking-widest">
              {badge}
            </span>
            <span className="readout text-3xl font-extrabold text-[#DC2626]" aria-label={`Probabilidad ${pct} por ciento`}>
              {pct}%
            </span>
          </div>

          {/* Mensaje clínico específico */}
          <p className="text-sm text-gray-700 dark:text-gray-200 leading-6">
            {message}
          </p>

          {/* Protocolo HNAL */}
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 flex items-start gap-2">
            <Phone size={14} className="text-[#DC2626] mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-5">
              <strong>Protocolo HNAL:</strong> Notificar al médico de guardia antes de continuar.
              Este sistema es de apoyo académico y no reemplaza la evaluación clínica certificada.
            </p>
          </div>

          <p className="text-[10px] text-gray-400 leading-4 italic">
            La probabilidad del modelo no equivale a certeza diagnóstica. Los hallazgos deben
            correlacionarse con la clínica, anamnesis y estudios complementarios.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            ref={btnRef}
            onClick={onDismiss}
            className="flex-1 bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#DC2626]"
          >
            <X size={16} aria-hidden="true" />
            Entendido — continuar análisis
          </button>
        </div>
      </div>
    </div>
  )
}
