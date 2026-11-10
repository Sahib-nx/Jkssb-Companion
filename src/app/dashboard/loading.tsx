import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Welcome & Exam Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-64 rounded-full" />
          <Skeleton className="h-8 w-72 sm:w-96" />
          <Skeleton className="h-4 w-56 sm:w-80" />
        </div>
        <div className="flex items-center space-x-2.5">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D]/60 space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Progress Card Skeleton */}
      <div className="p-6 rounded-xl border border-zinc-800/80 bg-[#11141D]/60 space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-7 w-12" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>

      {/* Quick Action Navigation Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>

      {/* 2-Column Focus & Revision Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D]/60 space-y-3">
          <div className="flex justify-between items-center pb-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D]/60 space-y-3">
          <div className="flex justify-between items-center pb-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
