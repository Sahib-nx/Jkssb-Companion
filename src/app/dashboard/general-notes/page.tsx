import { getGeneralNotes } from '@/lib/data'
import { GeneralNotesClient } from '@/components/general-notes-client'

export default async function GeneralNotesPage() {
  const data = await getGeneralNotes()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading general notes...</p>
      </div>
    )
  }

  const { notes, subjects } = data

  return <GeneralNotesClient initialNotes={notes} subjects={subjects} />
}
