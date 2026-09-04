import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as csvUtil from '@/utils/csvExport'
import {
  exportAttendanceSchedules,
  exportAttendanceRecords,
  inViewedMonth,
  SCHEDULE_CSV_COLUMNS,
  RECORD_CSV_COLUMNS,
} from '@/utils/attendanceExport'
import type { LessonSchedule, AttendanceRecord } from '@/types'

vi.mock('@/utils/csvExport', () => ({
  exportToCSV: vi.fn(),
  formatDate: (value: unknown) =>
    value ? new Date(String(value) + 'T12:00:00').toLocaleDateString('id-ID') : '',
  formatBoolean: (value: unknown) => (value ? 'Yes' : 'No'),
  formatCurrency: () => '',
}))

const SCHEDULE: LessonSchedule = {
  id: 's1',
  lesson: 'l1',
  lesson_title: 'Algebraic Expressions',
  course: 'c1',
  course_title: 'Mathematics 7A',
  date: '2026-09-07',
  start_time: '08:00:00',
  end_time: '09:30:00',
  location: 'Room 201',
  is_cancelled: false,
  cancellation_reason: '',
  notes: '',
  attendance_count: { total: 1, present: 1 },
  created_at: '',
  updated_at: '',
}

const RECORD: AttendanceRecord = {
  id: 'r1',
  schedule: 's1',
  student: 'u1',
  student_email: 'student@mahardhika.id',
  student_name: 'Student Mahardhika',
  status: 'present',
  notes: '',
  marked_by: 'u2',
  marked_by_email: 'instructor@mahardhika.id',
  marked_at: '2026-09-07T08:05:00Z',
  lesson_title: 'Algebraic Expressions',
  schedule_date: '2026-09-07',
  course_title: 'Mathematics 7A',
  created_at: '',
  updated_at: '',
}

describe('inViewedMonth', () => {
  it('returns true for a date inside the viewed month', () => {
    expect(inViewedMonth('2026-09-07', 2026, 8)).toBe(true)
  })

  it('returns false for a date in another month of the same year', () => {
    expect(inViewedMonth('2026-08-31', 2026, 8)).toBe(false)
    expect(inViewedMonth('2026-10-01', 2026, 8)).toBe(false)
  })

  it('returns false for the same month in a different year', () => {
    expect(inViewedMonth('2025-09-15', 2026, 8)).toBe(false)
    expect(inViewedMonth('2027-09-15', 2026, 8)).toBe(false)
  })

  it('returns false for empty or invalid dates', () => {
    expect(inViewedMonth('', 2026, 8)).toBe(false)
    expect(inViewedMonth('not-a-date', 2026, 8)).toBe(false)
  })

  it('keeps month boundaries correct (first and last day of month)', () => {
    expect(inViewedMonth('2026-09-01', 2026, 8)).toBe(true)
    expect(inViewedMonth('2026-09-30', 2026, 8)).toBe(true)
  })
})

describe('exportAttendanceSchedules', () => {
  beforeEach(() => {
    vi.mocked(csvUtil.exportToCSV).mockClear()
  })

  it('forwards the schedules to exportToCSV under the schedules filename', () => {
    exportAttendanceSchedules([SCHEDULE])
    expect(csvUtil.exportToCSV).toHaveBeenCalledWith(
      [SCHEDULE],
      SCHEDULE_CSV_COLUMNS,
      'attendance-schedules',
    )
  })

  it('formats schedule rows for CSV (time, status, marked count)', () => {
    const col = (label: string) => SCHEDULE_CSV_COLUMNS.find((c) => c.label === label)!
    expect(col('Start')!.format!(SCHEDULE.start_time, SCHEDULE)).toBe('08:00')
    expect(col('End')!.format!(SCHEDULE.end_time, SCHEDULE)).toBe('09:30')
    expect(col('Status')!.format!(false, SCHEDULE)).toBe('Scheduled')
    expect(col('Status')!.format!(true, SCHEDULE)).toBe('Cancelled')
    expect(col('Marked (present/total)')!.format!(SCHEDULE.attendance_count, SCHEDULE)).toBe('1/1')
    expect(col('Date')!.format!(SCHEDULE.date, SCHEDULE)).toContain('2026')
  })
})

describe('exportAttendanceRecords', () => {
  beforeEach(() => {
    vi.mocked(csvUtil.exportToCSV).mockClear()
  })

  it('forwards the records to exportToCSV under the records filename', () => {
    exportAttendanceRecords([RECORD])
    expect(csvUtil.exportToCSV).toHaveBeenCalledWith(
      [RECORD],
      RECORD_CSV_COLUMNS,
      'attendance-records',
    )
  })

  it('formats record rows for CSV (status passthrough, marked at locale)', () => {
    const col = (label: string) => RECORD_CSV_COLUMNS.find((c) => c.label === label)!
    // Status and Marked By are exported raw via their keys (no formatters)
    expect(col('Status')!.key).toBe('status')
    expect(col('Marked By')!.key).toBe('marked_by_email')
    expect(col('Marked At')!.format!(RECORD.marked_at, RECORD)).not.toBe('')
  })
})

describe('CSV column definitions', () => {
  it('schedules columns expose the expected labels', () => {
    const labels = SCHEDULE_CSV_COLUMNS.map((c) => c.label)
    expect(labels).toEqual([
      'Date', 'Start', 'End', 'Lesson', 'Course', 'Location',
      'Status', 'Marked (present/total)', 'Notes',
    ])
  })

  it('records columns expose the expected labels', () => {
    const labels = RECORD_CSV_COLUMNS.map((c) => c.label)
    expect(labels).toEqual([
      'Date', 'Lesson', 'Course', 'Student', 'Email', 'Status',
      'Notes', 'Marked By', 'Marked At',
    ])
  })
})
