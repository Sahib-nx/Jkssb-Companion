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
  Loader2,
} from 'lucide-react'
import { useState } from 'react'

interface DashboardNavProps {
  userEmail?: string
}

export function DashboardNav({ userEmail }: DashboardNavProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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

  const activePageName = links.find((l) => l.active)?.name || 'Overview'

  return (
    <>
      {/* Top Mobile Bar */}
      <div className="md:hidden flex items-center justify-between px-3.5 py-3 bg-[#0E1118]/85 backdrop-blur-xl border-b border-white/10 sticky top-0 z-30">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="truncate">
            <span className="font-semibold text-xs text-white tracking-tight block truncate">
              Study Companion
            </span>
            <span className="text-[10px] text-blue-400 font-medium block truncate">
              {activePageName}
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label="Toggle Navigation Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden animate-in fade-in duration-150"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-[100dvh] w-72 max-w-[85vw] bg-[#0E1118]/90 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="overflow-y-auto flex-1">
          {/* Brand header with mobile close button */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-tight text-white">Study Companion</h1>
                <p className="text-[11px] text-zinc-400 font-medium">Study Management Platform</p>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 sm:p-4 space-y-1">
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
                  className={`flex items-center space-x-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                    link.active
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 font-semibold shadow-sm shadow-blue-500/10'
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
        <div className="p-4 border-t border-white/10 bg-[#0B0D12]/60 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="truncate pr-2">
              <p className="text-xs font-medium text-zinc-200 truncate">{userEmail || 'Student'}</p>
              <p className="text-[11px] text-zinc-400">Student Workspace</p>
            </div>
          </div>
          <form
            action={logout}
            onSubmit={() => setIsLoggingOut(true)}
          >
            <Button
              variant="outline"
              size="sm"
              disabled={isLoggingOut}
              className="w-full justify-start text-xs min-h-[44px] text-zinc-400 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10"
              type="submit"
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin text-red-400" />
                  Signing Out...
                </>
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  Sign Out
                </>
              )}
            </Button>
          </form>
        </div>
      </aside>
    </>
  )
}
