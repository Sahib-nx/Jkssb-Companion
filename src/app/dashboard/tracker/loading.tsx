import { Skeleton } from '@/components/ui/skeleton'

export default function TrackerLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 sm:w-72" />
        <Skeleton className="h-4 w-72 sm:w-96" />
      </div>

      {/* Subject Tabs Skeleton */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800/80 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-36 rounded-lg" />
        ))}
      </div>

      {/* Progress Card Skeleton */}
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-14" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Search and Filters Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex gap-1.5 w-full sm:w-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-lg" />
      </div>

      {/* Lecture Rows Skeleton */}
      <div className="space-y-2.5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-zinc-800/80 bg-[#11141D] flex items-center justify-between gap-4"
          >
            <div className="flex items-center space-x-3 flex-1">
              <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-48 sm:w-80" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
