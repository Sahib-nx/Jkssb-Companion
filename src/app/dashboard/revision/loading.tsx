import { Skeleton } from '@/components/ui/skeleton'

export default function RevisionLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 sm:w-64" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2 border-b border-zinc-800/80 pb-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-lg" />
        ))}
      </div>

      {/* Revision Session Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
