import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { AppShell }  from '@/components/layout/AppShell'

const figtree = Figtree({
  subsets: ['latin'],
  variable: '--font-figtree',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
  weight: ['300', '400', '500', '700'],
})

export const metadata: Metadata = {
  title: 'CXR Classifier — HNAL',
  description: 'Sistema académico de apoyo diagnóstico en radiografía de tórax — Hospital Nacional Arzobispo Loayza 2026',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${figtree.variable} ${notoSans.variable} h-full`}
    >
      <body className="h-full flex antialiased" style={{ fontFamily: "'Figtree', 'Noto Sans', system-ui, sans-serif" }}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
