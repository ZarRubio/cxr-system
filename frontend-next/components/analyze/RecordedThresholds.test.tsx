import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ProbabilityBars } from './ProbabilityBars'
import { SecondaryFindings } from './SecondaryFindings'
import { recordedThreshold } from '@/lib/recordedThreshold'
import type { Prediction } from '@/lib/types'

afterEach(cleanup)
const prediction: Prediction = {
  predicted_class: 'Emphysema', confidence: .82,
  probabilities: { Emphysema: .82, Pneumonia: .388 },
  positive_findings: ['Emphysema', 'Pneumonia'], processing_time_ms: 3141,
  thresholds_used: { Emphysema: .3, Pneumonia: .3 },
}

it('renders recorded thresholds instead of conflicting current model metadata', () => {
  render(<ProbabilityBars prediction={prediction} thresholds={{ Emphysema: .3, Pneumonia: .25 }} />)
  expect(screen.getAllByTitle('Umbral: 30%')).toHaveLength(2)
  expect(screen.queryByTitle('Umbral: 25%')).toBeNull()
})
it('uses the same recorded threshold for secondary findings', () => {
  render(<SecondaryFindings prediction={prediction} thresholds={{ Pneumonia: .25 }} />)
  expect(screen.getByText('(umbral 30%)')).toBeTruthy()
  expect(screen.queryByText('(umbral 25%)')).toBeNull()
})
it('does not invent a 30 percent threshold for historical bars with no recorded snapshot', () => {
  render(<ProbabilityBars prediction={{ ...prediction, thresholds_used: undefined }} thresholds={{ Pneumonia: .25 }} />)
  expect(screen.queryByTitle(/Umbral:/)).toBeNull()
  expect(screen.getAllByText('Umbral no registrado')).toHaveLength(2)
})
it('labels missing thresholds for secondary findings', () => {
  render(<SecondaryFindings prediction={{ ...prediction, thresholds_used: undefined }} />)
  expect(screen.getByText('(umbral no registrado)')).toBeTruthy()
})
it('validates each recorded threshold including zero', () => {
  expect(recordedThreshold({ thresholds_used: { X: 0 } }, 'X')).toBe(0)
  expect(recordedThreshold({ thresholds_used: { X: 1 } }, 'X')).toBe(1)
  for (const value of [-.1, 1.1, NaN, Infinity]) expect(recordedThreshold({ thresholds_used: { X: value } }, 'X')).toBeUndefined()
})
