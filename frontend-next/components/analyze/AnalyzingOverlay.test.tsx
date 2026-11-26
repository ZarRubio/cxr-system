import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AnalyzingOverlay } from './AnalyzingOverlay'

afterEach(cleanup)

// Hallazgo H13: el modal de análisis debe poder cancelarse.
it('offers a cancel button that calls onCancel', () => {
  const onCancel = vi.fn()
  render(<AnalyzingOverlay filename="torax.png" onCancel={onCancel} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar análisis' }))
  expect(onCancel).toHaveBeenCalledTimes(1)
})

it('does not show a cancel button when no handler is provided', () => {
  render(<AnalyzingOverlay filename="torax.png" />)
  expect(screen.queryByRole('button', { name: 'Cancelar análisis' })).toBeNull()
})
