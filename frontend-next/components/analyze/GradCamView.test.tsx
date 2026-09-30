import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GradCamView } from './GradCamView'
import { blendImagesOnCanvas } from '@/lib/utils'
import type { Prediction } from '@/lib/types'
import { predict } from '@/lib/api'
vi.mock('@/lib/api', () => ({ predict: vi.fn() }))

vi.mock('@/lib/utils', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/utils')>(), blendImagesOnCanvas: vi.fn() }))
vi.mock('./ImageLightbox', () => ({ ImageLightbox: () => null }))
const prediction: Prediction = { predicted_class: 'Effusion', confidence: 0.7, probabilities: { Effusion: 0.7 }, positive_findings: ['Effusion'], processing_time_ms: 10, gradcam_image: 'data:image/png;base64,AA==', gradcam_heatmap: 'data:image/png;base64,AQ==', gradcam_class: 'Effusion' }
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
  const original = { ...prediction, gradcam_image: undefined, gradcam_heatmap: undefined, analysis_id: 'original-study' }
  const onUpdate = vi.fn()
  vi.mocked(predict).mockResolvedValue({ ...prediction, analysis_id: 'must-not-replace' })
  render(<GradCamView prediction={original} originalBytes={new Uint8Array([0])} filename="scan.dcm" onPredictionUpdate={onUpdate} />)
  fireEvent.click(screen.getByRole('button', { name: 'Generar mapa de calor' }))
  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  expect(onUpdate.mock.calls[0][0].analysis_id).toBe('original-study')
  expect(onUpdate.mock.calls[0][0].gradcam_heatmap).toBe(prediction.gradcam_heatmap)
  expect(predict).toHaveBeenCalledWith(expect.any(Uint8Array), 'scan.dcm', 'gradcam', true, { explanationId: 'original-study' })
})

it('blends the pure heatmap, never the server overlay, without requesting inference', async () => {
  vi.mocked(predict).mockClear()
  vi.mocked(blendImagesOnCanvas).mockResolvedValue('data:image/png;base64,bmV3')
  render(<GradCamView prediction={prediction} originalBytes={new Uint8Array([0])} />)
  await waitFor(() => expect(blendImagesOnCanvas).toHaveBeenCalledWith(new Uint8Array([0]), new Uint8Array([1]), .25))
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0' } })
  await waitFor(() => expect(blendImagesOnCanvas).toHaveBeenLastCalledWith(new Uint8Array([0]), new Uint8Array([1]), 0))
  expect(predict).not.toHaveBeenCalled()
  expect(screen.getByAltText('Radiografia sin mapa de calor')).toBeTruthy()
})

it('does not blend legacy overlays again or offer an inaccurate opacity slider', () => {
  vi.mocked(blendImagesOnCanvas).mockClear()
  render(<GradCamView prediction={{ ...prediction, gradcam_heatmap: undefined }} originalBytes={new Uint8Array([0])} />)
  expect(screen.queryByRole('slider')).toBeNull()
  expect(blendImagesOnCanvas).not.toHaveBeenCalled()
  expect(screen.getByAltText('Overlay Grad-CAM').getAttribute('src')).toBe(prediction.gradcam_image)
})
