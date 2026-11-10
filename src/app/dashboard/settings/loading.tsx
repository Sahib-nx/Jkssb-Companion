import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="space-y-2 border-b border-zinc-800/80 pb-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="p-6 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="p-6 rounded-xl border border-zinc-800/80 bg-[#11141D] space-y-4">
        <Skeleton className="h-5 w-52" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
