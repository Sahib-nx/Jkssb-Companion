import { getRevisionWorkspaceData } from '@/lib/data'
import { RevisionWorkspaceClient } from '@/components/revision-workspace-client'
import { notFound } from 'next/navigation'

interface RevisionWorkspacePageProps {
  params: Promise<{
    sessionId: string
  }>
}

export default async function RevisionWorkspacePage({
  params,
}: RevisionWorkspacePageProps) {
  const resolvedParams = await params
  const sessionId = resolvedParams.sessionId

  const data = await getRevisionWorkspaceData(sessionId)

  if (!data || !data.session) {
    notFound()
  }

  return <RevisionWorkspaceClient initialSession={data.session} />
}
