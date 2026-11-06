import type { Prediction } from '@/lib/types'

export function recordedThreshold(prediction: Pick<Prediction, 'thresholds_used'>, className: string): number | undefined {
  const value = prediction.thresholds_used?.[className]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
}
