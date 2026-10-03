import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { fetchModelInfo } from '@/lib/api'
import ModelPage from './page'
import type { ModelInfo } from '@/lib/types'

vi.mock('@/lib/api', () => ({ fetchModelInfo: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ModelPage /></QueryClientProvider>)
}

function fixedThresholdInfo(): ModelInfo {
  const thresholds = {
    Atelectasis: .3, Cardiomegaly: .3, Consolidation: .3, Edema: .3,
    Effusion: .3, Emphysema: .3, Fibrosis: .3, Hernia: .3, Infiltration: .25,
    Mass: .3, Nodule: .3, Pleural_Thickening: .3, Pneumonia: .25, Pneumothorax: .3,
  }
  const perClass = Object.fromEntries(Object.entries(thresholds).map(([cls, threshold]) => [cls, {
    threshold, sensitivity: 21 / 25, specificity: 1934 / 3998, precision: 21 / 2085,
    npv: 1934 / 1938, f1: 42 / 2110, tp: 21, fp: 2064, tn: 1934, fn: 4,
    n_positive: 25, n_negative: 3998,
  }]))
  return {
    thresholds,
    threshold_evaluation: {
      status: 'available', scope: 'retrospective_historical_test', dataset: 'NIH ChestX-ray14',
      n_images: 4023, n_patients: 4023, evaluation_date: '2026-10-03', temperature: 1,
      weights: [.3, .7], thresholds, per_class: perClass,
    },
  }
}

it('shows linked historical evidence with class support', async () => {
  vi.mocked(fetchModelInfo).mockResolvedValue({
    auc_macro: 0.8044989191922561,
    val_auc_macro: 0.7990317790600593,
    test_map: 0.1521846954740413,
    test_images: 4023,
    metrics_provenance: 'local_reproduced_historical_test',
    metrics: { Pneumonia: { auc: 0.712036, ap: 0.012622, n_positive: 25 } },
  })
  renderPage()

  expect(await screen.findByText('Test histórico reproducido')).toBeTruthy()
  expect(screen.getByText('0.804')).toBeTruthy()
  const pneumonia = screen.getAllByRole('row', { name: /Pneumonia/ })[0]
  expect(pneumonia.textContent).toContain('0.712')
  expect(pneumonia.textContent).toContain('0.013')
  expect(pneumonia.textContent).toContain('25')
})

it('hides performance numbers when artifacts are not linked', async () => {
  vi.mocked(fetchModelInfo).mockResolvedValue({
    auc_macro: null,
    val_auc_macro: null,
    test_map: null,
    metrics: {},
    metrics_provenance: 'not_linked_to_running_artifacts',
  })
  renderPage()

  expect(await screen.findByText(/Las métricas por clase se ocultan/)).toBeTruthy()
  expect(screen.getAllByText('Sin vínculo por hash')).toHaveLength(3)
  expect(screen.queryByText('0.804')).toBeNull()
})

it('shows all fixed operating points, counts and the historical scope', async () => {
  vi.mocked(fetchModelInfo).mockResolvedValue(fixedThresholdInfo())
  renderPage()
  expect(await screen.findByText(/equivalencia con la API no verificada/)).toBeTruthy()
  expect(screen.queryByText('No calculada')).toBeNull()
  const pneumonia = screen.getAllByRole('row', { name: /Pneumonia/ })[1]
  expect(pneumonia.textContent).toContain('84.0%')
  expect(pneumonia.textContent).toContain('48.4%')
  expect(pneumonia.textContent).toContain('1.0%')
  expect(pneumonia.textContent).toContain('25.0%')
  expect(pneumonia.textContent).toContain('21 / 4')
  expect(pneumonia.textContent).toContain('2064 / 1934')
})

it('does not display a metric evaluated at another threshold', async () => {
  const info = fixedThresholdInfo()
  info.thresholds = { ...info.thresholds, Pneumonia: .3 }
  vi.mocked(fetchModelInfo).mockResolvedValue(info)
  renderPage()
  await screen.findByText(/equivalencia con la API no verificada/)
  const pneumonia = screen.getAllByRole('row', { name: /Pneumonia/ })[1]
  expect(pneumonia.textContent).toContain('No calculada')
  expect(pneumonia.textContent).not.toContain('84.0%')
})

it('shows pending evidence instead of reusing unlinked or legacy rates', async () => {
  vi.mocked(fetchModelInfo).mockResolvedValue({
    ...fixedThresholdInfo(), threshold_evaluation: { status: 'unavailable' },
    metrics: { Pneumonia: { sensitivity: .84, specificity: .48 } },
  })
  renderPage()
  expect(await screen.findByText(/No hay una evaluación compatible/)).toBeTruthy()
  const pneumonia = screen.getAllByRole('row', { name: /Pneumonia/ })[1]
  expect(pneumonia.textContent).toContain('No calculada')
  expect(pneumonia.textContent).not.toContain('84.0%')
})
