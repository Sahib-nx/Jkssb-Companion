import { getAnalyticsData } from '@/lib/data'
import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'

const AnalyticsClient = dynamic(
  () => import('@/components/analytics-client').then((m) => m.AnalyticsClient),
  {
    loading: () => (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-zinc-800/40 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 h-72 bg-zinc-800/40 rounded-xl" />
          <div className="lg:col-span-7 h-72 bg-zinc-800/40 rounded-xl" />
        </div>
        <div className="h-80 bg-zinc-800/40 rounded-xl" />
      </div>
    ),
  }
)

export default async function AnalyticsPage() {
  const data = await getAnalyticsData()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading analytics...</p>
      </div>
    )
  }

  const {
    overallStats,
    syllabusDistribution,
    subjectComparison,
    completionTimeline,
    revisionTimeline,
    totalRevisionEvents,
    taskStats,
    totalTasks,
    completedTasks,
  } = data

  if (subjectComparison.length === 0) {
    redirect('/dashboard/onboarding')
  }

  return (
    <AnalyticsClient
      overallStats={overallStats}
      syllabusDistribution={syllabusDistribution}
      subjectComparison={subjectComparison}
      completionTimeline={completionTimeline}
      revisionTimeline={revisionTimeline}
      totalRevisionEvents={totalRevisionEvents}
      taskStats={taskStats}
      totalTasks={totalTasks}
      completedTasks={completedTasks}
    />
  )
}
