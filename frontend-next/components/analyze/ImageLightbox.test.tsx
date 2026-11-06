import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ImageLightbox } from './ImageLightbox'

afterEach(cleanup)
const props = {
  originalSrc: 'data:image/png;base64,AA==',
  blendedSrc: 'data:image/png;base64,AQ==',
  gradcamClass: 'Effusion',
  opacity: 0.25,
  onOpacityChange: vi.fn(),
  onClose: vi.fn(),
}

it('exposes a named modal, close button and opacity control', () => {
  render(<ImageLightbox {...props} />)
  const modal = screen.getByRole('dialog', { name: 'Visor ampliado del mapa Grad-CAM' })
  expect(modal.getAttribute('aria-modal')).toBe('true')
  expect(screen.getByRole('button', { name: 'Cerrar visor del mapa' })).toBeTruthy()
  expect(screen.getByRole('slider', { name: 'Opacidad del mapa ampliado' })).toBeTruthy()
})

it('puts keyboard focus on the close control', () => {
  render(<ImageLightbox {...props} />)
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar visor del mapa' }))
})

it('closes with the named button', () => {
  const onClose = vi.fn()
  render(<ImageLightbox {...props} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor del mapa' }))
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('closes with Escape through the dialog primitive', () => {
  const onClose = vi.fn()
  render(<ImageLightbox {...props} onClose={onClose} />)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar visor del mapa' }), { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

it('returns focus to the opener when the viewer closes', async () => {
  function Harness() {
    const [open, setOpen] = useState(false)
    return <><button onClick={() => setOpen(true)}>Abrir visor</button>{open && <ImageLightbox {...props} onClose={() => setOpen(false)} />}</>
  }
  render(<Harness />)
  const opener = screen.getByRole('button', { name: 'Abrir visor' })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar visor del mapa' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(opener))
})

it('changes opacity without invoking close', () => {
  const onOpacityChange = vi.fn(), onClose = vi.fn()
  render(<ImageLightbox {...props} onOpacityChange={onOpacityChange} onClose={onClose} />)
  fireEvent.change(screen.getByRole('slider', { name: 'Opacidad del mapa ampliado' }), { target: { value: '50' } })
  expect(onOpacityChange).toHaveBeenCalledWith(0.5)
  expect(onClose).not.toHaveBeenCalled()
})

it('retains zoom and reset behavior', () => {
  render(<ImageLightbox {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Acercar' }))
  expect(screen.getByText('125%')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Restablecer vista' }))
  expect(screen.getByText('100%')).toBeTruthy()
})
