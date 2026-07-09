import { describe, it, expect } from 'vitest'
import { buildPdf } from './pdf'
import type { Prediction } from './types'

const prediction: Prediction = {
  predicted_class: 'Effusion',
  confidence: 0.78,
  probabilities: { Effusion: 0.78, Cardiomegaly: 0.31, 'No Finding': 0.05 },
  positive_findings: ['Effusion'],
  processing_time_ms: 1234,
  image_hash: 'abc123def456',
  model_version: 'ensemble-v1v2-14classes',
  gradcam_image: '',
  gradcam_class: 'Effusion',
}

describe('buildPdf desde el historial (sin imagen)', () => {
  it('genera un PDF válido con originalBytes=null y feedback de discrepancia', async () => {
    const bytes = await buildPdf(
      'torax.dcm',
      null,
      prediction,
      '',
      {
        studyId: 'EST-20260709-001',
        projection: 'PA',
        clinicalIndication: 'disnea',
        radiologistName: 'Dra. Pérez',
        patientAge: 67,
        patientSex: 'F',
      },
      {
        agrees: false,
        actualFinding: 'Atelectasis',
        comment: 'placa límite, correlacionar',
        createdAt: '2026-07-09T12:00:00.000Z',
      },
    )
    expect(bytes.length).toBeGreaterThan(1000)
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })

  it('genera un PDF válido con concordancia y sin metadatos opcionales', async () => {
    const bytes = await buildPdf('img.png', null, prediction, 'nota del radiólogo', undefined, {
      agrees: true,
      actualFinding: null,
      comment: null,
      createdAt: '2026-07-09T12:00:00.000Z',
    })
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  })
})
