import type { Metadata } from 'next'
import './globals.css'
import NavBar from '@/components/NavBar'
import Providers from './providers'
import RaceSync from './components/RaceSync'

export const metadata: Metadata = {
  title: 'Boxenfunk – F1 Stats',
  description: 'F1 data. No fluff.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-background text-text-base font-sans antialiased">
        <Providers>
          <RaceSync />
          <NavBar />
          <main className="min-h-screen">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
