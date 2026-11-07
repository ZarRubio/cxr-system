import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { ClinicalRecommendations } from './ClinicalRecommendations'
import type { Prediction } from '@/lib/types'

const base = { predicted_class: 'Effusion' } as Prediction
afterEach(cleanup)

it('shows the per-finding guidance sent by the backend', () => {
  render(<ClinicalRecommendations prediction={{ ...base, explanation: {
    summary: 'El modelo puede estar respondiendo a opacidades basales.',
    visual: 'Revise si el mapa resalta las bases pulmonares.',
    clinical: 'Confirmar en la imagen original.',
  } }} />)
  expect(screen.getByText('El modelo puede estar respondiendo a opacidades basales.')).toBeTruthy()
  expect(screen.getByText('Revise si el mapa resalta las bases pulmonares.')).toBeTruthy()
  expect(screen.getByText('Confirmar en la imagen original.')).toBeTruthy()
})

it('keeps the generic guidance when a stored study has no explanation', () => {
  render(<ClinicalRecommendations prediction={base} />)
  expect(screen.queryByText('Qué puede estar captando el modelo')).toBeNull()
  expect(screen.getByText(/no determina conducta terapéutica/)).toBeTruthy()
})
