import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { fetchModelInfo } from '@/lib/api'
import ModelPage from './page'

vi.mock('@/lib/api', () => ({ fetchModelInfo: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><ModelPage /></QueryClientProvider>)
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
