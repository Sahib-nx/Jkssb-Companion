import Image from 'next/image'
import Link from 'next/link'
import { getDashboardComprehensiveData } from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  CircleDashed,
  ArrowRight,
  Sparkles,
  RotateCcw,
  CalendarDays,
  FileText,
  AlertTriangle,
  BarChart3,
  Check,
  Calendar,
} from 'lucide-react'

export default async function DashboardPage() {
  const data = await getDashboardComprehensiveData()

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-zinc-400">Loading study dashboard...</p>
      </div>
    )
  }

  const {
    overallStats,
    subjects,
    todayTasks,
    todayCompleted,
    todayTotal,
    revisions,
  } = data

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="relative">
      {/* 1. Cinematic Background Image Layer (Fixed across entire main content area) */}
      <div className="fixed inset-0 md:left-64 z-0 pointer-events-none overflow-hidden">
        <Image
          src="/images/dashboard-bg.jpg"
          alt="Cinematic Moonlit Forest Study Atmosphere"
          fill
          priority
          quality={95}
          className="object-cover object-center opacity-85"
        />
        {/* Subtle vignette overlay protecting text readability while leaving the glowing moon, stars, storm clouds and forest clearly visible */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D12]/35 via-[#0B0D12]/55 to-[#0B0D12]/85" />
      </div>

      {/* 2. Interactive Dashboard Content Layer */}
      <div className="relative z-10 space-y-8">
        {/* Welcome & Exam Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium mb-2.5 backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>JKSSB Multi-Tasking Staff (MTS) Examination</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
              Study Command Centre
            </h1>
            <p className="text-sm text-zinc-300 mt-1.5 drop-shadow">
              Welcome back. You are tracking 255 course lectures across 4 subjects.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
            <Link href="/dashboard/tracker" className="flex-1 sm:flex-initial">
              <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 text-white text-xs font-semibold min-h-[40px]">
                <span>Lecture Tracker</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/dashboard/analytics" className="flex-1 sm:flex-initial">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-white/20 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-xs min-h-[40px]"
              >
                <BarChart3 className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                <span>Analytics</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Top 4 KPI Metric Cards (Translucent with subtle glass border) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Total Lectures
              </CardTitle>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-white">
                {overallStats.total_lectures}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1 truncate">Full curriculum</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-medium text-emerald-400 uppercase tracking-wider">
                Completed
              </CardTitle>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {overallStats.completed_count}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1 truncate">
                {overallStats.progress_percentage}% completed
              </p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-medium text-amber-400 uppercase tracking-wider">
                In Progress
              </CardTitle>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">
                {overallStats.in_progress_count}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1 truncate">Watching now</p>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 sm:pb-2">
              <CardTitle className="text-[11px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">
                Remaining
              </CardTitle>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400 shrink-0">
                <CircleDashed className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-extrabold text-zinc-200">
                {overallStats.remaining_count}
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1 truncate">Lectures left</p>
            </CardContent>
          </Card>
        </div>

        {/* Overall Syllabus Progress Bar Card */}
        <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-white">Overall Preparation Status</CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Calculated across all 255 lectures &bull; JK Civil Service Course
                </CardDescription>
              </div>
              <span className="text-2xl font-extrabold text-blue-400">
                {overallStats.progress_percentage}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress
              value={overallStats.progress_percentage}
              className="h-3"
              indicatorClassName="bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400"
            />
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>{overallStats.completed_count} completed</span>
              <span>{overallStats.remaining_count} remaining</span>
            </div>
          </CardContent>
        </Card>

        {/* Quick Action Navigation Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <Link href="/dashboard/tracker">
            <Button
              variant="outline"
              className="w-full min-h-[52px] h-auto py-2.5 px-3 border-white/10 bg-[#0B0D12]/55 hover:bg-zinc-800/80 justify-start text-xs text-zinc-200"
            >
              <BookOpen className="w-4 h-4 mr-2 text-blue-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-white truncate">Lecture Tracker</div>
                <div className="text-[10px] text-zinc-400 truncate">Track 255 lectures</div>
              </div>
            </Button>
          </Link>

          <Link href="/dashboard/lecture-notes">
            <Button
              variant="outline"
              className="w-full min-h-[52px] h-auto py-2.5 px-3 border-white/10 bg-[#0B0D12]/55 hover:bg-zinc-800/80 justify-start text-xs text-zinc-200"
            >
              <FileText className="w-4 h-4 mr-2 text-emerald-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-white truncate">Lecture Notes</div>
                <div className="text-[10px] text-zinc-400 truncate">Read & write notes</div>
              </div>
            </Button>
          </Link>

          <Link href="/dashboard/general-notes">
            <Button
              variant="outline"
              className="w-full min-h-[52px] h-auto py-2.5 px-3 border-white/10 bg-[#0B0D12]/55 hover:bg-zinc-800/80 justify-start text-xs text-zinc-200"
            >
              <Sparkles className="w-4 h-4 mr-2 text-purple-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-white truncate">General Notes</div>
                <div className="text-[10px] text-zinc-400 truncate">Facts & overviews</div>
              </div>
            </Button>
          </Link>

          <Link href="/dashboard/revision">
            <Button
              variant="outline"
              className="w-full min-h-[52px] h-auto py-2.5 px-3 border-white/10 bg-[#0B0D12]/55 hover:bg-zinc-800/80 justify-start text-xs text-zinc-200"
            >
              <RotateCcw className="w-4 h-4 mr-2 text-amber-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-white truncate">Revision Centre</div>
                <div className="text-[10px] text-zinc-400 truncate">5 revision modes</div>
              </div>
            </Button>
          </Link>

          <Link href="/dashboard/planner" className="col-span-2 sm:col-span-1">
            <Button
              variant="outline"
              className="w-full min-h-[52px] h-auto py-2.5 px-3 border-white/10 bg-[#0B0D12]/55 hover:bg-zinc-800/80 justify-start text-xs text-zinc-200"
            >
              <CalendarDays className="w-4 h-4 mr-2 text-blue-400 shrink-0" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-white truncate">Daily Planner</div>
                <div className="text-[10px] text-zinc-400 truncate">Day-wise tasks</div>
              </div>
            </Button>
          </Link>
        </div>

        {/* Row: Today's Study Focus & Revision Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today's Study Tasks */}
          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-blue-400" />
                  <CardTitle className="text-base text-white">Today&apos;s Study Tasks</CardTitle>
                </div>
                <Link href="/dashboard/planner">
                  <span className="text-xs text-blue-400 hover:underline">Open Planner &rarr;</span>
                </Link>
              </div>
              <CardDescription className="text-xs text-zinc-400">
                {todayCompleted} of {todayTotal} tasks completed today
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {todayTasks.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#0B0D12]/60 border border-zinc-800/60">
                  <p className="text-xs text-zinc-400">No study tasks planned for today yet.</p>
                  <Link href="/dashboard/planner" className="inline-block mt-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Plan Today&apos;s Study
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-[#0B0D12]/60 border border-zinc-800/60 text-xs"
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        {task.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                        )}
                        <span
                          className={`truncate ${
                            task.status === 'completed'
                              ? 'line-through text-zinc-500'
                              : 'text-zinc-200'
                          }`}
                        >
                          {task.title}
                        </span>
                      </div>
                      {task.subject && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {task.subject.name}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Revision Alerts & Recent Activity */}
          <Card className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md shadow-xl flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <CardTitle className="text-base text-white">Revision Status</CardTitle>
                </div>
                <Link href="/dashboard/revision">
                  <span className="text-xs text-amber-400 hover:underline">
                    Revision Centre &rarr;
                  </span>
                </Link>
              </div>
              <CardDescription className="text-xs text-zinc-400">
                Scheduled and recent lecture revision activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Alert Pills */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
                <div className="p-2 sm:p-2.5 rounded-lg bg-[#0B0D12]/60 border border-zinc-800/60">
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block mb-0.5 truncate">Due Today</span>
                  <span className="text-base sm:text-lg font-bold text-amber-400">
                    {revisions.dueTodayCount}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-lg bg-[#0B0D12]/60 border border-zinc-800/60">
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block mb-0.5 truncate">Overdue</span>
                  <span className="text-base sm:text-lg font-bold text-red-400">
                    {revisions.overdueCount}
                  </span>
                </div>
                <div className="p-2 sm:p-2.5 rounded-lg bg-[#0B0D12]/60 border border-zinc-800/60">
                  <span className="text-[10px] sm:text-[11px] text-zinc-400 block mb-0.5 truncate">Upcoming</span>
                  <span className="text-base sm:text-lg font-bold text-blue-400">
                    {revisions.upcomingCount}
                  </span>
                </div>
              </div>

              {/* Recent revisions list */}
              {revisions.recentRevisions.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">
                    Recently Revised
                  </span>
                  {revisions.recentRevisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#0B0D12]/40 border border-zinc-800/50"
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-zinc-200 truncate">{rev.lectureTitle}</span>
                        {rev.isDifficult && (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" title="Difficult" />
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400 shrink-0">
                        {formatDate(rev.revisedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 4 Subjects Progress Breakdown Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Syllabus Subject Breakdown
              </h2>
              <p className="text-xs text-zinc-400">Track and jump into any of the 4 course subjects</p>
            </div>
            <Link href="/dashboard/tracker">
              <Button variant="ghost" size="sm" className="text-xs text-blue-400 hover:text-blue-300">
                View All in Tracker &rarr;
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjects.map((subject) => (
              <Card
                key={subject.id}
                className="border-white/10 bg-[#0B0D12]/55 backdrop-blur-md hover:border-white/20 transition-all shadow-xl"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base text-white">
                        {subject.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400 mt-1">
                        {subject.total_lectures} lectures in curriculum
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs font-semibold border-white/20">
                      {subject.progress_percentage}%
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <Progress
                    value={subject.progress_percentage}
                    className="h-2"
                    indicatorClassName={
                      subject.progress_percentage === 100
                        ? 'bg-emerald-400'
                        : 'bg-blue-500'
                    }
                  />

                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center pt-1 text-xs">
                    <div className="p-2 rounded-lg bg-[#0B0D12]/70 border border-zinc-800/80">
                      <p className="text-emerald-400 font-semibold text-xs sm:text-sm">
                        {subject.completed_count}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">Completed</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#0B0D12]/70 border border-zinc-800/80">
                      <p className="text-amber-400 font-semibold text-xs sm:text-sm">
                        {subject.in_progress_count}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">In Progress</p>
                    </div>
                    <div className="p-2 rounded-lg bg-[#0B0D12]/70 border border-zinc-800/80">
                      <p className="text-zinc-300 font-semibold text-xs sm:text-sm">
                        {subject.remaining_count}
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">Remaining</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Link href={`/dashboard/tracker?subject=${subject.slug}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs min-h-[38px] border-zinc-700/80 justify-center"
                      >
                        Tracker
                      </Button>
                    </Link>
                    <Link href={`/dashboard/lecture-notes?subject=${subject.slug}`}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full text-xs min-h-[38px] justify-center"
                      >
                        Notes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
