import { ApiError, predictBatch, type BatchResultItem } from './api'

export interface BatchFile {
  bytes: Uint8Array
  name: string
}

/** Avance del lote: placas ya procesadas, total y placa en curso (null al terminar). */
export interface BatchProgress {
  completed: number
  total: number
  current: string | null
}

export interface BatchOutcome {
  items: BatchResultItem[]
  batchId: string
  /** true si el usuario canceló antes de procesar todas las placas. */
  cancelled: boolean
}

/** ID de lote con el mismo formato que genera el servidor: LOTE-YYYYMMDD-nnn. */
export function newBatchId(now: Date = new Date(), random: () => number = Math.random): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `LOTE-${stamp}-${String(Math.floor(random() * 1000)).padStart(3, '0')}`
}

interface RunOptions {
  signal?: AbortSignal
  batchId?: string
  onProgress?: (progress: BatchProgress) => void
  /** Inyectable para pruebas; por defecto envía cada placa a /api/predict-batch. */
  analyze?: typeof predictBatch
}

/**
 * Hallazgo H12: analiza el lote placa por placa para informar el avance real
 * («placa 3 de 8») y permitir cancelar conservando lo ya analizado.
 *
 * Todas las solicitudes comparten el mismo ID de lote, de modo que el historial
 * agrupa el lote completo. Si una placa falla, se registra su error y se sigue con
 * las demás; solo una sesión vencida (401) interrumpe el lote.
 */
export async function runBatchByPlate(files: BatchFile[], options: RunOptions = {}): Promise<BatchOutcome> {
  const { signal, onProgress, analyze = predictBatch } = options
  const batchId = options.batchId ?? newBatchId()
  const items: BatchResultItem[] = []
  let cancelled = false

  for (const file of files) {
    if (signal?.aborted) { cancelled = true; break }
    onProgress?.({ completed: items.length, total: files.length, current: file.name })
    try {
      const response = await analyze([file], { signal, batchId })
      items.push(...response.results)
    } catch (error) {
      if (signal?.aborted) { cancelled = true; break }
      if (error instanceof ApiError && error.status === 401) throw error
      items.push({
        filename: file.name,
        result: null,
        error: error instanceof Error ? error.message : 'Error de análisis',
      })
    }
  }

  onProgress?.({ completed: items.length, total: files.length, current: null })
  return { items, batchId, cancelled }
}
