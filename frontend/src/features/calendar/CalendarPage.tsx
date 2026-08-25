import { useState, useMemo } from 'react'
import {
  Calendar, ChevronLeft, ChevronRight, Clock, MapPin, Users,
  BookOpen, CheckCircle, XCircle, AlertCircle, Download,
  GraduationCap, FileText, PenTool
} from 'lucide-react'

interface CalendarEvent {
  id: string
  title: string
  date: string
  time_start: string
  time_end: string
  type: 'lesson' | 'assignment' | 'exam' | 'activity' | 'meeting'
  course: string
  location: string | null
  colour: string
}

interface AttendanceRecord {
  id: string
  student_name: string
  student_email: string
  status: 'present' | 'absent' | 'late' | 'excused'
  date: string
  course: string
  notes: string | null
}

const EVENT_TYPES = {
  lesson: { label: 'Lesson', icon: BookOpen, colour: 'text-cyan-400', bg: 'bg-cyan-900/40', border: 'border-l-cyan-500' },
  assignment: { label: 'Assignment', icon: FileText, colour: 'text-purple-400', bg: 'bg-purple-900/40', border: 'border-l-purple-500' },
  exam: { label: 'Exam', icon: GraduationCap, colour: 'text-red-400', bg: 'bg-red-900/40', border: 'border-l-red-500' },
  activity: { label: 'Activity', icon: PenTool, colour: 'text-green-400', bg: 'bg-green-900/40', border: 'border-l-green-500' },
  meeting: { label: 'Meeting', icon: Users, colour: 'text-orange-400', bg: 'bg-orange-900/40', border: 'border-l-orange-500' },
}

