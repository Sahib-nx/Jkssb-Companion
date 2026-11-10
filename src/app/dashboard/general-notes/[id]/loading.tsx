import { Skeleton } from '@/components/ui/skeleton'

export default function GeneralNoteEditorLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <Skeleton className="h-4 w-40" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-44 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* Note Title Input Skeleton */}
      <Skeleton className="h-12 w-full rounded-xl" />

      {/* Editor Skeleton */}
      <div className="rounded-xl border border-zinc-800/80 bg-[#11141D] overflow-hidden">
        <div className="border-b border-zinc-800/80 bg-[#0E1118] p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-7 w-7 rounded" />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
        <div className="p-8 space-y-4 min-h-[350px]">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  )
}
