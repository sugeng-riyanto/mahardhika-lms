import { useState, useMemo } from 'react'
import {
  Users, Clock, Calendar, CheckCircle, XCircle, AlertCircle,
  BookOpen, MapPin, ChevronLeft, ChevronRight, Download,
  Search, Camera,
} from 'lucide-react'
import { useSchedules, useAttendanceRecords, useAttendanceSummary } from '@/api/hooks'
import { useAuth } from '@/auth/AuthProvider'
import { RollCallModal } from '@/features/calendar/RollCallModal'
import { SelfCheckIn } from './SelfCheckIn'
import { exportAttendanceFiles, filterAttendanceRecords, inViewedMonth } from '@/utils/attendanceExport'

const STATUS_META = {
  present: { label: 'Present', icon: CheckCircle, colour: 'text-green-400', bg: 'bg-green-900/30', border: 'border-green-700/50' },
  absent: { label: 'Absent', icon: XCircle, colour: 'text-red-400', bg: 'bg-red-900/30', border: 'border-red-700/50' },
  late: { label: 'Late', icon: AlertCircle, colour: 'text-yellow-400', bg: 'bg-yellow-900/30', border: 'border-yellow-700/50' },
  excused: { label: 'Excused', icon: CheckCircle, colour: 'text-navy-400', bg: 'bg-navy-800', border: 'border-navy-700/50' },
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function AttendancePage() {
  const { roles } = useAuth()
  const { data: schedules, isLoading: schedulesLoading } = useSchedules()
  const { data: records, isLoading: recordsLoading } = useAttendanceRecords()
  const { data: summary } = useAttendanceSummary()

  const isInstructor = roles.some((r) => ['owner', 'admin', 'instructor'].includes(r))
  const isStudent = roles.includes('student')

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()))
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'schedule' | 'calendar'>('schedule')
  const [rollOpen, setRollOpen] = useState(false)
  const [selfCheckInSchedule, setSelfCheckInSchedule] = useState<{ id: string; title: string; course: string } | null>(null)

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1) }
    else { setCurrentMonth(currentMonth - 1) }
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1) }
    else { setCurrentMonth(currentMonth + 1) }
    setSelectedDate(null)
  }

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map: Record<string, typeof schedules extends (infer T)[] | undefined ? T[] : never> = {}
    if (!schedules) return map
    for (const s of schedules) {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    }
    return map
  }, [schedules])

  // Selected date schedules
  const selectedSchedules = selectedDate ? (schedulesByDate[selectedDate] || []) : []

  // Schedules that can still be marked (cancelled lessons are excluded)
  const rollSchedules = selectedSchedules.filter((s) => !s.is_cancelled)

  // Records for selected date — the exact set the panel renders and the CSV exports
  const selectedRecords = useMemo(
    () => filterAttendanceRecords(records ?? [], {
      selectedDate,
      status: statusFilter,
      search: searchQuery,
    }),
    [records, selectedDate, statusFilter, searchQuery],
  )

  // Stats for selected date
  const dateStats = useMemo(() => {
    if (!records || !selectedDate) return { total: 0, present: 0, late: 0, absent: 0, excused: 0 }
    const dayRecords = records.filter((r) => r.schedule_date === selectedDate)
    return {
      total: dayRecords.length,
      present: dayRecords.filter((r) => r.status === 'present').length,
      late: dayRecords.filter((r) => r.status === 'late').length,
      absent: dayRecords.filter((r) => r.status === 'absent').length,
      excused: dayRecords.filter((r) => r.status === 'excused').length,
    }
  }, [records, selectedDate])

  // Calendar cells
  const calendarCells = useMemo(() => {
    const cells: { day: number | null; key: string | null; isToday: boolean; isSelected: boolean; schedules: typeof schedules extends (infer T)[] | undefined ? T[] : never }[] = []
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, key: null, isToday: false, isSelected: false, schedules: [] })
    for (let d = 1; d <= daysInMonth; d++) {
      const key = formatDateKey(currentYear, currentMonth, d)
      cells.push({ day: d, key, isToday: key === todayKey, isSelected: key === selectedDate, schedules: (schedulesByDate[key] || []) as NonNullable<typeof schedules> })
    }
    return cells
  }, [currentYear, currentMonth, firstDay, daysInMonth, todayKey, selectedDate, schedulesByDate])

  const handleExport = () => {
    const monthSchedules = (schedules ?? []).filter((s) => inViewedMonth(s.date, currentYear, currentMonth))
    // Records CSV mirrors the right-hand panel exactly: the selected date
    // (or "All Records" when no date is chosen), status filter and search.
    exportAttendanceFiles(monthSchedules, selectedRecords)
  }

  const isLoading = schedulesLoading || recordsLoading

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-green-400" size={24} />
          <div>
            <h1 className="page-title mb-0">Attendance</h1>
            <p className="text-sm text-navy-400">
              {isInstructor ? 'Manage schedules and mark attendance' : 'View your attendance records'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('schedule')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              viewMode === 'schedule'
                ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
            }`}
          >
            <BookOpen size={12} className="inline mr-1" />
            Schedule
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
              viewMode === 'calendar'
                ? 'bg-cyan-900/30 text-cyan-400 border-cyan-700/50'
                : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
            }`}
          >
            <Calendar size={12} className="inline mr-1" />
            Calendar
          </button>
          <button onClick={handleExport} className="btn-secondary text-sm flex items-center gap-1">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
          <div className="card p-4">
            <p className="text-2xl font-bold text-white">{summary.total}</p>
            <p className="text-sm text-navy-400">Total Records</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-green-400">{summary.present}</p>
            <p className="text-sm text-navy-400">Present</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-yellow-400">{summary.late}</p>
            <p className="text-sm text-navy-400">Late</p>
          </div>
          <div className="card p-4">
            <p className="text-2xl font-bold text-red-400">{summary.absent}</p>
            <p className="text-sm text-navy-400">Absent</p>
          </div>
          <div className="card p-4 col-span-2 sm:col-span-1">
            <p className="text-2xl font-bold text-cyan-400">{summary.rate}%</p>
            <p className="text-sm text-navy-400">Attendance Rate</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Left: Schedule / Calendar */}
        <div className="xl:col-span-3">
          {viewMode === 'schedule' ? (
            <>
              {/* Schedule List */}
              <div className="card">
                <div className="p-4 border-b border-navy-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <BookOpen size={14} className="text-cyan-400" />
                      Lesson Schedules
                      <span className="badge text-[10px] bg-navy-800 text-navy-400">{schedules?.length || 0}</span>
                    </h2>
                    <div className="flex items-center gap-1">
                      <button onClick={prevMonth} className="p-1 text-navy-400 hover:text-white rounded hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="Previous month">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs text-navy-300 min-w-[120px] text-center">
                        {MONTH_NAMES[currentMonth]} {currentYear}
                      </span>
                      <button onClick={nextMonth} className="p-1 text-navy-400 hover:text-white rounded hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="Next month">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {schedules && schedules.length > 0 ? (
                  <div className="divide-y divide-navy-800">
                    {schedules
                      .filter((s) => {
                        const d = new Date(s.date)
                        return d.getFullYear() === currentYear && d.getMonth() === currentMonth
                      })
                      .map((schedule) => {
                        const total = schedule.attendance_count.total
                        const present = schedule.attendance_count.present
                        const rate = total > 0 ? Math.round((present / total) * 100) : 0
                        const isToday = schedule.date === todayKey
                        return (
                          <div
                            key={schedule.id}
                            onClick={() => setSelectedDate(schedule.date)}
                            className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                              selectedDate === schedule.date ? 'bg-navy-800/80 ring-1 ring-cyan-500/30' : 'hover:bg-navy-800/50'
                            }`}
                          >
                            <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 ${
                              isToday ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-navy-800'
                            }`}>
                              <span className={`text-[10px] ${isToday ? 'text-cyan-400' : 'text-navy-500'}`}>
                                {new Date(schedule.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                              <span className={`text-lg font-bold ${isToday ? 'text-cyan-400' : 'text-white'}`}>
                                {new Date(schedule.date + 'T12:00:00').getDate()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">{schedule.lesson_title}</p>
                              <div className="flex items-center gap-3 text-[10px] text-navy-500 mt-0.5">
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  {schedule.start_time ? `${schedule.start_time.slice(0, 5)} - ${schedule.end_time?.slice(0, 5) || '?'}` : 'All day'}
                                </span>
                                {schedule.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={10} />
                                    {schedule.location}
                                  </span>
                                )}
                                <span>{schedule.course_title}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-navy-400">{present}/{total}</span>
                                <span className={`text-xs font-medium ${rate >= 80 ? 'text-green-400' : rate >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                                  {rate}%
                                </span>
                              </div>
                              <div className="w-16 h-1.5 bg-navy-800 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full rounded-full ${rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${rate}%` }} />
                              </div>
                            </div>
                            {schedule.is_cancelled && (
                              <span className="badge text-[9px] bg-red-900/30 text-red-400">Cancelled</span>
                            )}
                          </div>
                        )
                      })}
                    {schedules.filter((s) => {
                      const d = new Date(s.date)
                      return d.getFullYear() === currentYear && d.getMonth() === currentMonth
                    }).length === 0 && (
                      <div className="p-8 text-center">
                        <Calendar className="mx-auto text-navy-600 mb-2" size={24} />
                        <p className="text-sm text-navy-400">No schedules this month.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center">
                    <Calendar className="mx-auto text-navy-600 mb-2" size={24} />
                    <p className="text-sm text-navy-400">No schedules yet.</p>
                    <p className="text-xs text-navy-500 mt-1">Schedules will appear here once lessons are scheduled.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Calendar View */
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button onClick={prevMonth} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors">
                    <ChevronLeft size={20} />
                  </button>
                  <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </h2>
                  <button onClick={nextMonth} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-7 border-b border-navy-700">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="py-2 text-center text-xs font-medium text-navy-400">{name}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarCells.map((cell, idx) => (
                  <div
                    key={idx}
                    onClick={() => cell.day && setSelectedDate(cell.key)}
                    className={`min-h-[80px] border-b border-r border-navy-800 p-1.5 transition-colors ${
                      cell.day ? 'cursor-pointer hover:bg-navy-800/50' : 'bg-navy-900/30'
                    } ${cell.isSelected ? 'bg-navy-800 ring-1 ring-cyan-500/30' : ''} ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                  >
                    {cell.day && (
                      <>
                        <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                          cell.isToday ? 'bg-cyan-500 text-white' : 'text-navy-300'
                        }`}>{cell.day}</span>
                        <div className="space-y-0.5 mt-1">
                          {cell.schedules.slice(0, 2).map((s) => (
                            <div key={s.id} className="text-[9px] px-1 py-0.5 rounded bg-cyan-900/20 text-cyan-400 truncate border-l-2 border-cyan-500">
                              {s.lesson_title}
                            </div>
                          ))}
                          {cell.schedules.length > 2 && <div className="text-[9px] text-navy-500 px-1">+{cell.schedules.length - 2}</div>}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Attendance Records for selected date */}
        <div className="xl:col-span-1">
          <div className="card sticky top-20">
            <div className="p-4 border-b border-navy-700">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white">
                  {selectedDate
                    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    : 'All Records'}
                </h3>
                {isInstructor && rollSchedules.length > 0 && (
                  <button
                    onClick={() => setRollOpen(true)}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Take Roll
                  </button>
                )}
              </div>

              {/* Date stats */}
              {selectedDate && (
                <div className="grid grid-cols-4 gap-1.5 text-center mb-3">
                  <div className="bg-navy-800 rounded p-1.5">
                    <p className="text-sm font-bold text-green-400">{dateStats.present}</p>
                    <p className="text-[9px] text-navy-500">Present</p>
                  </div>
                  <div className="bg-navy-800 rounded p-1.5">
                    <p className="text-sm font-bold text-yellow-400">{dateStats.late}</p>
                    <p className="text-[9px] text-navy-500">Late</p>
                  </div>
                  <div className="bg-navy-800 rounded p-1.5">
                    <p className="text-sm font-bold text-red-400">{dateStats.absent}</p>
                    <p className="text-[9px] text-navy-500">Absent</p>
                  </div>
                  <div className="bg-navy-800 rounded p-1.5">
                    <p className="text-sm font-bold text-navy-400">{dateStats.excused}</p>
                    <p className="text-[9px] text-navy-500">Excused</p>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="relative">
                <label htmlFor="attendance-search" className="sr-only">Search students</label>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" aria-hidden="true" />
                <input
                  id="attendance-search"
                  type="text"
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-navy-800/50 border border-navy-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-navy-200 placeholder-navy-500 focus:outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Status filter */}
              <div className="flex gap-1 mt-2" role="group" aria-label="Filter by attendance status">
                <button onClick={() => setStatusFilter('all')} aria-pressed={statusFilter === 'all'} className={`text-[9px] px-2 py-0.5 rounded border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${statusFilter === 'all' ? 'bg-navy-700 text-white border-navy-600' : 'bg-navy-800 text-navy-400 border-navy-700'}`}>All</button>
                {Object.entries(STATUS_META).map(([key, meta]) => (
                  <button key={key} onClick={() => setStatusFilter(key)} aria-pressed={statusFilter === key} className={`text-[9px] px-2 py-0.5 rounded border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${statusFilter === key ? `${meta.bg} ${meta.colour} border-current/20` : 'bg-navy-800 text-navy-400 border-navy-700'}`}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Records list */}
            <div className="max-h-[500px] overflow-y-auto divide-y divide-navy-800">
              {selectedRecords.length > 0 ? (
                selectedRecords.map((record) => {
                  const meta = STATUS_META[record.status]
                  const Icon = meta.icon
                  return (
                    <div key={record.id} className="px-4 py-3 hover:bg-navy-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                          {record.student_name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{record.student_name}</p>
                          <p className="text-[10px] text-navy-500 truncate">{record.lesson_title} &middot; {record.course_title}</p>
                        </div>
                        <span className={`badge text-[9px] flex items-center gap-0.5 ${meta.colour} ${meta.bg}`}>
                          <Icon size={10} />
                          {meta.label}
                        </span>
                      </div>
                      {record.notes && (
                        <p className="text-[10px] text-navy-500 mt-1 ml-11 italic">{record.notes}</p>
                      )}
                      {isInstructor && record.face_thumbnail && (
                        <div className="mt-1.5 ml-11 flex items-center gap-2">
                          <img
                            src={record.face_thumbnail}
                            alt="Check-in selfie"
                            className="w-8 h-8 rounded-full border border-navy-700 object-cover scale-x-[-1]"
                          />
                          {record.latitude && record.longitude && (
                            <span className="text-[10px] text-navy-500 flex items-center gap-1">
                              <MapPin size={10} className="text-green-400" />
                              {Number(record.latitude).toFixed(4)}, {Number(record.longitude).toFixed(4)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="p-6 text-center">
                  <Users className="mx-auto text-navy-600 mb-2" size={20} />
                  <p className="text-xs text-navy-400">
                    {selectedDate ? 'No attendance records for this date.' : 'Select a date to view records.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Student self-check-in button */}
      {isStudent && selectedSchedules.length > 0 && (
        <div className="mb-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Camera size={14} className="text-cyan-400" />
              Self Check-In
            </h3>
            <div className="space-y-2">
              {selectedSchedules.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelfCheckInSchedule({ id: s.id, title: s.lesson_title, course: s.course_title })}
                  className="w-full text-left p-3 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 hover:border-cyan-700/50 transition-colors"
                >
                  <p className="text-xs font-medium text-white">{s.lesson_title}</p>
                  <p className="text-[10px] text-navy-400 mt-0.5">{s.course_title} &middot; {s.start_time ? `${s.start_time.slice(0, 5)} - ${s.end_time?.slice(0, 5) || '?'}` : 'All day'}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Camera size={10} className="text-cyan-400" />
                    <span className="text-[10px] text-cyan-400">Check in with selfie + GPS</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {rollOpen && rollSchedules.length > 0 && (
        <RollCallModal
          schedules={rollSchedules}
          onClose={() => setRollOpen(false)}
        />
      )}

      {selfCheckInSchedule && (
        <SelfCheckIn
          scheduleId={selfCheckInSchedule.id}
          scheduleTitle={selfCheckInSchedule.title}
          courseTitle={selfCheckInSchedule.course}
          onClose={() => setSelfCheckInSchedule(null)}
        />
      )}
    </div>
  )
}
