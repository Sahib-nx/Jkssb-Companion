import { getGeneralNoteById } from '@/lib/data'
import { GeneralNoteEditorClient } from '@/components/general-note-editor-client'
import { notFound } from 'next/navigation'

interface GeneralNotePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function GeneralNoteDetailPage({ params }: GeneralNotePageProps) {
  const resolvedParams = await params
  const noteId = resolvedParams.id

  const data = await getGeneralNoteById(noteId)

  if (!data || !data.note) {
    notFound()
  }

  const { note, subjects } = data

  return <GeneralNoteEditorClient initialNote={note} subjects={subjects} />
}
