import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LoginPage from './page'

let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('next-auth/react', () => ({ signIn: vi.fn() }))

afterEach(() => { cleanup(); search = '' })

it('submits the native form with POST so credentials never go into the URL', () => {
  const { container } = render(<LoginPage />)
  expect(container.querySelector('form')?.getAttribute('method')).toBe('post')
})

it('explains why the session was closed when the account became inactive', () => {
  search = 'reason=inactive'
  render(<LoginPage />)
  expect(screen.getByRole('status').textContent).toContain('la cuenta fue deshabilitada o su contraseña cambió')
})

it('shows no notice on a normal visit', () => {
  render(<LoginPage />)
  expect(screen.queryByRole('status')).toBeNull()
})
