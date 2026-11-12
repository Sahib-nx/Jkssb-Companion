import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import Image from 'next/image'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getAuthenticatedUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="relative min-h-screen bg-[#0B0D12] text-zinc-100 flex flex-col md:flex-row">
      {/* 1. Cinematic Background Image Layer (Fixed across entire application and all sidebar options) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <Image
          src="/images/dashboard-bg.jpg"
          alt="Cinematic Moonlit Forest Study Atmosphere"
          fill
          priority
          quality={95}
          className="object-cover object-center opacity-85"
        />
        {/* Subtle vignette overlay protecting text readability while leaving the glowing moon, stars, storm clouds and forest clearly visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D12]/35 via-[#0B0D12]/55 to-[#0B0D12]/85" />
      </div>

      <DashboardNav userEmail={user.email} />
      <main className="relative z-10 flex-1 overflow-y-auto min-h-screen">
        <div className="max-w-7xl mx-auto p-3.5 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
