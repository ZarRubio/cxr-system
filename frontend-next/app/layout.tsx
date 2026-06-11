import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/layout/Providers'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Header } from '@/components/layout/Header'

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
          <Sidebar />
          <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
              <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
                {children}
              </div>
            </main>
          </div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  )
}
