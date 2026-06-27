'use client'
import { create } from 'zustand'
import type { HistoryEntry } from '@/lib/types'
import { getSeverity } from '@/lib/utils'
import type { Prediction } from '@/lib/types'

interface SessionState {
  history: HistoryEntry[]
  totalAnalyses: number
  addEntry: (
    filename: string,
    prediction: Prediction,
    fileBytes?: Uint8Array,
    studyMeta?: HistoryEntry['studyMeta'],
  ) => void
  clearHistory: () => void
}

export const useSessionStore = create<SessionState>((set) => ({
  history: [],
  totalAnalyses: 0,

  addEntry(filename, prediction, fileBytes, studyMeta) {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      filename,
      predicted: prediction.predicted_class,
      confidence: prediction.confidence,
      severity: getSeverity(prediction.predicted_class),
      imageHash: prediction.image_hash,
      prediction,
      fileBytes,
      studyMeta,
    }
    set((s) => ({
      history: [entry, ...s.history],
      totalAnalyses: s.totalAnalyses + 1,
    }))
  },

  clearHistory() {
    set({ history: [], totalAnalyses: 0 })
  },
}))
