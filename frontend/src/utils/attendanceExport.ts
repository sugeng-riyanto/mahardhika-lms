/**
 * CSV export for lesson schedules and attendance records.
 *
 * Shared by the Calendar and Attendance pages — exports the schedules and
 * attendance records for a viewed month so the file matches what is on screen.
 */
import { exportToCSV, formatDate, type CSVColumn } from '@/utils/csvExport'
import type { LessonSchedule, AttendanceRecord } from '@/types'

export const SCHEDULE_CSV_COLUMNS: CSVColumn[] = [
  { key: 'date', label: 'Date', format: formatDate },
  { key: 'start_time', label: 'Start', format: (v) => (v ? String(v).slice(0, 5) : 'All day') },
  { key: 'end_time', label: 'End', format: (v) => (v ? String(v).slice(0, 5) : 'All day') },
  { key: 'lesson_title', label: 'Lesson' },
  { key: 'course_title', label: 'Course' },
  { key: 'location', label: 'Location' },
  { key: 'is_cancelled', label: 'Status', format: (v) => (v ? 'Cancelled' : 'Scheduled') },
  { key: 'attendance_count', label: 'Marked (present/total)', format: (v) => {
    const count = v as { present?: number; total?: number } | null
    return count ? `${count.present ?? 0}/${count.total ?? 0}` : '0/0'
  } },
  { key: 'notes', label: 'Notes' },
]

export const RECORD_CSV_COLUMNS: CSVColumn[] = [
  { key: 'schedule_date', label: 'Date', format: formatDate },
  { key: 'lesson_title', label: 'Lesson' },
  { key: 'course_title', label: 'Course' },
  { key: 'student_name', label: 'Student' },
  { key: 'student_email', label: 'Email' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
  { key: 'marked_by_email', label: 'Marked By' },
  { key: 'marked_at', label: 'Marked At', format: (v) => (v ? new Date(String(v)).toLocaleString('id-ID') : '') },
]

export function exportAttendanceSchedules(schedules: LessonSchedule[]): void {
  exportToCSV(schedules, SCHEDULE_CSV_COLUMNS, 'attendance-schedules')
}

export function exportAttendanceRecords(records: AttendanceRecord[]): void {
  exportToCSV(records, RECORD_CSV_COLUMNS, 'attendance-records')
}

/**
 * Filter attendance records the way the attendance panel renders them.
 *
 * This is the exact filter both the Attendance and Calendar pages apply to
 * decide what rows are visible — and therefore what the records CSV exports.
 * Extracted so the panel/export wiring is unit-testable as one source of truth.
 *
 * - selectedDate: only records on that day; null/undefined keeps all dates
 *   (the panel's "All Records" view)
 * - status: 'all' (default) or one of present/late/absent/excused
 * - search: case-insensitive match on student name or email; '' disables
 */
export function filterAttendanceRecords(
  records: AttendanceRecord[],
  { selectedDate, status = 'all', search = '' }: {
    selectedDate?: string | null
    status?: string
    search?: string
  },
): AttendanceRecord[] {
  const q = search.trim().toLowerCase()
  return records.filter((r) => {
    const matchesDate = !selectedDate || r.schedule_date === selectedDate
    const matchesStatus = status === 'all' || r.status === status
    const matchesSearch =
      !q ||
      r.student_name.toLowerCase().includes(q) ||
      r.student_email.toLowerCase().includes(q)
    return matchesDate && matchesStatus && matchesSearch
  })
}

/**
 * Download both files from one Export click. The second download is deferred
 * briefly: Chromium drops a second programmatic anchor click that happens in
 * the same task as the first, so the records file never downloads otherwise.
 */
export function exportAttendanceFiles(schedules: LessonSchedule[], records: AttendanceRecord[]): void {
  exportAttendanceSchedules(schedules)
  setTimeout(() => exportAttendanceRecords(records), 500)
}

/**
 * Whether an ISO date key (YYYY-MM-DD) falls inside the given month.
 */
export function inViewedMonth(dateKey: string, year: number, month: number): boolean {
  if (!dateKey) return false
  const d = new Date(dateKey + 'T12:00:00')
  return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month
}
