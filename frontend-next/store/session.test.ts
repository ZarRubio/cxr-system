import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from './session'
import type { Prediction } from '@/lib/types'

const fakePrediction: Prediction = {
  predicted_class: 'Effusion',
  confidence: 0.91,
  probabilities: { Effusion: 0.91 },
  positive_findings: ['Effusion'],
  processing_time_ms: 120,
}

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.getState().clearHistory()
  })

  it('agrega entradas al historial y cuenta análisis', () => {
    useSessionStore.getState().addEntry('img.png', fakePrediction)
    const state = useSessionStore.getState()
    expect(state.history).toHaveLength(1)
    expect(state.history[0].filename).toBe('img.png')
    expect(state.history[0].predicted).toBe('Effusion')
    expect(state.totalAnalyses).toBe(1)
  })

  it('clearHistory vacía el historial', () => {
    useSessionStore.getState().addEntry('img.png', fakePrediction)
    useSessionStore.getState().clearHistory()
    expect(useSessionStore.getState().history).toHaveLength(0)
  })
})
