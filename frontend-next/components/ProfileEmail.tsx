'use client'
import { useQuery } from '@tanstack/react-query'
import { EmailEditor } from './EmailEditor'

export function ProfileEmail() {
  const { data } = useQuery<{ email: string | null; role: string }>({
    queryKey: ['profile-email'],
    queryFn: async () => {
      const response = await fetch('/api/profile')
      if (!response.ok) throw new Error('No se pudo consultar el correo.')
      return response.json()
    },
  })
  if (!data) return null
  return (
    <details className="mb-5 border-b border-[var(--border)] pb-3 text-[var(--fg)]">
      <summary className="cursor-pointer text-sm">Correo de alertas</summary>
      <div className="mt-3 max-w-md">
        <EmailEditor initialEmail={data.email} required={data.role === 'admin'} endpoint="/api/profile" />
      </div>
    </details>
  )
}
