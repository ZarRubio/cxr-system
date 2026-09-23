import { describe, expect, it } from 'vitest'
import { csvCell } from './utils'
import { buildAnalysisRecord, predictionSeverity } from './data/analysis'
import type { Prediction } from './types'

const prediction: Prediction = { predicted_class: 'Atelectasis', confidence: 0.8, probabilities: { Atelectasis: 0.8, Pneumothorax: 0.4 }, positive_findings: ['Atelectasis', 'Pneumothorax'], processing_time_ms: 10 }

describe('review regressions', () => {
  it('prioritizes secondary critical findings, not only the highest score', () => {
    expect(predictionSeverity(prediction)).toBe('critical')
    expect(predictionSeverity({ ...prediction, positive_findings: ['Atelectasis', 'Effusion'] })).toBe('high')
  })
  it.each(['=1+1', '+SUM(A1)', '-1+1', '@SUM(A1)', '  =1', '\t1'])('escapes spreadsheet formula input %s', value => {
    expect(csvCell(value)).toBe(`"'${value}"`)
  })
  it('preserves ordinary CSV values and escapes quotes', () => {
    expect(csvCell('EST-01')).toBe('"EST-01"')
    expect(csvCell('a"b')).toBe('"a""b"')
  })
  it('persists warnings and screening without storing image pixels', () => {
    const p: Prediction = { ...prediction, image_warnings: ['Verificar proyección'], image_preview: 'data:image/png;base64,pixels', cxr_screening: { status: 'uncertain', score: 0.5, method: 'heuristic', reasons: ['Verificar'] } }
    const record = buildAnalysisRecord({ id: 'test', name: 'Test' }, p, { filename: 'test.dcm' })
    expect(record.imageWarnings).toEqual(p.image_warnings)
    expect(record.cxrScreening).toEqual(p.cxr_screening)
    expect(JSON.stringify(record)).not.toContain('pixels')
  })
})
