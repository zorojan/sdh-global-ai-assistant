import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '../lib/auth-context'
import ReactQueryProvider from '../lib/react-query-provider'

export const metadata: Metadata = {
  title: 'SDH Global AI Assistant - Admin Panel',
  description: 'Административная панель для управления AI ассистентом',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-inter">
        <ReactQueryProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
