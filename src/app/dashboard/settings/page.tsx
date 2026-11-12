import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCachedSubjects } from '@/lib/data'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/auth/actions'
import { getUserAiClientConfig } from '@/lib/ai/byok-actions'
import { AiSettingsCard } from '@/components/settings/ai-settings-card'
import { WorkspaceManagementCard } from '@/components/settings/workspace-management-card'
import {
  User,
  Shield,
  Database,
  LogOut,
} from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch subjects and AI BYOK configuration for the authenticated user
  const [userSubjects, aiConfig] = await Promise.all([
    getCachedSubjects(),
    getUserAiClientConfig(),
  ])

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="border-b border-zinc-800/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Account & System Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your personal study profile, security settings, and database integration
        </p>
      </div>

      {/* Account Profile Card */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-blue-400" />
            <CardTitle className="text-base text-white">Aspirant Profile</CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Personal authenticated session and identity details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Email Address
              </span>
              <span className="text-sm font-medium text-white">{user.email}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800">
              <span className="text-[11px] text-zinc-500 uppercase font-semibold block mb-1">
                Account ID (UUID)
              </span>
              <span className="text-xs font-mono text-zinc-300 truncate block">
                {user.id}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-zinc-800/60">
            <div className="flex items-center space-x-2 text-xs text-zinc-400">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Row Level Security (RLS) actively isolates all personal records</span>
            </div>

            <form action={logout} className="w-full sm:w-auto">
              <Button
                variant="destructive"
                size="sm"
                className="text-xs h-9 sm:h-8 w-full sm:w-auto min-h-[36px]"
                type="submit"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Sign Out
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* AI Study Assistant & Privacy Settings (BYOK) */}
      <AiSettingsCard initialConfig={aiConfig} />

      {/* Dynamic Study Workspace & Subject Management */}
      <WorkspaceManagementCard initialSubjects={userSubjects} />

      {/* Database & Architecture Info */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-blue-400" />
            <CardTitle className="text-base text-white">System & Architecture</CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Technology stack details and production configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-zinc-300">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
              <span className="text-zinc-500 block mb-0.5">Application</span>
              <span className="font-semibold text-white">MTS Companion v1.0.0</span>
            </div>
            <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
              <span className="text-zinc-500 block mb-0.5">Framework</span>
              <span className="font-semibold text-white">Next.js 16 (App Router)</span>
            </div>
            <div className="p-3 rounded-lg bg-[#0B0D12] border border-zinc-800">
              <span className="text-zinc-500 block mb-0.5">Database</span>
              <span className="font-semibold text-white">Supabase PostgreSQL</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
