// @vitest-environment node
import { writeFileSync, readFileSync } from 'node:fs'
import { it, expect } from 'vitest'
import { buildPdf } from '../lib/pdf'
import { BADGES } from '../lib/constants'

it('builds the report layout verification fixture', async () => {
  const preview = readFileSync(new URL('../public/demo/demo_cardiomegaly.png', import.meta.url))
  const classes = Object.keys(BADGES).filter(name => name !== 'No Finding')
  const probabilities = Object.fromEntries(classes.map((name, index) => [name, index === 0 ? .81 : .1 + index / 100]))
  const thresholds = Object.fromEntries(classes.map(name => [name, .3]))
  const bytes = await buildPdf('demo.png', preview, {
    predicted_class: classes[0], confidence: .81, probabilities, positive_findings: [classes[0]], processing_time_ms: 200,
    model_version: `ensemble:${'a'.repeat(64)}:xrv224-v1`, image_hash: 'b'.repeat(64), thresholds_used: thresholds,
    image_preview: `data:image/png;base64,${preview.toString('base64')}`, gradcam_image: '',
  }, 'Reporte de prueba de interfaz, no constituye un resultado real. '.repeat(35), {
    studyId: 'QA-REPORT-001', projection: 'PA', clinicalIndication: 'Prueba de presentacion', radiologistName: 'Usuario de prueba',
  }, { agrees: true, actualFinding: null, comment: 'Prueba de maquetacion.', reviewPriority: 'routine', createdAt: '2026-09-30T12:00:00Z' })
  expect(String.fromCharCode(...bytes.slice(0, 5))).toBe('%PDF-')
  if (process.env.CXR_REVIEW_PDF_PATH) writeFileSync(process.env.CXR_REVIEW_PDF_PATH, bytes)
})
