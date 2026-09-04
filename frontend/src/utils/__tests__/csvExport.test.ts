import { describe, it, expect } from 'vitest'
import { buildCSV } from '@/utils/csvExport'
import {
  SCHEDULE_CSV_COLUMNS,
  RECORD_CSV_COLUMNS,
  inViewedMonth,
} from '@/utils/attendanceExport'
import type { LessonSchedule, AttendanceRecord } from '@/types'

const SCHEDULE_COLUMNS = SCHEDULE_CSV_COLUMNS as { key: string; label: string }[]
const RECORD_COLUMNS = RECORD_CSV_COLUMNS as { key: string; label: string }[]

// -- Fixtures ---------------------------------------------------------------

function schedule(date: string, overrides: Partial<LessonSchedule> = {}): LessonSchedule {
  return {
    id: `s-${date}`,
    lesson: 'l1',
    lesson_title: 'Algebraic Expressions',
    course: 'c1',
    course_title: 'Mathematics 7A',
    date,
    start_time: '08:00:00',
    end_time: '09:30:00',
    location: 'Room 201',
    is_cancelled: false,
    cancellation_reason: '',
    notes: '',
    attendance_count: { total: 1, present: 1 },
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

function record(date: string, overrides: Partial<AttendanceRecord> = {}): AttendanceRecord {
  return {
    id: `r-${date}`,
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
    schedule_date: date,
    course_title: 'Mathematics 7A',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

// A month-mixed dataset: the page filters with inViewedMonth before exporting,
// so an August/October row must never reach the CSV for September.
const SCHEDULES = [
  schedule('2026-09-07', { id: 's-sep-07', lesson_title: 'Algebraic Expressions' }),
  schedule('2026-09-10', { id: 's-sep-10', is_cancelled: true, attendance_count: { total: 0, present: 0 } }),
  schedule('2026-08-31', { id: 's-aug-31' }), // previous month
  schedule('2026-10-01', { id: 's-oct-01' }), // next month
]

const RECORDS = [
  record('2026-09-07', { id: 'r-sep-07-a', status: 'present', notes: 'On time' }),
  record('2026-09-07', { id: 'r-sep-07-b', status: 'late', notes: 'Arrived late, has a comma, though' }),
  record('2026-09-10', { id: 'r-sep-10', status: 'excused', notes: 'Medical appointment' }),
  record('2026-08-31', { id: 'r-aug-31', status: 'absent' }), // previous month
]

const SEPTEMBER_SCHEDULES = SCHEDULES.filter((s) => inViewedMonth(s.date, 2026, 8))
const SEPTEMBER_RECORDS = RECORDS.filter((r) => inViewedMonth(r.schedule_date, 2026, 8))

// -- Month scoping ----------------------------------------------------------

describe('month-scoped attendance CSV export', () => {
  it('inViewedMonth keeps only September rows from the mixed dataset', () => {
    expect(SEPTEMBER_SCHEDULES.map((s) => s.id)).toEqual(['s-sep-07', 's-sep-10'])
    expect(SEPTEMBER_RECORDS.map((r) => r.id)).toEqual(['r-sep-07-a', 'r-sep-07-b', 'r-sep-10'])
  })

  it('schedules CSV has the exact header and one row per September schedule', () => {
    const csv = buildCSV(SEPTEMBER_SCHEDULES, SCHEDULE_COLUMNS)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Date,Start,End,Lesson,Course,Location,Status,Marked (present/total),Notes')
    expect(lines.length - 1).toBe(2)
    // Cancelled row renders its status through the column formatter.
    expect(lines[2]).toContain('Cancelled')
    expect(lines[2]).toContain('0/0')
  })

  it('records CSV has the exact header and one row per September record', () => {
    const csv = buildCSV(SEPTEMBER_RECORDS, RECORD_COLUMNS)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('Date,Lesson,Course,Student,Email,Status,Notes,Marked By,Marked At')
    expect(lines.length - 1).toBe(3)
    expect(lines[1]).toContain('present')
    expect(lines[3]).toContain('excused')
  })

  it('cells containing commas are quoted so they do not inflate the row count', () => {
    const csv = buildCSV([...SEPTEMBER_RECORDS], RECORD_COLUMNS)
    const lines = csv.split('\n')
    // The "late" row's note contains a comma and must stay a single line.
    expect(lines.length - 1).toBe(3)
    expect(lines[2]).toContain('"Arrived late, has a comma, though"')
  })

  it('empty month data still produces a header-only file', () => {
    const csv = buildCSV([], SCHEDULE_COLUMNS)
    expect(csv).toBe('Date,Start,End,Lesson,Course,Location,Status,Marked (present/total),Notes')
  })
})
