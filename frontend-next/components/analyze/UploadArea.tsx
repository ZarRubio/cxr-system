'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_BYTES = 15 * 1024 * 1024
const MIN_BYTES = 1 * 1024
const ACCEPTED = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'application/dicom': ['.dcm'], 'application/octet-stream': ['.dcm'] }

interface UploadAreaProps {
  onFile: (bytes: Uint8Array, filename: string) => void
  currentFilename?: string
  onClear?: () => void
  disabled?: boolean
}

export function UploadArea({ onFile, currentFilename, onClear, disabled = false }: UploadAreaProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setError(null)
    const file = accepted[0]
    if (!file) return
    if (file.size < MIN_BYTES) { setError('El archivo es demasiado pequeño.'); return }
    if (file.size > MAX_BYTES) { setError('La imagen supera el límite de 15 MB.'); return }

    const reader = new FileReader()
    reader.onerror = () => setError('No se pudo leer el archivo. Vuelva a seleccionarlo.')
    reader.onload = (e) => {
      const bytes = new Uint8Array(e.target!.result as ArrayBuffer)
      onFile(bytes, file.name)
    }
    reader.readAsArrayBuffer(file)
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    multiple: false,
    minSize: MIN_BYTES,
    maxSize: MAX_BYTES,
    disabled,
    onDropRejected: (files) => {
      const code = files[0]?.errors[0]?.code
      setError(code === 'file-too-large' ? 'La imagen supera el límite de 15 MB.' : code === 'file-too-small' ? 'El archivo es demasiado pequeño.' : 'Seleccione una imagen PNG, JPG o DICOM a la vez.')
    },
  })

  if (currentFilename) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3">
        <FileImage size={20} className="text-[var(--primary)] shrink-0" />
        <span className="text-sm text-[var(--fg)] font-medium flex-1 truncate">{currentFilename}</span>
        <button
          onClick={onClear}
          className="icon-button disabled:opacity-50"
          disabled={disabled}
          aria-label="Quitar imagen"
        >
          <X size={16} />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div
        {...getRootProps({ role: 'button' })}
        aria-disabled={disabled}
        aria-label="Zona de carga: arrastra una radiografía de tórax o haz clic para seleccionar"
        className={cn(
          'flex flex-col items-center justify-center gap-4 min-h-56 py-8 px-6 rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] cursor-pointer transition-colors',
          'hover:border-[var(--primary)] hover:bg-[var(--surface2)]',
          isDragActive && 'border-[var(--primary)] bg-[var(--surface2)]',
          disabled && 'opacity-50 pointer-events-none',
        )}
      >
        <input {...getInputProps()} aria-label="Cargar radiografía de tórax" />
        <div className={cn(
          'w-10 h-10 flex items-center justify-center text-[var(--primary)]',
        )}>
          <Upload size={22} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--fg)]">
            {isDragActive ? 'Soltar radiografía' : 'Seleccionar radiografía'}
          </p>
          <p className="text-xs text-[var(--fg-subtle)] mt-1">
            PNG · JPG · DICOM (.dcm) · Máx. 15 MB
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="flex items-center gap-2 text-sm badge-critical rounded-md px-3 py-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
    </div>
  )
}
