import { describe, it, expect, beforeAll } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AnalysisRecord } from './analysis'

// Aislar la BD en un directorio temporal ANTES de importar el store
process.env.CXR_DATA_DIR = mkdtempSync(join(tmpdir(), 'cxr-test-'))

const { sqliteStore } = await import('./sqlite-store')

function mk(partial: Partial<AnalysisRecord>): AnalysisRecord {
  return {
    id: crypto.randomUUID(),
    userId: 'u1',
    userName: 'Dra. Pérez',
    createdAt: new Date().toISOString(),
    filename: 'torax.png',
    studyId: 'EST-20260708-001',
    projection: 'PA',
    clinicalIndication: null,
    patientAge: 58,
    patientSex: 'F',
    dicomStudyHash: 'ABC123DEF0',
    predictedClass: 'Pneumonia',
    confidence: 0.82,
    severity: 'critical',
    probabilities: { Pneumonia: 0.82, Effusion: 0.11 },
    positiveFindings: ['Pneumonia'],
    imageHash: 'abc123',
    modelVersion: 'ensemble-v1',
    processingTimeMs: 1200,
    feedback: null,
    ...partial,
  }
}

describe('sqliteStore — usuarios', () => {
  it('siembra el admin por defecto', async () => {
    const admin = await sqliteStore.getUserByUsername('admin')
    expect(admin).not.toBeNull()
    expect(admin!.role).toBe('admin')
  })

  it('crea, actualiza y borra usuarios', async () => {
    await sqliteStore.createUser({
      id: 'usr_t1', name: 'Test', username: 'test1', password: 'hash',
      role: 'radiologist', cmp: '12345', specialty: 'Radiología',
      active: true, createdAt: new Date().toISOString(),
    })
    expect((await sqliteStore.getUserById('usr_t1'))!.username).toBe('test1')

    const updated = await sqliteStore.updateUser('usr_t1', { active: false, name: 'Test B' })
    expect(updated!.active).toBe(false)
    expect(updated!.name).toBe('Test B')

    expect(await sqliteStore.deleteUser('usr_t1')).toBe(true)
    expect(await sqliteStore.getUserById('usr_t1')).toBeNull()
  })
})

describe('sqliteStore — análisis', () => {
  beforeAll(async () => {
    await sqliteStore.createAnalysis(mk({ id: 'an-1', userId: 'u1', createdAt: '2026-07-08T10:00:00.000Z' }))
    await sqliteStore.createAnalysis(mk({ id: 'an-2', userId: 'u1', createdAt: '2026-07-08T11:00:00.000Z' }))
    await sqliteStore.createAnalysis(mk({ id: 'an-3', userId: 'u2', createdAt: '2026-07-08T12:00:00.000Z' }))
  })

  it('recupera un análisis con su estructura completa', async () => {
    const a = await sqliteStore.getAnalysis('an-1')
    expect(a).not.toBeNull()
    expect(a!.probabilities.Pneumonia).toBeCloseTo(0.82)
    expect(a!.feedback).toBeNull()
  })

  it('lista por usuario en orden descendente', async () => {
    const own = await sqliteStore.listAnalyses({ userId: 'u1' })
    expect(own.map((a) => a.id)).toEqual(['an-2', 'an-1'])
  })

  it('lista todo para la vista admin', async () => {
    const all = await sqliteStore.listAnalyses({})
    expect(all.length).toBeGreaterThanOrEqual(3)
    expect(all[0].id).toBe('an-3')
  })

  it('registra y actualiza feedback', async () => {
    const fb = { agrees: false, actualFinding: 'Atelectasis', comment: 'placa límite', createdAt: new Date().toISOString() }
    const updated = await sqliteStore.setAnalysisFeedback('an-1', fb)
    expect(updated!.feedback!.agrees).toBe(false)
    expect(updated!.feedback!.actualFinding).toBe('Atelectasis')

    const again = await sqliteStore.setAnalysisFeedback('an-1', { ...fb, agrees: true, actualFinding: null })
    expect(again!.feedback!.agrees).toBe(true)
    expect(await sqliteStore.setAnalysisFeedback('inexistente', fb)).toBeNull()
  })
})
