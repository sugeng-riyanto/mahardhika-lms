import { useEffect, useMemo, useState } from 'react'
import { X, Save, Loader2, ClipboardCheck, Clock, MapPin } from 'lucide-react'
import type { LessonSchedule } from '@/types'
import { useScheduleRoster, useBulkUpdateAttendance } from '@/api/hooks'

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present', colour: 'text-green-400' },
  { value: 'late', label: 'Late', colour: 'text-yellow-400' },
  { value: 'absent', label: 'Absent', colour: 'text-red-400' },
  { value: 'excused', label: 'Excused', colour: 'text-navy-400' },
]

interface RollRow {
  student: string
  student_name: string
  student_email: string
  status: string
  notes: string
}

interface RollCallModalProps {
  schedules: LessonSchedule[]
  onClose: () => void
}

export function RollCallModal({ schedules, onClose }: RollCallModalProps) {
  const [scheduleId, setScheduleId] = useState<string>(schedules[0]?.id || '')
  const { data: roster, isLoading: rosterLoading } = useScheduleRoster(scheduleId || null)
  const bulkUpdate = useBulkUpdateAttendance()

  const schedule = useMemo(
    () => schedules.find((s) => s.id === scheduleId) || schedules[0],
    [schedules, scheduleId],
  )

  const [rows, setRows] = useState<RollRow[]>([])
  const [error, setError] = useState<string | null>(null)

  // (Re)initialise rows whenever the roster or selected schedule changes
  useEffect(() => {
    if (!roster || roster.schedule_id !== schedule?.id) return
    setRows(roster.students.map((s) => ({
      student: s.student,
      student_name: s.student_name,
      student_email: s.student_email,
      status: s.status || 'absent',
      notes: s.notes || '',
    })))
  }, [roster, schedule?.id])

  const changeSchedule = (id: string) => {
    setScheduleId(id)
    setError(null)
  }

  const setStatusForAll = (status: string) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })))
  }

  const updateRow = (student: string, patch: Partial<RollRow>) => {
    setRows((prev) => prev.map((r) => (r.student === student ? { ...r, ...patch } : r)))
  }

  const handleSave = async () => {
    if (!schedule) return
    setError(null)
    try {
      await bulkUpdate.mutateAsync({
        schedule_id: schedule.id,
        records: rows.map((r) => ({
          student: r.student,
          status: r.status,
          notes: r.notes,
        })),
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance.')
    }
  }

  if (!schedule) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-navy-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ClipboardCheck size={18} className="text-green-400" />
            Take Roll
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-navy-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Schedule picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor="roll-schedule" className="text-sm font-medium text-navy-300">Lesson</label>
            {schedules.length > 1 ? (
              <select
                id="roll-schedule"
                value={schedule.id}
                onChange={(e) => changeSchedule(e.target.value)}
                className="input-field text-sm flex-1 min-w-[200px]"
              >
                {schedules.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.lesson_title} — {s.course_title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm text-white">{schedule.lesson_title}</p>
                <p className="text-xs text-navy-400">{schedule.course_title}</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-navy-400">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {schedule.start_time
                ? `${schedule.start_time.slice(0, 5)} – ${schedule.end_time?.slice(0, 5) || '?'}`
                : 'All day'}
            </span>
            {schedule.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {schedule.location}
              </span>
            )}
            <span>{new Date(schedule.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>

          {rosterLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <ClipboardCheck className="mx-auto text-navy-600 mb-2" size={24} />
              <p className="text-sm text-navy-400">No enrolled students for this lesson.</p>
            </div>
          ) : (
            <>
              {/* Quick actions */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-navy-400">Mark all:</span>
                <button
                  onClick={() => setStatusForAll('present')}
                  className="text-[10px] px-2 py-1 rounded border bg-green-900/30 text-green-400 border-green-700/50 hover:bg-green-900/50"
                >
                  Present
                </button>
                <button
                  onClick={() => setStatusForAll('late')}
                  className="text-[10px] px-2 py-1 rounded border bg-yellow-900/30 text-yellow-400 border-yellow-700/50 hover:bg-yellow-900/50"
                >
                  Late
                </button>
                <button
                  onClick={() => setStatusForAll('absent')}
                  className="text-[10px] px-2 py-1 rounded border bg-red-900/30 text-red-400 border-red-700/50 hover:bg-red-900/50"
                >
                  Absent
                </button>
                <button
                  onClick={() => setStatusForAll('excused')}
                  className="text-[10px] px-2 py-1 rounded border bg-navy-800 text-navy-400 border-navy-700 hover:text-white"
                >
                  Excused
                </button>
              </div>

              {/* Student rows */}
              <div className="border border-navy-700 rounded-lg divide-y divide-navy-800 max-h-[40vh] overflow-y-auto">
                {rows.map((row) => (
                  <div key={row.student} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-navy-700 to-navy-800 flex items-center justify-center text-xs font-medium text-white flex-shrink-0">
                      {row.student_name.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{row.student_name}</p>
                      <p className="text-[10px] text-navy-500 truncate">{row.student_email}</p>
                    </div>
                    <select
                      value={row.status}
                      onChange={(e) => updateRow(row.student, { status: e.target.value })}
                      className={`input-field text-xs w-28 flex-shrink-0 ${STATUS_OPTIONS.find((o) => o.value === row.status)?.colour || ''}`}
                      aria-label={`Attendance status for ${row.student_name}`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => updateRow(row.student, { notes: e.target.value })}
                      placeholder="Note"
                      className="input-field text-xs w-36 flex-shrink-0"
                      aria-label={`Note for ${row.student_name}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-navy-400 hover:text-white transition-colors"
            disabled={bulkUpdate.isPending}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={bulkUpdate.isPending || rosterLoading || rows.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {bulkUpdate.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {bulkUpdate.isPending ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>
    </div>
  )
}
