import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { fetchAnalyses, fetchAllAnalyses } from '@/lib/api'
import HistoryPage from './page'

vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('q=missing') }))
vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { id: 'u1' } } }) }))
vi.mock('@/lib/api', () => ({ fetchAnalyses: vi.fn(), fetchAllAnalyses: vi.fn(), retryAnalysisEmail: vi.fn() }))
vi.mock('@/lib/pdf', () => ({ buildPdf: vi.fn() }))
vi.mock('@/components/analyze/FeedbackCard', () => ({ FeedbackCard: () => null }))

afterEach(() => { cleanup(); vi.resetAllMocks() })

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><HistoryPage /></QueryClientProvider>)
}

it('keeps filters available when a search returns no studies', async () => {
  vi.mocked(fetchAnalyses).mockResolvedValue({ analyses: [], isAdmin: false, nextCursor: null })
  renderPage()
  expect(await screen.findByText('Sin resultados para estos filtros')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'Buscar estudios' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }))
  expect(await screen.findByText('Aún no hay estudios registrados')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Nuevo estudio' }).getAttribute('href')).toBe('/analyze')
})

it('preserves the search field during loading', () => {
  vi.mocked(fetchAnalyses).mockReturnValue(new Promise(() => {}))
  renderPage()
  expect(screen.getByRole('textbox', { name: 'Buscar estudios' })).toBeTruthy()
  expect(screen.getByText('Cargando estudios…')).toBeTruthy()
})

it('offers a retry when loading fails', async () => {
  vi.mocked(fetchAnalyses).mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ analyses: [], isAdmin: false })
  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))
  expect(await screen.findByText('Sin resultados para estos filtros')).toBeTruthy()
})

it('disables duplicate exports and shows failures', async () => {
  vi.mocked(fetchAnalyses).mockResolvedValue({ analyses: [], isAdmin: false })
  let reject!: (error: Error) => void
  vi.mocked(fetchAllAnalyses).mockReturnValue(new Promise((_, fail) => { reject = fail }))
  renderPage()
  const button = await screen.findByRole('button', { name: 'CSV' })
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(button)
  expect((screen.getByRole('button', { name: 'JSON' }) as HTMLButtonElement).disabled).toBe(true)
  reject(new Error('Exportación no disponible'))
  expect(await screen.findByRole('alert')).toBeTruthy()
})
