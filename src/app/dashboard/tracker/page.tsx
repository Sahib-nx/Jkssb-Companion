import { getTrackerData } from '@/lib/data'
import { LectureTrackerClient } from '@/components/lecture-tracker-client'

interface TrackerPageProps {
  searchParams: Promise<{
    subject?: string
  }>
}

export default async function TrackerPage({ searchParams }: TrackerPageProps) {
  const resolvedSearchParams = await searchParams
  const subjectSlug = resolvedSearchParams.subject

  const data = await getTrackerData(subjectSlug)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading lecture tracker...</p>
      </div>
    )
  }

  const { subjects, allLecturesBySubject, overallPercentage, initialSubjectSlug } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Lecture Tracker
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor your study status for all 255 JKSSB examination lectures
        </p>
      </div>

      <LectureTrackerClient
        subjects={subjects}
        allLecturesBySubject={allLecturesBySubject}
        overallPercentage={overallPercentage}
        initialSubjectSlug={initialSubjectSlug}
      />
    </div>
  )
}
