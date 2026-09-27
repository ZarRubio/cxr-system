import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GradCamView } from './GradCamView'
import { blendImagesOnCanvas } from '@/lib/utils'
import type { Prediction } from '@/lib/types'
import { predict } from '@/lib/api'
vi.mock('@/lib/api', () => ({ predict: vi.fn() }))

vi.mock('@/lib/utils', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/utils')>(), blendImagesOnCanvas: vi.fn() }))
vi.mock('./ImageLightbox', () => ({ ImageLightbox: () => null }))
const prediction: Prediction = { predicted_class: 'Effusion', confidence: 0.7, probabilities: { Effusion: 0.7 }, positive_findings: ['Effusion'], processing_time_ms: 10, gradcam_image: 'data:image/png;base64,AA==', gradcam_class: 'Effusion' }
beforeEach(() => {
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

it('ignores an obsolete blend when the opacity changes quickly', async () => {
  const pending: Array<(value: string) => void> = []
  vi.mocked(blendImagesOnCanvas).mockImplementation(() => new Promise(resolve => pending.push(resolve)))
  render(<GradCamView prediction={prediction} originalBytes={new Uint8Array([0])} />)
  await waitFor(() => expect(pending).toHaveLength(1))
  fireEvent.change(screen.getByRole('slider'), { target: { value: '20' } })
  await waitFor(() => expect(pending).toHaveLength(2))
  await act(async () => pending[1]('data:image/png;base64,bmV3'))
  await act(async () => pending[0]('data:image/png;base64,b2xk'))
  expect(screen.getByAltText('Overlay Grad-CAM').getAttribute('src')).toBe('data:image/png;base64,bmV3')
})

it('shows a useful error and the server map when the original cannot be decoded', async () => {
  vi.mocked(blendImagesOnCanvas).mockRejectedValue(new Error('decode failed'))
  render(<GradCamView prediction={prediction} originalBytes={new Uint8Array([0])} />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByAltText('Overlay Grad-CAM').getAttribute('src')).toBe(prediction.gradcam_image)
})

it('preserves study metadata and email state when generating a map', async () => {
  const original = { ...prediction, gradcam_image: undefined, analysis_id: 'original-study' }
  const onUpdate = vi.fn()
  vi.mocked(predict).mockResolvedValue({ ...prediction, analysis_id: 'must-not-replace' })
  render(<GradCamView prediction={original} originalBytes={new Uint8Array([0])} filename="scan.dcm" onPredictionUpdate={onUpdate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Generar mapa de calor' }))
  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  expect(onUpdate.mock.calls[0][0].analysis_id).toBe('original-study')
  expect(predict).toHaveBeenCalledWith(expect.any(Uint8Array), 'scan.dcm', 'gradcam', true, { explanationId: 'original-study' })
})
