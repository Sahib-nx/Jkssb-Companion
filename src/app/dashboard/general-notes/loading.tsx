import { Skeleton } from '@/components/ui/skeleton'

export default function GeneralNotesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Category Pills & Search Skeleton */}
      <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-[#11141D] border border-zinc-800">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-7 w-24 rounded-md" />
          ))}
        </div>
        <Skeleton className="h-9 w-full lg:w-72 rounded-lg" />
      </div>

      {/* General Notes Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-4"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-40" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-zinc-800/60">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-7" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