const STATUS_META = {
  present: { label: 'Present', icon: CheckCircle, colour: 'text-green-400', bg: 'bg-green-900/30' },
  absent: { label: 'Absent', icon: XCircle, colour: 'text-red-400', bg: 'bg-red-900/30' },
  late: { label: 'Late', icon: AlertCircle, colour: 'text-yellow-400', bg: 'bg-yellow-900/30' },
  excused: { label: 'Excused', icon: CheckCircle, colour: 'text-navy-400', bg: 'bg-navy-800' },
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const MOCK_EVENTS: CalendarEvent[] = [
  // August 2026
  { id: 'e1', title: 'Algebra: Linear Equations', date: '2026-08-25', time_start: '08:00', time_end: '09:30', type: 'lesson', course: 'Mathematics 7A', location: 'Room 201', colour: 'border-l-cyan-500' },
  { id: 'e2', title: 'Newton\'s Laws Discussion', date: '2026-08-25', time_start: '10:00', time_end: '11:30', type: 'lesson', course: 'Physics 10', location: 'Lab 3', colour: 'border-l-cyan-500' },
  { id: 'e3', title: 'Chemistry Lab: Periodic Table', date: '2026-08-26', time_start: '08:00', time_end: '10:00', type: 'activity', course: 'Science 7', location: 'Science Lab', colour: 'border-l-green-500' },
  { id: 'e4', title: 'Essay: Newton\'s Laws', date: '2026-08-27', time_start: '23:59', time_end: '23:59', type: 'assignment', course: 'Physics 10', location: null, colour: 'border-l-purple-500' },
  { id: 'e5', title: 'Mid-term: Mathematics 7A', date: '2026-08-28', time_start: '09:00', time_end: '11:00', type: 'exam', course: 'Mathematics 7A', location: 'Hall A', colour: 'border-l-red-500' },
  { id: 'e6', title: 'Parent-Teacher Meeting', date: '2026-08-29', time_start: '14:00', time_end: '16:00', type: 'meeting', course: 'All', location: 'Conference Room', colour: 'border-l-orange-500' },
  { id: 'e7', title: 'Geometry: Triangles', date: '2026-08-25', time_start: '13:00', time_end: '14:30', type: 'lesson', course: 'Mathematics 7A', location: 'Room 201', colour: 'border-l-cyan-500' },
  { id: 'e8', title: 'IELTS Writing Practice', date: '2026-08-26', time_start: '11:00', time_end: '12:30', type: 'lesson', course: 'IELTS Academic Writing', location: 'Room 105', colour: 'border-l-cyan-500' },
  { id: 'e9', title: 'Thermodynamics Lab', date: '2026-08-27', time_start: '10:00', time_end: '12:00', type: 'activity', course: 'Physics 10', location: 'Lab 3', colour: 'border-l-green-500' },
  { id: 'e10', title: 'Cell Biology Lecture', date: '2026-08-28', time_start: '13:00', time_end: '14:30', type: 'lesson', course: 'Science 7', location: 'Room 202', colour: 'border-l-cyan-500' },
  { id: 'e11', title: 'Robotics Workshop', date: '2026-08-29', time_start: '09:00', time_end: '12:00', type: 'activity', course: 'Robotics Workshop', location: 'Maker Space', colour: 'border-l-green-500' },
  { id: 'e12', title: 'Algebra Quiz', date: '2026-08-30', time_start: '08:00', time_end: '08:45', type: 'exam', course: 'Mathematics 7A', location: 'Room 201', colour: 'border-l-red-500' },
  // September 2026
  { id: 'e13', title: 'Vectors & Forces', date: '2026-09-01', time_start: '08:00', time_end: '09:30', type: 'lesson', course: 'Physics 10', location: 'Lab 3', colour: 'border-l-cyan-500' },
  { id: 'e14', title: 'Number Theory', date: '2026-09-01', time_start: '10:00', time_end: '11:30', type: 'lesson', course: 'Mathematics 7A', location: 'Room 201', colour: 'border-l-cyan-500' },
  { id: 'e15', title: 'Assignment: Geometry Problems', date: '2026-09-03', time_start: '23:59', time_end: '23:59', type: 'assignment', course: 'Mathematics 7A', location: null, colour: 'border-l-purple-500' },
  { id: 'e16', title: 'Physics Lab: Wave Interference', date: '2026-09-04', time_start: '10:00', time_end: '12:00', type: 'activity', course: 'Physics 10', location: 'Lab 3', colour: 'border-l-green-500' },
  { id: 'e17', title: 'Staff Meeting', date: '2026-09-05', time_start: '15:00', time_end: '16:00', type: 'meeting', course: 'Staff', location: 'Conference Room', colour: 'border-l-orange-500' },
  { id: 'e18', title: 'IELTS Speaking Test', date: '2026-09-02', time_start: '09:00', time_end: '12:00', type: 'exam', course: 'IELTS Academic Writing', location: 'Room 105', colour: 'border-l-red-500' },
  { id: 'e19', title: 'Biology: Ecosystems', date: '2026-09-03', time_start: '08:00', time_end: '09:30', type: 'lesson', course: 'Science 7', location: 'Room 202', colour: 'border-l-cyan-500' },
  { id: 'e20', title: 'Calculus: Derivatives', date: '2026-09-04', time_start: '13:00', time_end: '14:30', type: 'lesson', course: 'Advanced Mathematics', location: 'Room 301', colour: 'border-l-cyan-500' },
]

const MOCK_ATTENDANCE: AttendanceRecord[] = [
  { id: 'a1', student_name: 'Ahmad Rizky', student_email: 'ahmad@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Mathematics 7A', notes: null },
  { id: 'a2', student_name: 'Siti Nurhaliza', student_email: 'siti@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Mathematics 7A', notes: null },
  { id: 'a3', student_name: 'Budi Santoso', student_email: 'budi@student.mahardhika.id', status: 'late', date: '2026-08-25', course: 'Mathematics 7A', notes: 'Arrived 10 minutes late' },
  { id: 'a4', student_name: 'Dewi Lestari', student_email: 'dewi@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Mathematics 7A', notes: null },
  { id: 'a5', student_name: 'Rudi Hermawan', student_email: 'rudi@student.mahardhika.id', status: 'absent', date: '2026-08-25', course: 'Mathematics 7A', notes: 'No prior notification' },
  { id: 'a6', student_name: 'Putri Ayu', student_email: 'putri@student.mahardhika.id', status: 'excused', date: '2026-08-25', course: 'Mathematics 7A', notes: 'Medical appointment' },
  { id: 'a7', student_name: 'Farhan Maulana', student_email: 'farhan@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Mathematics 7A', notes: null },
  { id: 'a8', student_name: 'Aisha Patel', student_email: 'aisha@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Mathematics 7A', notes: null },
  // Physics 10
  { id: 'a9', student_name: 'Dewi Lestari', student_email: 'dewi@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Physics 10', notes: null },
  { id: 'a10', student_name: 'Rudi Hermawan', student_email: 'rudi@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Physics 10', notes: null },
  { id: 'a11', student_name: 'Aisha Patel', student_email: 'aisha@student.mahardhika.id', status: 'present', date: '2026-08-25', course: 'Physics 10', notes: null },
  // Aug 26
  { id: 'a12', student_name: 'Ahmad Rizky', student_email: 'ahmad@student.mahardhika.id', status: 'present', date: '2026-08-26', course: 'Science 7', notes: null },
  { id: 'a13', student_name: 'Siti Nurhaliza', student_email: 'siti@student.mahardhika.id', status: 'late', date: '2026-08-26', course: 'Science 7', notes: 'Bus delay' },
  { id: 'a14', student_name: 'Budi Santoso', student_email: 'budi@student.mahardhika.id', status: 'present', date: '2026-08-26', course: 'Science 7', notes: null },
  { id: 'a15', student_name: 'Putri Ayu', student_email: 'putri@student.mahardhika.id', status: 'present', date: '2026-08-26', course: 'Science 7', notes: null },
]

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function CalendarPage() {
  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDateKey(today.getFullYear(), today.getMonth(), today.getDate()))
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [showAttendance, setShowAttendance] = useState(false)
  const [attendanceFilter, setAttendanceFilter] = useState<string>('all')

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
    setSelectedDate(null)
  }

  const goToToday = () => {
    setCurrentYear(today.getFullYear())
    setCurrentMonth(today.getMonth())
    setSelectedDate(todayKey)
  }

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const event of MOCK_EVENTS) {
      const filtered = typeFilter === 'all' || event.type === typeFilter
      if (filtered) {
        if (!map[event.date]) map[event.date] = []
        map[event.date].push(event)
      }
    }
    return map
  }, [typeFilter])

  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : []

  const filteredAttendance = MOCK_ATTENDANCE.filter((a) => {
    const matchesDate = !selectedDate || a.date === selectedDate
    const matchesFilter = attendanceFilter === 'all' || a.status === attendanceFilter
    return matchesDate && matchesFilter
  })

  const attendanceStats = useMemo(() => {
    const total = MOCK_ATTENDANCE.length
    const present = MOCK_ATTENDANCE.filter((a) => a.status === 'present').length
    const late = MOCK_ATTENDANCE.filter((a) => a.status === 'late').length
    const absent = MOCK_ATTENDANCE.filter((a) => a.status === 'absent').length
    const excused = MOCK_ATTENDANCE.filter((a) => a.status === 'excused').length
    return { total, present, late, absent, excused, rate: total > 0 ? Math.round(((present + late) / total) * 100) : 0 }
  }, [])

  const calendarCells = useMemo(() => {
    const cells: { day: number | null; key: string | null; isToday: boolean; isSelected: boolean; events: CalendarEvent[] }[] = []
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null, key: null, isToday: false, isSelected: false, events: [] })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const key = formatDateKey(currentYear, currentMonth, d)
      cells.push({
        day: d,
        key,
        isToday: key === todayKey,
        isSelected: key === selectedDate,
        events: eventsByDate[key] || [],
      })
    }
    return cells
  }, [currentYear, currentMonth, firstDay, daysInMonth, todayKey, selectedDate, eventsByDate])

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="text-green-400" size={24} />
          <h1 className="page-title mb-0">Calendar & Attendance</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAttendance(!showAttendance)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              showAttendance
                ? 'bg-green-900/30 text-green-400 border-green-700/50'
                : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
            }`}
          >
            <Users size={14} className="inline mr-1" />
            Attendance
          </button>
          <button className="btn-secondary text-sm flex items-center gap-1">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-2xl font-bold text-white">{MOCK_EVENTS.length}</p>
          <p className="text-sm text-navy-400">Events This Month</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-cyan-400">{MOCK_EVENTS.filter((e) => e.type === 'lesson').length}</p>
          <p className="text-sm text-navy-400">Lessons</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-purple-400">{MOCK_EVENTS.filter((e) => e.type === 'assignment').length}</p>
          <p className="text-sm text-navy-400">Assignments</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-bold text-green-400">{attendanceStats.rate}%</p>
          <p className="text-sm text-navy-400">Attendance Rate</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className={`${showAttendance ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
          {/* Calendar header */}
          <div className="card mb-4">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" aria-label="Previous month">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-white min-w-[180px] text-center">
                  {MONTH_NAMES[currentMonth]} {currentYear}
                </h2>
                <button onClick={nextMonth} className="p-1.5 text-navy-400 hover:text-white rounded-lg hover:bg-navy-800 transition-colors" aria-label="Next month">
                  <ChevronRight size={20} />
                </button>
              </div>
              <button onClick={goToToday} className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">
                Today
              </button>
            </div>

            {/* Type filter pills */}
            <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
                  typeFilter === 'all'
                    ? 'bg-navy-700 text-white border-navy-600'
                    : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                }`}
              >
                All
              </button>
              {Object.entries(EVENT_TYPES).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
                    typeFilter === key
                      ? `${meta.bg} ${meta.colour} border-current/20`
                      : 'bg-navy-800 text-navy-400 border-navy-700 hover:text-white'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="card overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-navy-700">
              {DAY_NAMES.map((name) => (
                <div key={name} className="py-2 text-center text-xs font-medium text-navy-400">
                  {name}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, idx) => (
                <div
                  key={idx}
                  onClick={() => cell.day && setSelectedDate(cell.key)}
                  className={`min-h-[90px] border-b border-r border-navy-800 p-1.5 transition-colors ${
                    cell.day ? 'cursor-pointer hover:bg-navy-800/50' : 'bg-navy-900/30'
                  } ${cell.isSelected ? 'bg-navy-800 ring-1 ring-cyan-500/30' : ''} ${
                    idx % 7 === 6 ? 'border-r-0' : ''
                  }`}
                >
                  {cell.day && (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                            cell.isToday
                              ? 'bg-cyan-500 text-white'
                              : 'text-navy-300'
                          }`}
                        >
                          {cell.day}
                        </span>
                        {cell.events.length > 0 && (
                          <span className="text-[9px] text-navy-500">{cell.events.length}</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {cell.events.slice(0, 3).map((event) => {
                          const meta = EVENT_TYPES[event.type]
                          return (
                            <div
                              key={event.id}
                              className={`text-[9px] px-1 py-0.5 rounded truncate border-l-2 ${meta.border} ${meta.bg}`}
                              title={`${event.title} — ${event.course}`}
                            >
                              <span className={meta.colour}>{event.title}</span>
                            </div>
                          )
                        })}
                        {cell.events.length > 3 && (
                          <div className="text-[9px] text-navy-500 px-1">
                            +{cell.events.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Selected date events */}
          {selectedDate && (
            <div className="card mt-4">
              <div className="p-4 border-b border-navy-700">
                <h3 className="text-sm font-semibold text-white">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </h3>
                <p className="text-xs text-navy-400 mt-0.5">{selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}</p>
              </div>
              {selectedEvents.length > 0 ? (
                <div className="divide-y divide-navy-800">
                  {selectedEvents.map((event) => {
                    const meta = EVENT_TYPES[event.type]
                    const Icon = meta.icon
                    return (
                      <div key={event.id} className={`p-4 flex items-start gap-4 hover:bg-navy-800/50 transition-colors border-l-4 ${event.colour}`}>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${meta.bg} flex-shrink-0`}>
                          <Icon size={18} className={meta.colour} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium text-white">{event.title}</p>
                              <p className="text-xs text-navy-400">{event.course}</p>
                            </div>
                            <span className={`badge text-[10px] ${meta.colour} ${meta.bg}`}>{meta.label}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-xs text-navy-500">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {event.time_start === event.time_end ? event.time_start : `${event.time_start} – ${event.time_end}`}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin size={10} />
                                {event.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <Calendar className="mx-auto text-navy-600 mb-2" size={24} />
                  <p className="text-sm text-navy-400">No events on this day.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attendance panel */}
        {showAttendance && (
          <div className="xl:col-span-1">
            <div className="card sticky top-20">
              <div className="p-4 border-b border-navy-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Attendance</h3>
                  <button className="text-xs text-cyan-400 hover:text-cyan-300">Take Roll</button>
                </div>

                {/* Attendance stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-navy-800 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-400">{attendanceStats.present}</p>
                    <p className="text-[10px] text-navy-400">Present</p>
                  </div>
                  <div className="bg-navy-800 rounded-lg p-2">
                    <p className="text-lg font-bold text-yellow-400">{attendanceStats.late}</p>
                    <p className="text-[10px] text-navy-400">Late</p>
                  </div>
                  <div className="bg-navy-800 rounded-lg p-2">
                    <p className="text-lg font-bold text-red-400">{attendanceStats.absent}</p>
                    <p className="text-[10px] text-navy-400">Absent</p>
                  </div>
                  <div className="bg-navy-800 rounded-lg p-2">
                    <p className="text-lg font-bold text-navy-400">{attendanceStats.excused}</p>
                    <p className="text-[10px] text-navy-400">Excused</p>
                  </div>
                </div>

                {/* Attendance rate bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-navy-400">Attendance Rate</span>
                    <span className="text-green-400 font-medium">{attendanceStats.rate}%</span>
                  </div>
                  <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all"
                      style={{ width: `${attendanceStats.rate}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Filter */}
              <div className="px-4 py-2 border-b border-navy-700">
                <select
                  value={attendanceFilter}
                  onChange={(e) => setAttendanceFilter(e.target.value)}
                  className="input-field text-xs w-full"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>

              {/* Attendance records */}
              <div className="max-h-[400px] overflow-y-auto divide-y divide-navy-800">
                {filteredAttendance.length > 0 ? (
                  filteredAttendance.map((record) => {
                    const meta = STATUS_META[record.status]
                    const Icon = meta.icon
                    return (
                      <div key={record.id} className="px-4 py-3 hover:bg-navy-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                            {record.student_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">{record.student_name}</p>
                            <p className="text-[10px] text-navy-500 truncate">{record.course}</p>
                          </div>
                          <span className={`badge text-[9px] flex items-center gap-0.5 ${meta.colour} ${meta.bg}`}>
                            <Icon size={10} />
                            {meta.label}
                          </span>
                        </div>
                        {record.notes && (
                          <p className="text-[10px] text-navy-500 mt-1 ml-11 italic">{record.notes}</p>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="p-6 text-center">
                    <Users className="mx-auto text-navy-600 mb-2" size={20} />
                    <p className="text-xs text-navy-400">No attendance records.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
