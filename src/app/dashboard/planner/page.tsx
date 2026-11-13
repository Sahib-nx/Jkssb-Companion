import { getDailyPlannerData } from '@/lib/data'
import { redirect } from 'next/navigation'
import { PlannerClient } from '@/components/planner-client'

export default async function PlannerPage() {
  const data = await getDailyPlannerData()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading daily study planner...</p>
      </div>
    )
  }

  const {
    todayDate,
    subjects,
    todayTasks,
    pendingPastTasks,
    upcomingTasks,
    completedTasks,
    totalCount,
    todayCompletedCount,
    activeRoadmap,
  } = data

  if (subjects.length === 0) {
    redirect('/dashboard/onboarding')
  }

  return (
    <PlannerClient
      todayDate={todayDate}
      subjects={subjects}
      todayTasks={todayTasks}
      pendingPastTasks={pendingPastTasks}
      upcomingTasks={upcomingTasks}
      completedTasks={completedTasks}
      totalCount={totalCount}
      todayCompletedCount={todayCompletedCount}
      initialActiveRoadmap={activeRoadmap}
    />
  )
}
