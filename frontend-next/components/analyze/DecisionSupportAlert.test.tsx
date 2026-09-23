import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DecisionSupportAlert } from './DecisionSupportAlert'

const support = {
  status: 'discordant' as const,
  method: 'two_model_agreement_v1',
  focus_class: 'Effusion',
  ensemble_score: 0.54,
  threshold: 0.3,
  threshold_margin: 0.24,
  model_disagreement: 0.42,
  requires_heightened_review: true,
  calibrated_probability: false as const,
  reasons: ['Los modelos muestran una diferencia relevante.'],
  recommendation: 'Realizar revisión radiológica reforzada.',
}

describe('DecisionSupportAlert', () => {
  it('muestra el desacuerdo sin llamarlo probabilidad clínica', () => {
    render(<DecisionSupportAlert support={support} />)
    expect(screen.getByText('Desacuerdo entre los modelos')).toBeTruthy()
    expect(screen.getByText(/42.0 pp/)).toBeTruthy()
    expect(screen.getByText(/No es una probabilidad clínica calibrada/)).toBeTruthy()
  })

  it('no renderiza contenido para análisis históricos sin el campo', () => {
    const { container } = render(<DecisionSupportAlert />)
    expect(container.innerHTML).toBe('')
  })
})
