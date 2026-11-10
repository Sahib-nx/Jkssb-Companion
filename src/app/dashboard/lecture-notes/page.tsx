import { getLectureNotesDirectory } from '@/lib/data'
import { LectureNotesDirectoryClient } from '@/components/lecture-notes-directory-client'

interface LectureNotesPageProps {
  searchParams: Promise<{
    subject?: string
  }>
}

export default async function LectureNotesPage({ searchParams }: LectureNotesPageProps) {
  const resolvedSearchParams = await searchParams
  const subjectSlug = resolvedSearchParams.subject

  const data = await getLectureNotesDirectory(subjectSlug)

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading lecture notes...</p>
      </div>
    )
  }

  const { subjects, activeSubject, lectures, notesCount, totalLectures } = data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          My Lecture Notes
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Review, write, and manage your personal study notes for all 255 course lectures
        </p>
      </div>

      <LectureNotesDirectoryClient
        subjects={subjects}
        activeSubject={activeSubject}
        lectures={lectures}
        notesCount={notesCount}
        totalLectures={totalLectures}
      />
    </div>
  )
}
