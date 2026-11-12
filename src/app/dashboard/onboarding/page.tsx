import { getAuthenticatedUser } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { checkUserWorkspace } from '@/app/dashboard/workspace/actions'
import { OnboardingWizard } from '@/components/onboarding-wizard'

export default async function OnboardingPage() {
  const user = await getAuthenticatedUser()
  if (!user) {
    redirect('/login')
  }

  const { hasWorkspace } = await checkUserWorkspace()

  // If user already has configured subjects, take them straight to dashboard
  if (hasWorkspace) {
    redirect('/dashboard')
  }

  return <OnboardingWizard />
}
