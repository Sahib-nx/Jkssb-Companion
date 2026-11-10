'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  GraduationCap,
  BookText,
  FileText,
  RotateCcw,
  CalendarDays,
  BarChart3,
  Settings,
  LogOut,
  BookOpen,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

interface DashboardNavProps {
  userEmail?: string
}

export function DashboardNav({ userEmail }: DashboardNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const links = [
    {
      name: 'Overview',
      href: '/dashboard',
      icon: LayoutDashboard,
      active: pathname === '/dashboard',
    },
    {
      name: 'Lecture Tracker',
      href: '/dashboard/tracker',
      icon: GraduationCap,
      active: pathname.startsWith('/dashboard/tracker'),
    },
    {
      name: 'My Lecture Notes',
      href: '/dashboard/lecture-notes',
      icon: BookText,
      active: pathname.startsWith('/dashboard/lecture-notes') || pathname.startsWith('/dashboard/lectures'),
    },
    {
      name: 'General Notes',
      href: '/dashboard/general-notes',
      icon: FileText,
      active: pathname.startsWith('/dashboard/general-notes'),
    },
    {
      name: 'Revision Centre',
      href: '/dashboard/revision',
      icon: RotateCcw,
      active: pathname.startsWith('/dashboard/revision'),
    },
    {
      name: 'Daily Planner',
      href: '/dashboard/planner',
      icon: CalendarDays,
      active: pathname.startsWith('/dashboard/planner'),
    },
    {
      name: 'Analytics',
      href: '/dashboard/analytics',
      icon: BarChart3,
      active: pathname.startsWith('/dashboard/analytics'),
    },
    {
      name: 'Settings',
      href: '/dashboard/settings',
      icon: Settings,
      active: pathname.startsWith('/dashboard/settings'),
    },
  ]

  return (
    <>
      {/* Top Mobile Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#0E1118] border-b border-zinc-800/80 sticky top-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">MTS Companion</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800/60"
          aria-label="Toggle Navigation"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-[#0E1118] border-r border-zinc-800/80 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="p-6 border-b border-zinc-800/70">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white">MTS Companion</h1>
                <p className="text-[11px] text-zinc-400 font-medium">JKSSB Prep Suite</p>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-4 space-y-1.5">
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              Main Menu
            </div>
            {links.map((link) => {
              const Icon = link.icon
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    link.active
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.name}</span>
                </Link>
              )
            })}
          </div>
        </div>

        {/* User profile & Logout */}
        <div className="p-4 border-t border-zinc-800/70 bg-[#0B0D12]/40">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="truncate pr-2">
              <p className="text-xs font-medium text-zinc-200 truncate">{userEmail || 'Aspirant'}</p>
              <p className="text-[11px] text-zinc-400">JKSSB Aspirant</p>
            </div>
          </div>
          <form action={logout}>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
              type="submit"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>
    </>
  )
}
