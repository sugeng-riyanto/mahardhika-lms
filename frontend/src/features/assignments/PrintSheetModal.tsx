import { useEffect, useState } from 'react'
import { X, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { apiClient } from '@/api/client'
import { t } from '@/i18n/translations'
import type { Assignment, AssignmentQuestion, AssignmentSubmission, EssayResponse } from '@/types'

// Mahardhika logo mark for the QR centre (admin can override via org_logo)
const DEFAULT_LOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#0891b2"/><text x="50" y="62" font-family="Arial,sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">A</text></svg>'
)

function getOrgLogo(): string {
  try {
    return localStorage.getItem('org_logo') || DEFAULT_LOGO
  } catch {
    return DEFAULT_LOGO
  }
}

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
  /** When true (student printing their own sheet), unreleased feedback stays hidden. */
  isStudent?: boolean
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

const ESSAY_STATUS: Record<string, string> = {
  draft: 'examPrint.status.draft',
  submitted: 'examPrint.status.submitted',
  locked: 'examPrint.status.locked',
  grading: 'examPrint.status.grading',
  returned: 'examPrint.status.returned',
  resubmitted: 'examPrint.status.resubmitted',
  finalised: 'examPrint.status.finalised',
}

export function PrintSheetModal({ assignment, submission, isOpen, onClose, isStudent = false }: PrintSheetModalProps) {
  const [essayResponses, setEssayResponses] = useState<Record<string, EssayResponse | undefined>>({})
  const [loadingEssays, setLoadingEssays] = useState(false)
  const [, setLangVersion] = useState(0)

  const essayQs = assignment.essay_question_titles || []
  const essayIds = assignment.essay_questions || []

  // Re-render with fresh translations if the language changes while open.
  useEffect(() => {
    if (!isOpen) return
    const handler = () => setLangVersion((v) => v + 1)
    window.addEventListener('languageChanged', handler)
    return () => window.removeEventListener('languageChanged', handler)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || essayIds.length === 0) return
    let cancelled = false
    setLoadingEssays(true)
    ;(async () => {
      const map: Record<string, EssayResponse | undefined> = {}
      for (const qid of essayIds) {
        try {
          const data = await apiClient.get<{ results: EssayResponse[] }>(
            `/essays/responses/?question=${qid}&student=${submission.student}`
          )
          map[qid] = (data.results || [])[0]
        } catch {
          map[qid] = undefined
        }
      }
      if (!cancelled) setEssayResponses(map)
      setLoadingEssays(false)
    })()
    return () => { cancelled = true }
  }, [isOpen, submission.student, essayIds])

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
          <h3 className="font-semibold text-gray-900">{t('examPrint.title')}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-900 text-white text-sm font-medium hover:bg-gray-700"
            >
              <Printer size={14} /> {t('examPrint.print')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label={t('examPrint.close')}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* The printable sheet */}
        <div className="p-6 sm:p-8">
          <header className="border-b-2 border-gray-900 pb-3 mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{assignment.title}</h1>
              <p className="text-sm text-gray-700 mt-1">
                {t('examPrint.answerSheet')}{submission.student_email || 'Student'}
              </p>
              <p className="text-sm text-gray-700">
                {t('examPrint.score')}{score ?? '—'}
                {mcqScore !== undefined && mcqTotal !== undefined && ` (${mcqScore}/${mcqTotal})`}
                {submission.submitted_at && `${t('examPrint.submittedOn')}${new Date(submission.submitted_at).toLocaleDateString()}`}
              </p>
            </div>
            {submission.verify_hash && (
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="bg-white p-1.5 border border-gray-300 rounded">
                  <QRCodeSVG
                    value={`${window.location.origin}/verify-submission/${submission.verify_hash}`}
                    size={88}
                    level="H"
                    imageSettings={{
                      src: getOrgLogo(),
                      height: 20,
                      width: 20,
                      excavate: true,
                    }}
                  />
                </div>
                <span className="text-[9px] text-gray-600 text-center">{t('examPrint.scanToVerify')}</span>
              </div>
            )}
          </header>

          {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNo) => {
            const onPage = questions.filter((q) => (q.page || 1) === pageNo)
            if (onPage.length === 0) return null
            return (
              <section key={pageNo} className="mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
                  {t('examPrint.page')}{pageNo}
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
                              {correct ? '✓' : '✗'} {r?.points ?? q.points} {t('examPrint.pt')}
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

          {essayIds.length > 0 && (
            <section className="mt-5 pt-4 border-t border-gray-300">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
                {t('examPrint.essayPart')}
              </h2>
              {loadingEssays ? (
                <p className="text-sm text-gray-600">{t('examPrint.loadingEssays')}</p>
              ) : essayQs.length === 0 ? (
                <p className="text-sm text-gray-600">{t('examPrint.noEssays')}</p>
              ) : (
                <div className="space-y-4">
                  {essayQs.map((q) => {
                    const r = essayResponses[q.id]
                    const showFeedback = r && (!isStudent || r.feedback_released)
                    return (
                      <div key={q.id} className="border border-gray-300 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-sm font-semibold text-gray-900">{q.title}</h3>
                          <span className="text-xs text-gray-600 whitespace-nowrap">
                            {q.marks} {t('examPrint.pt')}
                          </span>
                        </div>
                        {!r ? (
                          <p className="text-sm text-gray-600">{t('examPrint.noResponse')}</p>
                        ) : (
                          <>
                            <p className="text-xs text-gray-600 mb-2">
                              {t('examPrint.status')}{t(ESSAY_STATUS[r.status] || r.status) || r.status}
                              {r.submitted_at && `${t('examPrint.submittedOn')}${new Date(r.submitted_at).toLocaleDateString()}`}
                              {r.is_late && t('examPrint.late')}
                            </p>
                            {r.typed_answer ? (
                              <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded p-2 mb-2">
                                {r.typed_answer}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600 italic mb-2">
                                {t('examPrint.canvasOnly')}
                              </p>
                            )}
                            {showFeedback && (
                              <div className="text-sm">
                                {r.total_score !== null && (
                                  <p className="text-gray-900 font-semibold">
                                    {t('examPrint.score')}{r.total_score}/{q.marks}
                                    {r.percentage !== null && ` (${r.percentage}% · ${r.letter_grade})`}
                                  </p>
                                )}
                                {r.overall_feedback && (
                                  <p className="text-gray-700 mt-1">
                                    <span className="font-semibold">{t('examPrint.feedback')}</span>{' '}
                                    {r.overall_feedback}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          <footer className="mt-4 pt-3 border-t border-gray-300 text-xs text-gray-600">
            {t('examPrint.legend')}
          </footer>
        </div>
      </div>
    </div>
  )
}