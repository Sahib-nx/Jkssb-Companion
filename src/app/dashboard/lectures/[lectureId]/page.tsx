import { getLectureDetailsWithNote } from '@/lib/data'
import { LectureNoteClient } from '@/components/lecture-note-client'
import { notFound } from 'next/navigation'

interface LecturePageProps {
  params: Promise<{
    lectureId: string
  }>
}

export default async function LectureDetailPage({ params }: LecturePageProps) {
  const resolvedParams = await params
  const lectureId = resolvedParams.lectureId

  const data = await getLectureDetailsWithNote(lectureId)

  if (!data) {
    notFound()
  }

  const { lecture, subject, progress, note, prevLecture, nextLecture } = data

  return (
    <LectureNoteClient
      lecture={lecture}
      subject={subject}
      initialProgress={progress}
      initialNote={note}
      prevLecture={prevLecture}
      nextLecture={nextLecture}
    />
  )
}
