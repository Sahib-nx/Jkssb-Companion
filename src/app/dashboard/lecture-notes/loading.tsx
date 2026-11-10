import { Skeleton } from '@/components/ui/skeleton'

export default function LectureNotesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 sm:w-72" />
        <Skeleton className="h-4 w-72 sm:w-96" />
      </div>

      {/* 4 Subject Coverage Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Filter and Search Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-lg" />
      </div>

      {/* Lecture Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-40" />
            <div className="flex justify-between items-center pt-2 border-t border-zinc-800/60">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
