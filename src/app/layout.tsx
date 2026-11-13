import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Study Companion — Your Learning. Your Progress. Your Plan.',
  description:
    'A comprehensive study management, syllabus tracking, active revision, and AI planning platform for any examination, subject, or learning goal.',
  openGraph: {
    title: 'Study Companion — Your Learning. Your Progress. Your Plan.',
    description:
      'A comprehensive study management, syllabus tracking, active revision, and AI planning platform for any examination, subject, or learning goal.',
    siteName: 'Study Companion',
  },
}

import { ToastProvider } from '@/components/ui/toast'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#0B0D12] text-zinc-100 antialiased selection:bg-blue-600 selection:text-white`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
