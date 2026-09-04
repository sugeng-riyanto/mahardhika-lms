/**
 * CSV export for lesson schedules and attendance records.
 *
 * Shared by the Calendar and Attendance pages — exports the schedules and
 * attendance records for a viewed month so the file matches what is on screen.
 */
import { exportToCSV, formatDate, type CSVColumn } from '@/utils/csvExport'
import type { LessonSchedule, AttendanceRecord } from '@/types'

const SCHEDULE_CSV_COLUMNS: CSVColumn[] = [
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

const RECORD_CSV_COLUMNS: CSVColumn[] = [
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
