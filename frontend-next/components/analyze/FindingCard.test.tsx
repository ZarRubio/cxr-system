import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { NoFindingCard } from './FindingCard'

afterEach(cleanup)
it('does not declare a threshold-negative study normal', () => {
  render(<NoFindingCard />)
  expect(screen.getByRole('heading').textContent).toBe('Sin hallazgos sobre umbral')
  expect(screen.getByText(/Esto no confirma/)).toBeTruthy()
  expect(screen.queryByText('NORMAL')).toBeNull()
})
