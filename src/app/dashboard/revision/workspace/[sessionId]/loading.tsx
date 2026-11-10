import { Skeleton } from '@/components/ui/skeleton'

export default function RevisionWorkspaceLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Workspace Top Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Session Progress Header Skeleton */}
      <div className="p-4 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-2.5">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>

      {/* Two-Column Layout Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Note viewer skeleton (3 cols) */}
        <div className="lg:col-span-3 rounded-xl border border-zinc-800/80 bg-[#11141D] overflow-hidden">
          <div className="p-4 border-b border-zinc-800/80 bg-[#0E1118] flex justify-between items-center">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="p-8 space-y-4 min-h-[400px]">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>

        {/* Right: Lecture list skeleton (1 col) */}
        <div className="rounded-xl border border-zinc-800/80 bg-[#11141D] p-3 space-y-2">
          <Skeleton className="h-4 w-32 mb-2" />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
