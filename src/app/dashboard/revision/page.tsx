import { getRevisionHubData } from '@/lib/data'
import { redirect } from 'next/navigation'
import { RevisionHubClient } from '@/components/revision-hub-client'

export default async function RevisionHubPage() {
  const data = await getRevisionHubData()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading Revision Centre...</p>
      </div>
    )
  }

  const {
    subjects,
    notesLectureIds,
    inProgressSessions,
    scheduledSessions,
    completedSessions,
    revisionSummaries,
    difficultLectures,
    needsReRevisionLectures,
    totalRevisedLectures,
    totalRevisionEvents,
    totalLectures,
  } = data

  if (subjects.length === 0) {
    redirect('/dashboard/onboarding')
  }

  return (
    <RevisionHubClient
      subjects={subjects}
      notesLectureIds={notesLectureIds}
      inProgressSessions={inProgressSessions}
      scheduledSessions={scheduledSessions}
      completedSessions={completedSessions}
      revisionSummaries={revisionSummaries}
      difficultLectures={difficultLectures}
      needsReRevisionLectures={needsReRevisionLectures}
      totalRevisedLectures={totalRevisedLectures}
      totalRevisionEvents={totalRevisionEvents}
      totalLectures={totalLectures}
    />
  )
}
