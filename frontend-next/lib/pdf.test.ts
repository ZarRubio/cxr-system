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
  it('identifies the recording account without assigning it a professional signature', async () => {
    const bytes = await buildPdf('img.png', null, prediction, '', { radiologistName: 'Administrador', radiologistCmp: '999999' })
    const source = new TextDecoder('latin1').decode(bytes)
    expect(source).toContain('Registrado por')
    expect(source.match(/Administrador/g)).toHaveLength(1)
    expect(source).toContain('Profesional validador:')
    expect(source).not.toContain('CMP 999999')
  })
  it('paginates long notes and keeps a neutral institutional identity', async () => {
    const notes = 'Observación del radiólogo. '.repeat(190)
    const bytes = await buildPdf('img.png', null, prediction, notes)
    const source = new TextDecoder('latin1').decode(bytes)
    expect(source).not.toMatch(/Loayza|HNAL|Arzobispo/)
    expect((source.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(2)
  })
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
  it('includes every class score without arbitrary confidence categories or reference diagnoses', async () => {
    const bytes = await buildPdf('img.png', null, { ...prediction, analysis_id: 'study-123', explanation: { summary: 'REFERENCE_ONLY' } })
    const source = new TextDecoder('latin1').decode(bytes)
    expect(source).toContain('study-123')
    expect(source).toContain('78.0%')
    expect(source).toContain('31.0%')
    expect(source).toContain('5.0%')
    expect(source).not.toContain('Score moderado')
    expect(source).not.toContain('REFERENCE_ONLY')
  })
  it('flags a secondary critical finding even when the primary is not critical', async () => {
    const bytes = await buildPdf('img.png', null, { ...prediction, probabilities: { Effusion: .78, Pneumothorax: .6 }, positive_findings: ['Effusion', 'Pneumothorax'] })
    expect(new TextDecoder('latin1').decode(bytes)).toContain('ALERTA IA')
  })
})
