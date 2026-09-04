import { describe, it, expect } from 'vitest'
import { buildCSV } from '@/utils/csvExport'
import {
  SCHEDULE_CSV_COLUMNS,
  RECORD_CSV_COLUMNS,
  inViewedMonth,
  filterAttendanceRecords,
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

// -- Panel filter -> CSV mapping --------------------------------------------
// AttendancePage exports filterAttendanceRecords(records, { selectedDate,
// status: statusFilter, search: searchQuery }) — the same filtering the panel
// renders — and the records CSV is built from that result. These tests drive
// the real pipeline (filter + column formatting + CSV builder) so the
// date/status/search wiring is regression-tested end to end.

describe('attendance export filter -> CSV mapping', () => {
  const FILTER_RECORDS = [
    record('2026-09-07', { id: 'a', student_name: 'Student Mahardhika', student_email: 'student@mahardhika.id', status: 'present', notes: 'On time' }),
    record('2026-09-07', { id: 'b', student_name: 'Student Mahardhika', status: 'late', notes: 'Traffic' }),
    record('2026-09-10', { id: 'c', student_name: 'Budiman Santoso', student_email: 'budiman@mahardhika.id', status: 'absent' }),
    record('2026-08-31', { id: 'd', student_name: 'Student Mahardhika', status: 'present' }),
  ]

  const csvRows = (records: typeof FILTER_RECORDS) =>
    buildCSV(filterAttendanceRecords(records, {
      selectedDate: '2026-09-07',
      status: 'all',
      search: '',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())

  it('date filter limits the CSV to the selected day (no date keeps all dates)', () => {
    // A record on a different date (Sep 10) and another month (Aug 31) are both excluded.
    const rows = csvRows(FILTER_RECORDS)
    expect(rows).toHaveLength(2)
    for (const row of rows) expect(row).toContain('7/9/2026')
    expect(rows[0]).toContain('present')
    expect(rows[1]).toContain('late')

    const allDates = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: null,
      status: 'all',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())
    expect(allDates).toHaveLength(4) // the panel's "All Records" view
  })

  it('status filter keeps only matching statuses in the CSV', () => {
    const rows = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: '2026-09-07',
      status: 'late',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('Traffic')
    expect(rows[0]).toContain(',late,')
  })

  it('search matches student name or email case-insensitively', () => {
    // "santoso" only appears in Budiman Santoso's name — one match.
    // (Avoid "mahar": every fixture email is @mahardhika.id, so it matches all.)
    const byPartialName = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: null,
      search: 'santoso',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())
    expect(byPartialName).toHaveLength(1)
    expect(byPartialName[0]).toContain('Budiman Santoso')

    // Uppercase search still matches the lowercase email.
    const byPartialEmail = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: null,
      search: 'BUDIMAN',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())
    expect(byPartialEmail).toHaveLength(1)
    expect(byPartialEmail[0]).toContain('budiman@mahardhika.id')
  })

  it('combines date + status + search like the panel does', () => {
    const rows = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: '2026-09-07',
      status: 'present',
      search: 'student',
    }), RECORD_COLUMNS).split('\n').filter((l, i) => i > 0 && l.trim())
    expect(rows).toHaveLength(1) // only Sep 7 present record of that student
    expect(rows[0]).toContain('On time')
  })

  it('no matches yields a header-only records file', () => {
    const csv = buildCSV(filterAttendanceRecords(FILTER_RECORDS, {
      selectedDate: '2026-09-07',
      status: 'absent',
    }), RECORD_COLUMNS)
    expect(csv).toBe('Date,Lesson,Course,Student,Email,Status,Notes,Marked By,Marked At')
  })
})
