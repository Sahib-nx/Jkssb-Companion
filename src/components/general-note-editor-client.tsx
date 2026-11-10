'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Subject, GeneralNoteWithSubject, Json } from '@/types/database'
import { saveGeneralNote, deleteGeneralNote } from '@/app/dashboard/notes/actions'
import { RichTextEditor } from '@/components/rich-text-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Trash2, Folder, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface GeneralNoteEditorClientProps {
  initialNote: GeneralNoteWithSubject
  subjects: Subject[]
}

export function GeneralNoteEditorClient({
  initialNote,
  subjects,
}: GeneralNoteEditorClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [title, setTitle] = useState(initialNote.title || 'Untitled Note')
  const [subjectId, setSubjectId] = useState<string | null>(initialNote.subject_id || null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(initialNote.updated_at)
  const [isDeleting, setIsDeleting] = useState(false)

  // Handle Save Note
  const handleSave = async (content: Json, plainText: string): Promise<boolean> => {
    try {
      const res = await saveGeneralNote(
        initialNote.id,
        title,
        subjectId,
        content,
        plainText
      )
      if (res.success) {
        setLastSavedAt(new Date().toISOString())
        toast.success('Note saved successfully')
        return true
      }
      toast.error(res.error || 'Unable to save note. Please try again.')
      return false
    } catch (err: any) {
      toast.error(err?.message || 'Unable to save note')
      return false
    }
  }

  // Handle Delete Note
  const handleDelete = async (): Promise<boolean> => {
    if (isDeleting) return false
    const confirmed = window.confirm(
      `Are you sure you want to delete "${title}"? This cannot be undone.`
    )
    if (!confirmed) return false

    setIsDeleting(true)
    try {
      const res = await deleteGeneralNote(initialNote.id)
      if (res.success) {
        toast.success('Note deleted')
        router.push('/dashboard/general-notes')
        return true
      }
      toast.error(res.error || 'Failed to delete note')
      return false
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete note')
      return false
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <Link
          href="/dashboard/general-notes"
          className="text-xs text-zinc-400 hover:text-white flex items-center transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Back to General Notes
        </Link>

        {/* Category / Subject Selector */}
        <div className="flex items-center space-x-2">
          <Folder className="w-4 h-4 text-blue-400 shrink-0" />
          <select
            value={subjectId || ''}
            onChange={(e) => setSubjectId(e.target.value || null)}
            className="h-8 rounded-lg border border-zinc-700/80 bg-zinc-900/80 px-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Uncategorized (No Subject)</option>
            {subjects.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="h-8 text-xs text-zinc-400 hover:text-red-400 hover:border-red-500/30"
            title="Delete this note"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin text-red-400" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Note Title Input */}
      <div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note Title..."
          className="h-12 text-xl font-bold bg-[#11141D] border-zinc-800/80 text-white placeholder:text-zinc-600 focus-visible:ring-1 focus-visible:ring-blue-500"
        />
      </div>

      {/* Rich Text Editor for General Note */}
      <RichTextEditor
        initialContent={initialNote.content}
        onSave={handleSave}
        lastSavedAt={lastSavedAt}
        placeholder="Write subject summaries, formulas, observations, or key facts..."
      />
    </div>
  )
}
