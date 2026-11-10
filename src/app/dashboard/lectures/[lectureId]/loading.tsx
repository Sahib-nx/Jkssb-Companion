import { Skeleton } from '@/components/ui/skeleton'

export default function LectureDetailLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb & Navigation Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <Skeleton className="h-4 w-64" />
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* Lecture Title & Status Banner Skeleton */}
      <div className="p-5 rounded-xl border border-zinc-800/80 bg-[#11141D] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-7 w-64 sm:w-96" />
          <Skeleton className="h-3 w-48" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Editor Skeleton */}
      <div className="rounded-xl border border-zinc-800/80 bg-[#11141D] overflow-hidden">
        {/* Editor Toolbar Skeleton */}
        <div className="border-b border-zinc-800/80 bg-[#0E1118] p-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-7 w-7 rounded" />
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
        {/* Canvas Skeleton */}
        <div className="p-8 space-y-4 min-h-[350px]">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  )
}
