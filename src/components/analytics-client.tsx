'use client'

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  RotateCcw,
  CalendarCheck,
  Award,
} from 'lucide-react'

interface AnalyticsClientProps {
  overallStats: {
    total_lectures: number
    completed_count: number
    in_progress_count: number
    remaining_count: number
    progress_percentage: number
  }
  syllabusDistribution: { name: string; value: number; fill: string }[]
  subjectComparison: {
    name: string
    total: number
    completed: number
    inProgress: number
    percentage: number
  }[]
  completionTimeline: { date: string; daily: number; cumulative: number }[]
  revisionTimeline: { date: string; count: number }[]
  totalRevisionEvents: number
  taskStats: { name: string; value: number; fill: string }[]
  totalTasks: number
  completedTasks: number
}

// Custom Tooltip for Recharts in dark mode
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-[#0E1118] p-2.5 text-xs shadow-xl text-zinc-100">
        <p className="font-semibold text-zinc-300 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color || entry.fill }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    )
  }
  return null
}

export function AnalyticsClient({
  overallStats,
  syllabusDistribution,
  subjectComparison,
  completionTimeline,
  revisionTimeline,
  totalRevisionEvents,
  taskStats,
  totalTasks,
  completedTasks,
}: AnalyticsClientProps) {
  const taskCompletionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Preparation Analytics
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Real-time study analytics derived from your database progress, revisions, and tasks
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Badge variant="default" className="text-xs px-3 py-1 bg-blue-600/10 border-blue-500/20 text-blue-400">
            <Award className="w-3.5 h-3.5 mr-1" />
            {overallStats.progress_percentage}% Course Completed
          </Badge>
        </div>
      </div>

      {/* Row 1: Syllabus Distribution Donut & Subject Comparison Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Syllabus Donut (5 cols) */}
        <Card className="lg:col-span-5 border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <PieIcon className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base text-white">Syllabus Breakdown</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Total 255 lectures distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={syllabusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {syllabusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="#11141D" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2 text-xs border-t border-zinc-800/60 mt-2">
              <div>
                <span className="text-emerald-400 font-bold text-base block">
                  {overallStats.completed_count}
                </span>
                <span className="text-[11px] text-zinc-400">Completed</span>
              </div>
              <div>
                <span className="text-amber-400 font-bold text-base block">
                  {overallStats.in_progress_count}
                </span>
                <span className="text-[11px] text-zinc-400">In Progress</span>
              </div>
              <div>
                <span className="text-zinc-400 font-bold text-base block">
                  {overallStats.remaining_count}
                </span>
                <span className="text-[11px] text-zinc-400">Remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subject Comparison Bar Chart (7 cols) */}
        <Card className="lg:col-span-7 border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base text-white">Subject-wise Progress</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Completed lectures vs syllabus target per subject
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={subjectComparison}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2330" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#1E2330' }}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={11}
                    tickLine={false}
                    axisLine={{ stroke: '#1E2330' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
                  />
                  <Bar dataKey="total" name="Total Required" fill="#27272A" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center pt-2 text-xs border-t border-zinc-800/60 mt-2">
              {subjectComparison.map((s) => (
                <div key={s.name}>
                  <span className="text-white font-bold text-xs block truncate">{s.name}</span>
                  <span className="text-[11px] text-blue-400 font-semibold">{s.percentage}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Lecture Completion Over Time & Revision Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lecture Completion Velocity */}
        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-base text-white">Cumulative Lecture Completions</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Total lectures finished over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {completionTimeline.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-zinc-500 italic">
                No lectures marked as completed yet. Complete lectures in Tracker to see velocity curve.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={completionTimeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2330" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1E2330' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1E2330' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="cumulative"
                      name="Cumulative Lectures"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorCompleted)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revision Activity Timeline */}
        <Card className="border-zinc-800/80 bg-[#11141D]">
          <CardHeader className="pb-2">
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-4 h-4 text-blue-400" />
              <CardTitle className="text-base text-white">Revision Frequency</CardTitle>
            </div>
            <CardDescription className="text-xs text-zinc-400">
              Daily volume of revised lectures ({totalRevisionEvents} total events)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {revisionTimeline.length === 0 ? (
              <div className="h-56 flex items-center justify-center text-xs text-zinc-500 italic">
                No revisions logged yet. Start revision sessions in Revision Centre to track frequency.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revisionTimeline}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E2330" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1E2330' }}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: '#1E2330' }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="count"
                      name="Lectures Revised"
                      fill="#3B82F6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Daily Study Planner Performance */}
      <Card className="border-zinc-800/80 bg-[#11141D]">
        <CardHeader className="pb-2">
          <div className="flex items-center space-x-2">
            <CalendarCheck className="w-4 h-4 text-purple-400" />
            <CardTitle className="text-base text-white">Planner Task Execution</CardTitle>
          </div>
          <CardDescription className="text-xs text-zinc-400">
            Task completion performance ({taskCompletionRate}% completion rate across {totalTasks} tasks)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="h-44 w-full md:col-span-1">
              {totalTasks === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-zinc-500 italic">
                  No tasks recorded in Daily Planner yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={taskStats}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {taskStats.map((entry, index) => (
                        <Cell key={`cell-task-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="md:col-span-2 grid grid-cols-3 gap-3 text-center">
              <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
                <span className="text-2xl font-bold text-white block">{totalTasks}</span>
                <span className="text-xs text-zinc-400 mt-1 block">Total Tasks</span>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
                <span className="text-2xl font-bold text-blue-400 block">{completedTasks}</span>
                <span className="text-xs text-zinc-400 mt-1 block">Completed</span>
              </div>
              <div className="p-4 rounded-xl bg-[#0B0D12] border border-zinc-800/80">
                <span className="text-2xl font-bold text-purple-400 block">
                  {taskCompletionRate}%
                </span>
                <span className="text-xs text-zinc-400 mt-1 block">Success Rate</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
