import { describe, it, expect } from 'vitest'
import { filterAnalyses, triageRank, type AnalysisRecord } from './analysis'

function mk(partial: Partial<AnalysisRecord>): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    userId: 'u1',
    userName: 'Dra. Pérez',
    createdAt: '2026-07-08T12:00:00.000Z',
    filename: 'torax.png',
    studyId: 'EST-20260708-001',
    projection: 'PA',
    clinicalIndication: null,
    patientAge: null,
    patientSex: null,
    dicomStudyHash: null,
    predictedClass: 'Pneumonia',
    confidence: 0.82,
    severity: 'critical',
    probabilities: { Pneumonia: 0.82 },
    positiveFindings: ['Pneumonia'],
    imageHash: null,
    modelVersion: 'ensemble-v1',
    processingTimeMs: 1200,
    feedback: null,
    ...partial,
  }
}

describe('filterAnalyses', () => {
  const records = [
    mk({ id: 'a', predictedClass: 'Pneumonia', severity: 'critical', feedback: null }),
    mk({ id: 'b', predictedClass: 'No Finding', severity: 'normal', feedback: { agrees: true, actualFinding: null, comment: null, createdAt: '2026-07-08T13:00:00.000Z' } }),
    mk({ id: 'c', predictedClass: 'Effusion', severity: 'high', studyId: 'EST-XYZ', feedback: { agrees: false, actualFinding: 'Atelectasis', comment: 'límite', createdAt: '2026-07-08T14:00:00.000Z' } }),
  ]

  it('sin filtros devuelve todo', () => {
    expect(filterAnalyses(records, {})).toHaveLength(3)
  })

  it('filtra por severidad', () => {
    expect(filterAnalyses(records, { severity: 'high' }).map((r) => r.id)).toEqual(['c'])
  })

  it('filtra por estado de validación', () => {
    expect(filterAnalyses(records, { feedback: 'pending' }).map((r) => r.id)).toEqual(['a'])
    expect(filterAnalyses(records, { feedback: 'agree' }).map((r) => r.id)).toEqual(['b'])
    expect(filterAnalyses(records, { feedback: 'disagree' }).map((r) => r.id)).toEqual(['c'])
  })

  it('busca por texto en studyId, filename, clase y radiólogo (case-insensitive)', () => {
    expect(filterAnalyses(records, { q: 'est-xyz' }).map((r) => r.id)).toEqual(['c'])
    expect(filterAnalyses(records, { q: 'pneumonia' }).map((r) => r.id)).toEqual(['a'])
    expect(filterAnalyses(records, { q: 'pérez' })).toHaveLength(3)
    expect(filterAnalyses(records, { q: 'inexistente' })).toHaveLength(0)
  })

  it('combina filtros', () => {
    expect(filterAnalyses(records, { severity: 'critical', feedback: 'agree' })).toHaveLength(0)
  })

  it('filtra por rango de fechas (inclusive, fecha local)', () => {
    const dated = [
      mk({ id: 'd1', createdAt: '2026-07-01T12:00:00.000Z' }),
      mk({ id: 'd2', createdAt: '2026-07-05T12:00:00.000Z' }),
      mk({ id: 'd3', createdAt: '2026-07-08T12:00:00.000Z' }),
    ]
    expect(filterAnalyses(dated, { dateFrom: '2026-07-05' }).map((r) => r.id)).toEqual(['d2', 'd3'])
    expect(filterAnalyses(dated, { dateTo: '2026-07-05' }).map((r) => r.id)).toEqual(['d1', 'd2'])
    expect(filterAnalyses(dated, { dateFrom: '2026-07-05', dateTo: '2026-07-05' }).map((r) => r.id)).toEqual(['d2'])
    expect(filterAnalyses(dated, { dateFrom: '2026-07-09' })).toHaveLength(0)
  })
})

describe('triageRank', () => {
  it('cualquier crítico va antes que cualquier alto', () => {
    expect(triageRank('critical', 0.31)).toBeLessThan(triageRank('high', 0.99))
  })

  it('a igual severidad, mayor confianza va primero', () => {
    expect(triageRank('critical', 0.9)).toBeLessThan(triageRank('critical', 0.5))
  })

  it('orden completo de severidades', () => {
    const ranks = [
      triageRank('critical', 0.5),
      triageRank('high', 0.5),
      triageRank('moderate', 0.5),
      triageRank('normal', 0.5),
    ]
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })
})
