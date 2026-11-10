import { Skeleton } from '@/components/ui/skeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Charts Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
        <div className="p-6 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-[280px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
