import { Skeleton } from '@/components/ui/skeleton'

export default function PlannerLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:w-72" />
          <Skeleton className="h-4 w-72 sm:w-96" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Progress Card Skeleton */}
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-2.5 w-full" />
      </div>

      {/* Task List Section Skeleton */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-7 w-28" />
        </div>

        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl border border-zinc-800/80 bg-[#11141D] flex items-center justify-between gap-3"
            >
              <div className="flex items-center space-x-3 flex-1">
                <Skeleton className="w-4 h-4 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-48 sm:w-72" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex items-center space-x-1 shrink-0">
                <Skeleton className="h-7 w-7 rounded" />
                <Skeleton className="h-7 w-7 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
