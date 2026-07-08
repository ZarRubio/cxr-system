'use client'
import { useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { predict } from '@/lib/api'
import { useSessionStore } from '@/store/session'
import { buildPdf } from '@/lib/pdf'
import { downloadBlob } from '@/lib/utils'
import type { Prediction } from '@/lib/types'
import type { StudyMeta } from '@/lib/pdf'

function genStudyId() {
  const d = new Date()
  const date = d.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `EST-${date}-${rand}`
}

/**
 * Estado y acciones del flujo de análisis de una radiografía.
 * En caso de error, el archivo cargado se conserva para poder
 * reintentar el análisis con `handleAnalyze` (ver `canRetry`).
 */
export function useAnalyze() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined

  const [fileBytes, setFileBytes]   = useState<Uint8Array | null>(null)
  const [filename, setFilename]     = useState<string>('')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [analyzing, setAnalyzing]   = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [notes, setNotes]           = useState<string>('')
  const [showToast, setShowToast]   = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [statDismissed, setStatDismissed] = useState(false)
  const [studyMeta, setStudyMeta] = useState<StudyMeta>({
    studyId:            genStudyId(),
    projection:         'PA',
    clinicalIndication: '',
  })

  const resultsRef = useRef<HTMLDivElement>(null)
  const addEntry   = useSessionStore((s) => s.addEntry)

  const handleFile = useCallback((bytes: Uint8Array, name: string) => {
    setFileBytes(bytes)
    setFilename(name)
    setPrediction(null)
    setNotes('')
    setError(null)
    setStudyMeta((m) => ({ ...m, studyId: genStudyId() }))
  }, [])

  const clearFile = useCallback(() => {
    setFileBytes(null)
    setFilename('')
    setPrediction(null)
    setError(null)
  }, [])

  const handleLoadDemo = async () => {
    setLoadingDemo(true)
    try {
      const res = await fetch('/demo/demo_cardiomegaly.png')
      if (!res.ok) throw new Error('Demo no disponible')
      const buf = await res.arrayBuffer()
      handleFile(new Uint8Array(buf), 'demo_cardiomegaly.png')
    } catch {
      setError('No se pudo cargar la imagen de ejemplo.')
    } finally {
      setLoadingDemo(false)
    }
  }

  const handleAnalyze = async () => {
    if (!fileBytes || !filename) return
    setAnalyzing(true)
    setError(null)
    try {
      const result = await predict(fileBytes, filename, 'gradcam', true, {
        studyId:            studyMeta.studyId,
        projection:         studyMeta.projection,
        clinicalIndication: studyMeta.clinicalIndication,
      })
      setPrediction(result)
      setStatDismissed(false)
      addEntry(filename, result, fileBytes, {
        ...studyMeta,
        radiologistName: String(user?.name ?? ''),
        radiologistCmp:  String(user?.cmp  ?? ''),
      })
      setShowToast(true)
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch (e: unknown) {
      // El archivo se mantiene cargado: el usuario puede reintentar.
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!prediction || !fileBytes) return
    setPdfLoading(true)
    try {
      const meta: StudyMeta = {
        ...studyMeta,
        radiologistName: String(user?.name ?? ''),
        radiologistCmp:  String(user?.cmp  ?? ''),
      }
      const bytes = await buildPdf(filename, fileBytes, prediction, notes, meta)
      downloadBlob(bytes, `${studyMeta.studyId}_reporte_cxr.pdf`, 'application/pdf')
    } catch (e) {
      console.error('PDF error:', e)
    } finally {
      setPdfLoading(false)
    }
  }

  const reset = useCallback(() => {
    setFileBytes(null)
    setFilename('')
    setPrediction(null)
    setNotes('')
    setError(null)
    setStudyMeta({ studyId: genStudyId(), projection: 'PA', clinicalIndication: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const setMeta = useCallback((k: keyof StudyMeta, v: string) => {
    setStudyMeta((m) => ({ ...m, [k]: v }))
  }, [])

  return {
    // estado
    fileBytes, filename, prediction, analyzing, error,
    pdfLoading, notes, showToast, loadingDemo, statDismissed, studyMeta,
    user, resultsRef,
    /** true si hay un archivo cargado y se puede reintentar tras un error */
    canRetry: !!fileBytes,
    // acciones
    setNotes, setShowToast, setStatDismissed, setPrediction, setMeta,
    handleFile, clearFile, handleLoadDemo, handleAnalyze, handleDownloadPdf, reset,
  }
}
