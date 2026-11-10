import { getAnalyticsData } from '@/lib/data'
import { AnalyticsClient } from '@/components/analytics-client'

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
