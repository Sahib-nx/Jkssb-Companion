'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login, type AuthActionState } from '@/app/auth/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'
import { BookOpen, LogIn, AlertCircle, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    login,
    {}
  )

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
      {/* Cinematic Background Image Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/images/dashboard-bg.jpg"
          alt="Cinematic Moonlit Forest Study Atmosphere"
          fill
          priority
          quality={95}
          className="object-cover object-center opacity-85"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D12]/40 via-[#0B0D12]/60 to-[#0B0D12]/85" />
      </div>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 mb-2 backdrop-blur-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-lg">
            Study Companion
          </h1>
          <p className="text-sm text-zinc-300 drop-shadow">
            Your Learning. Your Progress. Your Plan.
          </p>
        </div>

        <Card className="border-white/10 bg-[#0B0D12]/65 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-white">Sign In</CardTitle>
            <CardDescription className="text-zinc-400">
              Enter your credentials to access your study workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            {state?.error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start space-x-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{state.error}</span>
              </div>
            )}

            <form action={formAction} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300" htmlFor="email">
                  Email Address
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="aspirant@example.com"
                  autoComplete="email"
                  required
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300" htmlFor="password">
                    Password
                  </label>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isPending}
                />
              </div>

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-zinc-800/50 pt-4 text-xs text-zinc-400">
            Don&apos;t have an account?&nbsp;
            <Link
              href="/register"
              className="text-blue-400 hover:text-blue-300 underline font-medium transition-colors"
            >
              Create Account
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
