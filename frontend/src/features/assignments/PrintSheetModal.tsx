import { X, Printer } from 'lucide-react'
import type { Assignment, AssignmentQuestion, AssignmentSubmission } from '@/types'

interface McqResult {
  question_id: string
  answer?: string | string[]
  correct: boolean
  key?: string[]
  points?: number
  explanation?: string
}

interface PrintSheetModalProps {
  assignment: Assignment
  submission: AssignmentSubmission
  isOpen: boolean
  onClose: () => void
}

function Bubble({ letter, marked, correct, keyed }: {
  letter: string
  marked: boolean
  correct: boolean
  keyed: boolean
}) {
  // Print-safe styling: borders + glyphs carry the meaning even without
  // background colours, so the sheet stays readable in B&W printouts.
  const cls = marked
    ? correct
      ? 'border-2 border-black bg-green-200 text-black'
      : 'border-2 border-black bg-red-200 text-black'
    : keyed
      ? 'border-2 border-dashed border-black text-black'
      : 'border border-gray-400 text-gray-600'
  return (
    <span
      className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold ${cls}`}
    >
      {letter.toUpperCase()}
    </span>
  )
}

export function PrintSheetModal({ assignment, submission, isOpen, onClose }: PrintSheetModalProps) {
  if (!isOpen) return null

  const questions: AssignmentQuestion[] = assignment.questions || []
  const results = (submission.content_data?.mcq_results as McqResult[] | undefined) || []
  const answers = (submission.content_data?.mcq_answers ?? {}) as Record<string, string | string[]>
  const pageCount = Math.max(1, ...questions.map((q) => q.page || 1))
  const score = submission.score
  const mcqScore = submission.content_data?.mcq_score as number | undefined
  const mcqTotal = submission.content_data?.mcq_total as number | undefined

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 print-sheet-screen">
      <div id="print-sheet" className="bg-white text-black rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto print-sheet-paper">
        {/* Toolbar — hidden when printing */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between print:hidden">
          <h3 className="font-semibold text-gray-900">Print answer sheet</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="Close print preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* The printable sheet */}
        <div className="p-6 sm:p-8">
          <header className="border-b-2 border-gray-900 pb-3 mb-4">
            <h1 className="text-lg font-bold text-gray-900">{assignment.title}</h1>
            <p className="text-sm text-gray-700 mt-1">
              Answer Sheet — {submission.student_email || 'Student'}
            </p>
            <p className="text-sm text-gray-700">
              Score: {score ?? '—'}
              {mcqScore !== undefined && mcqTotal !== undefined && ` (${mcqScore}/${mcqTotal} points)`}
              {submission.submitted_at && ` · Submitted ${new Date(submission.submitted_at).toLocaleDateString()}`}
            </p>
          </header>

          {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNo) => {
            const onPage = questions.filter((q) => (q.page || 1) === pageNo)
            if (onPage.length === 0) return null
            return (
              <section key={pageNo} className="mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                  Page {pageNo}
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {onPage.map((q) => {
                      const r = results.find((res) => res.question_id === q.id)
                      const mine = answers[q.id]
                      const mineArr = Array.isArray(mine) ? mine : mine ? [mine] : []
                      const key = r?.key || []
                      const marked = (letter: string) => mineArr.includes(letter)
                      const correct = r?.correct ?? false
                      return (
                        <tr key={q.id} className="border-b border-gray-200 last:border-0">
                          <td className="py-1.5 pr-3 align-top font-medium text-gray-900 whitespace-nowrap">
                            Q{q.order + 1}
                          </td>
                          <td className="py-1.5 pr-3 align-top">
                            <span className="inline-flex gap-1">
                              {(q.options || []).map((o) => (
                                <Bubble
                                  key={o.id}
                                  letter={o.id}
                                  marked={marked(o.id)}
                                  correct={correct}
                                  keyed={!marked(o.id) && key.includes(o.id)}
                                />
                              ))}
                            </span>
                          </td>
                          <td className="py-1.5 align-top text-right whitespace-nowrap">
                            <span className={correct ? 'text-gray-900 font-semibold' : 'text-gray-700'}>
                              {correct ? '✓' : '✗'} {r?.points ?? q.points} pt
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            )
          })}

          <footer className="mt-4 pt-3 border-t border-gray-300 text-xs text-gray-600">
            Legend: solid bubble = student's answer (green ✓ correct, red ✗ wrong) · dashed bubble =
            correct answer · blank = unanswered.
          </footer>
        </div>
      </div>
    </div>
  )
}