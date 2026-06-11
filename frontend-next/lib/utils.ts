import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { SEVERITY_MAP } from './constants'
import type { Severity } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getSeverity(className: string): Severity {
  return SEVERITY_MAP[className] ?? 'moderate'
}

export function formatConfidence(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Converts a Uint8Array to a fresh ArrayBuffer (avoids SharedArrayBuffer issues) */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

export function decodeDataUri(dataUri: string): Uint8Array {
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function blendImagesOnCanvas(
  originalBytes: Uint8Array,
  gradcamBytes: Uint8Array,
  opacity: number,
): Promise<string> {
  const toBlob = (bytes: Uint8Array) =>
    new Blob([toArrayBuffer(bytes)], { type: 'image/png' })

  const loadImage = (blob: Blob): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(blob)
    })

  const [orig, cam] = await Promise.all([
    loadImage(toBlob(originalBytes)),
    loadImage(toBlob(gradcamBytes)),
  ])

  const size = 224
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.drawImage(orig, 0, 0, size, size)
  ctx.globalAlpha = opacity
  ctx.drawImage(cam, 0, 0, size, size)
  ctx.globalAlpha = 1

  return canvas.toDataURL('image/png')
}

export function downloadBlob(data: Uint8Array | string, filename: string, mime: string) {
  const blob = typeof data === 'string'
    ? new Blob([data], { type: mime })
    : new Blob([toArrayBuffer(data)], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
