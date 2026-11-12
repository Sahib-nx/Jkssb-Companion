'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Subject } from '@/types/database'
import {
  addSubject,
  renameSubject,
  deleteSubject,
  addLecturesToSubject,
} from '@/app/dashboard/workspace/actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/toast'
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Archive,
  AlertTriangle,
  Loader2,
  Check,
  X,
} from 'lucide-react'

interface WorkspaceManagementCardProps {
  initialSubjects: Subject[]
}

export function WorkspaceManagementCard({ initialSubjects }: WorkspaceManagementCardProps) {
  const router = useRouter()
  const toast = useToast()
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects || [])
  const [isPending, startTransition] = useTransition()

  // Modal / Dialog States
  const [activeModal, setActiveModal] = useState<
    'none' | 'addSubject' | 'renameSubject' | 'addLectures' | 'deleteSubject'
  >('none')
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)

  // Form Fields
  const [newSubName, setNewSubName] = useState('')
  const [newSubCount, setNewSubCount] = useState<number>(30)
  const [renameValue, setRenameValue] = useState('')
  const [additionalCount, setAdditionalCount] = useState<number>(10)

  // Open modals
  const openAddSubject = () => {
    setNewSubName('')
    setNewSubCount(30)
    setActiveModal('addSubject')
  }

  const openRename = (sub: Subject) => {
    setSelectedSubject(sub)
    setRenameValue(sub.name)
    setActiveModal('renameSubject')
  }

  const openAddLectures = (sub: Subject) => {
    setSelectedSubject(sub)
    setAdditionalCount(10)
    setActiveModal('addLectures')
  }

  const openDelete = (sub: Subject) => {
    setSelectedSubject(sub)
    setActiveModal('deleteSubject')
  }

  const closeModal = () => {
    setActiveModal('none')
    setSelectedSubject(null)
  }

  // Handlers
  const handleAddSubjectSubmit = () => {
    if (!newSubName.trim()) {
      toast.error('Please enter a subject name.')
      return
    }

    startTransition(async () => {
      const res = await addSubject(newSubName, newSubCount)
      if (res.success) {
        toast.success(`Subject "${newSubName}" created with ${newSubCount} lectures!`)
        closeModal()
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to add subject.')
      }
    })
  }

  const handleRenameSubmit = () => {
    if (!selectedSubject || !renameValue.trim()) return

    startTransition(async () => {
      const res = await renameSubject(selectedSubject.id, renameValue)
      if (res.success) {
        toast.success(`Renamed to "${renameValue}".`)
        setSubjects((prev) =>
          prev.map((s) => (s.id === selectedSubject.id ? { ...s, name: renameValue } : s))
        )
        closeModal()
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to rename subject.')
      }
    })
  }

  const handleAddLecturesSubmit = () => {
    if (!selectedSubject) return

    startTransition(async () => {
      const res = await addLecturesToSubject(selectedSubject.id, additionalCount)
      if (res.success) {
        toast.success(`Added ${additionalCount} lectures to ${selectedSubject.name}!`)
        setSubjects((prev) =>
          prev.map((s) =>
            s.id === selectedSubject.id
              ? { ...s, total_lectures: (s.total_lectures || 0) + additionalCount }
              : s
          )
        )
        closeModal()
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to add lectures.')
      }
    })
  }

  const handleDeleteSubmit = (archiveOnly: boolean) => {
    if (!selectedSubject) return

    startTransition(async () => {
      const res = await deleteSubject(selectedSubject.id, archiveOnly)
      if (res.success) {
        toast.info(
          archiveOnly
            ? `Subject "${selectedSubject.name}" safely archived.`
            : `Subject "${selectedSubject.name}" deleted.`
        )
        setSubjects((prev) => prev.filter((s) => s.id !== selectedSubject.id))
        closeModal()
        router.refresh()
      } else {
        toast.error(res.error || 'Failed to delete subject.')
      }
    })
  }

  const totalLectures = subjects.reduce((acc, s) => acc + (s.total_lectures || 0), 0)

  return (
    <>
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-3 border-b border-zinc-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <CardTitle className="text-base text-white">Study Workspace & Subjects</CardTitle>
              </div>
              <CardDescription className="text-xs text-zinc-400 mt-0.5">
                Manage your syllabus, add new subjects, extend lectures, or rename course units
              </CardDescription>
            </div>

            <Button
              type="button"
              onClick={openAddSubject}
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs self-start sm:self-auto h-8 shadow-md shadow-blue-600/20"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Add Subject</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {/* Summary KPI row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[#0B0D12] border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-400 font-medium block">Configured Subjects</span>
                <span className="text-xl font-bold text-white">{subjects.length}</span>
              </div>
              <Badge variant="outline" className="border-white/10 text-zinc-400 text-[10px]">
                Active
              </Badge>
            </div>

            <div className="p-3 rounded-xl bg-[#0B0D12] border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-400 font-medium block">Total Lectures</span>
                <span className="text-xl font-bold text-emerald-400">{totalLectures}</span>
              </div>
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-400 text-[10px]">
                Tracked
              </Badge>
            </div>
          </div>

          {/* Subjects List */}
          <div className="space-y-2">
            {subjects.length === 0 ? (
              <div className="p-6 text-center rounded-xl border border-dashed border-zinc-800 bg-[#0B0D12]">
                <p className="text-xs text-zinc-400">No active subjects configured yet.</p>
                <Button
                  onClick={openAddSubject}
                  size="sm"
                  variant="outline"
                  className="mt-3 text-xs border-white/10"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add First Subject
                </Button>
              </div>
            ) : (
              subjects.map((sub, idx) => (
                <div
                  key={sub.id || idx}
                  className="p-3.5 rounded-xl bg-[#0B0D12] border border-zinc-800/80 hover:border-zinc-700/80 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: sub.color || '#3B82F6' }}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white truncate block">
                          {sub.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {sub.slug}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400 mt-0.5 block">
                        {sub.total_lectures} lectures configured
                      </span>
                    </div>
                  </div>

                  {/* Actions for this subject */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openAddLectures(sub)}
                      className="h-7 px-2.5 text-[11px] border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-blue-300"
                      title="Add more lectures to this subject"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      <span>+ Lectures</span>
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openRename(sub)}
                      className="h-7 w-7 text-zinc-400 hover:text-white hover:bg-zinc-800"
                      title="Rename Subject"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openDelete(sub)}
                      className="h-7 w-7 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                      title="Delete / Archive Subject"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL 1: ADD NEW SUBJECT */}
      {activeModal === 'addSubject' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#11141D] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Add New Subject</span>
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Subject Name</label>
                <Input
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="e.g. Computer Science, Current Affairs..."
                  className="h-9 text-xs bg-[#0B0D12] border-zinc-800 text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Number of Lectures to Generate</label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={newSubCount}
                  onChange={(e) => setNewSubCount(Number(e.target.value))}
                  className="h-9 text-xs bg-[#0B0D12] border-zinc-800 text-white"
                />
                <span className="text-[11px] text-zinc-500">
                  Lectures 001 to {String(newSubCount).padStart(3, '0')} will be auto-generated.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
                disabled={isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddSubjectSubmit}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="w-3.5 h-3.5 mr-1" />
                )}
                <span>Create Subject</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RENAME SUBJECT */}
      {activeModal === 'renameSubject' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#11141D] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-400" />
                <span>Rename Subject</span>
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Subject Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="h-9 text-xs bg-[#0B0D12] border-zinc-800 text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
                disabled={isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleRenameSubmit}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Save Name</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD MORE LECTURES */}
      {activeModal === 'addLectures' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#11141D] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add More Lectures to {selectedSubject.name}</span>
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                Current count: <span className="text-white font-semibold">{selectedSubject.total_lectures} lectures</span>.
              </p>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Additional Lectures to Append</label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={additionalCount}
                  onChange={(e) => setAdditionalCount(Number(e.target.value))}
                  className="h-9 text-xs bg-[#0B0D12] border-zinc-800 text-white"
                />
                <span className="text-[11px] text-zinc-500">
                  New total will be {(selectedSubject.total_lectures || 0) + additionalCount} lectures.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
                disabled={isPending}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddLecturesSubmit}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Append Lectures</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE OR ARCHIVE SUBJECT */}
      {activeModal === 'deleteSubject' && selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-xl border border-red-500/30 bg-[#11141D] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-red-400 border-b border-zinc-800 pb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                Delete or Archive &quot;{selectedSubject.name}&quot;?
              </h3>
            </div>

            <div className="space-y-3 text-xs text-zinc-300 leading-relaxed">
              <p>
                Please choose how you want to handle this subject:
              </p>
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                <strong>Archive Subject (Recommended):</strong> Hides the subject from your active
                dashboard and tracker while <em>preserving all your lecture notes and revision logs</em>.
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300">
                <strong>Permanent Deletion:</strong> Irreversibly deletes this subject, its lectures,
                and associated records.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeModal}
                disabled={isPending}
                className="w-full sm:w-auto text-xs"
              >
                Cancel
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleDeleteSubmit(true)}
                disabled={isPending}
                className="w-full sm:w-auto border-blue-500/40 text-blue-300 hover:bg-blue-500/10 text-xs"
              >
                <Archive className="w-3.5 h-3.5 mr-1" />
                <span>Archive (Safe)</span>
              </Button>

              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteSubmit(false)}
                disabled={isPending}
                className="w-full sm:w-auto text-xs"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                <span>Delete Permanently</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
