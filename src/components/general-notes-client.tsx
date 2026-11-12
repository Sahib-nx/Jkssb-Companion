'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Subject, GeneralNoteWithSubject } from '@/types/database'
import { saveGeneralNote, deleteGeneralNote } from '@/app/dashboard/notes/actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Trash2,
  Edit3,
  Loader2,
  Folder,
} from 'lucide-react'

import { useToast } from '@/components/ui/toast'

interface GeneralNotesClientProps {
  initialNotes: GeneralNoteWithSubject[]
  subjects: Subject[]
}

export function GeneralNotesClient({
  initialNotes,
  subjects,
}: GeneralNotesClientProps) {
  const router = useRouter()
  const toast = useToast()
  const [notes, setNotes] = useState<GeneralNoteWithSubject[]>(initialNotes)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, startCreateTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Handle Create New Note
  const handleCreateNote = () => {
    if (isCreating || deletingId) return
    startCreateTransition(async () => {
      try {
        const res = await saveGeneralNote(
          null,
          'Untitled Note',
          selectedSubjectId !== 'all' && selectedSubjectId !== 'uncategorized'
            ? selectedSubjectId
            : null,
          {},
          ''
        )

        if (res.success && res.noteId) {
          toast.success('General note created')
          router.push(`/dashboard/general-notes/${res.noteId}`)
        } else {
          toast.error(res.error || 'Failed to create note')
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to create note')
      }
    })
  }

  // Handle Delete Note
  const handleDeleteNote = async (noteId: string, title: string) => {
    if (deletingId || isCreating) return
    const confirmed = window.confirm(`Are you sure you want to delete "${title}"?`)
    if (!confirmed) return

    setDeletingId(noteId)
    try {
      const res = await deleteGeneralNote(noteId)
      if (res.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
        toast.success('Note deleted successfully')
      } else {
        toast.error(res.error || 'Failed to delete note')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete note')
    } finally {
      setDeletingId(null)
    }
  }

  // Filter notes by subject and search
  const filteredNotes = notes.filter((n) => {
    if (selectedSubjectId === 'uncategorized' && n.subject_id !== null) return false
    if (
      selectedSubjectId !== 'all' &&
      selectedSubjectId !== 'uncategorized' &&
      n.subject_id !== selectedSubjectId
    )
      return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const titleMatch = n.title.toLowerCase().includes(q)
      const textMatch = n.plain_text?.toLowerCase().includes(q)
      return titleMatch || textMatch
    }

    return true
  })

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with New Note Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            General Notes
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Capture subject summaries, formulas, important facts, and overall observations
          </p>
        </div>

        <Button onClick={handleCreateNote} disabled={isCreating} className="shrink-0 w-full sm:w-auto min-h-[40px]">
          {isCreating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Note...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              New General Note
            </>
          )}
        </Button>
      </div>

      {/* Subject Filter Pills and Search */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 rounded-lg bg-[#0B0D12]/60 border border-white/10 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setSelectedSubjectId('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
              selectedSubjectId === 'all'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All Notes ({notes.length})
          </button>
          {subjects.map((s) => {
            const count = notes.filter((n) => n.subject_id === s.id).length
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSubjectId(s.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
                  selectedSubjectId === s.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {s.name} ({count})
              </button>
            )
          })}
          <button
            onClick={() => setSelectedSubjectId('uncategorized')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0 min-h-[34px] ${
              selectedSubjectId === 'uncategorized'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Uncategorized ({notes.filter((n) => !n.subject_id).length})
          </button>
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search general notes..."
            className="pl-9 h-10 sm:h-9 text-xs"
          />
        </div>
      </div>

      {/* Grid of Notes */}
      {filteredNotes.length === 0 ? (
        <div className="p-16 text-center rounded-xl bg-[#0B0D12]/55 border border-white/10 backdrop-blur-md space-y-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 mx-auto flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">No general notes found</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
            Create your first general study note to organize concepts, key dates, or formulas.
          </p>
          <Button onClick={handleCreateNote} size="sm" className="mt-2">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Note
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map((note) => {
            const isDeleting = deletingId === note.id
            const snippet = note.plain_text?.slice(0, 180)?.trim()

            return (
              <Card
                key={note.id}
                className="border-zinc-800/80 bg-[#11141D] hover:border-zinc-700/80 transition-all flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="text-[11px] font-normal border-zinc-700/80 text-zinc-300"
                    >
                      <Folder className="w-3 h-3 mr-1 text-blue-400" />
                      {note.subject ? note.subject.name : 'Uncategorized'}
                    </Badge>
                    <span className="text-[11px] text-zinc-500">
                      {formatDate(note.updated_at)}
                    </span>
                  </div>
                  <CardTitle className="text-base text-white mt-2 line-clamp-1">
                    {note.title}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed">
                    {snippet || <span className="italic text-zinc-600">Empty note...</span>}
                  </p>

                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800/60">
                    <Link href={`/dashboard/general-notes/${note.id}`}>
                      <Button variant="secondary" size="sm" className="h-7 text-xs">
                        <Edit3 className="w-3 h-3 mr-1.5" />
                        Edit Note
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isDeleting || isCreating || deletingId !== null}
                      onClick={() => handleDeleteNote(note.id, note.title)}
                      className="h-7 px-2 text-xs text-zinc-500 hover:text-red-400"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
