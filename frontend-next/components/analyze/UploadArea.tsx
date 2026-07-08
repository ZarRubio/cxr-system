'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_BYTES = 15 * 1024 * 1024
const MIN_BYTES = 1 * 1024
const ACCEPTED = { 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'application/octet-stream': ['.dcm'] }

interface UploadAreaProps {
  onFile: (bytes: Uint8Array, filename: string) => void
  currentFilename?: string
  onClear?: () => void
}

export function UploadArea({ onFile, currentFilename, onClear }: UploadAreaProps) {
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((accepted: File[]) => {
    setError(null)
    const file = accepted[0]
    if (!file) return
    if (file.size < MIN_BYTES) { setError('El archivo es demasiado pequeño.'); return }
    if (file.size > MAX_BYTES) { setError('La imagen supera el límite de 15 MB.'); return }

    const reader = new FileReader()
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
  })

  if (currentFilename) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3">
        <FileImage size={20} className="text-[var(--primary)] shrink-0" />
        <span className="text-sm text-[var(--fg)] font-medium flex-1 truncate">{currentFilename}</span>
        <button
          onClick={onClear}
          className="text-[var(--fg-subtle)] hover:text-[var(--fg)] transition-colors p-1 rounded cursor-pointer"
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
        {...getRootProps()}
        aria-label="Zona de carga: arrastra una radiografía de tórax o haz clic para seleccionar"
        className={cn(
          'card flex flex-col items-center justify-center gap-3 py-10 px-6 cursor-pointer transition-all duration-150',
          'border-2 border-dashed hover:border-[var(--primary)] hover:bg-[#F0FDFA]',
          isDragActive && 'border-[var(--primary)] bg-[#E0F7FA] scale-[1.01]',
          'dark:hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)] dark:border-dashed',
        )}
      >
        <input {...getInputProps()} aria-label="Cargar radiografía de tórax" />
        <div className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
          isDragActive ? 'bg-[var(--primary)] text-white' : 'bg-[var(--muted,#E8F1F6)] text-[var(--primary)]',
        )}>
          <Upload size={22} />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--fg)]">
            {isDragActive ? 'Suelta la imagen aquí' : 'Arrastra una radiografía o haz clic'}
          </p>
          <p className="text-xs text-[var(--fg-subtle)] mt-1">
            PNG · JPG · DICOM (.dcm) · Máx. 15 MB
          </p>
          <p className="text-xs text-[var(--fg-subtle)]">La imagen no se almacena en el servidor</p>
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
    </div>
  )
}
