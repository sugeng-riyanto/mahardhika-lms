/**
 * CSV import utilities for MCQ assignment questions.
 *
 * Spreadsheet columns (header names are flexible — case-insensitive, with
 * aliases):
 *   type | question_type  — multiple_choice | true_false | multiple_select
 *   prompt | question    — the question text (required)
 *   option_a .. option_f — the answer options (also option1 .. option6 or a..f)
 *   correct | correct_answer | answer — the correct option letter(s), e.g. "b" or "a,c"
 *   points | marks       — points for the question (default 1)
 *   explanation          — optional explanation shown after submission
 */

export interface CsvQuestion {
  question_type: 'multiple_choice' | 'true_false' | 'multiple_select'
  prompt: string
  optionTexts: string[]
  correct: string[]
  points: number
  explanation: string
}

export interface ParseResult {
  questions: CsvQuestion[]
  errors: string[]
}

const OPTION_SLOT_ALIASES: string[][] = [
  ['option_a', 'a', 'option1', 'opsi_a'],
  ['option_b', 'b', 'option2', 'opsi_b'],
  ['option_c', 'c', 'option3', 'opsi_c'],
  ['option_d', 'd', 'option4', 'opsi_d'],
  ['option_e', 'e', 'option5'],
  ['option_f', 'f', 'option6'],
]

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { current += '"'; i++ } else { inQuotes = false }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(current); current = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      if (current.trim() !== '' || row.length > 0) { row.push(current); rows.push(row) }
      row = []; current = ''
    } else {
      current += ch
    }
  }
  if (current.trim() !== '' || row.length > 0) { row.push(current); rows.push(row) }
  return rows
}

function mapQuestionType(raw: string): 'multiple_choice' | 'true_false' | 'multiple_select' | null {
  const v = raw.trim().toLowerCase()
  if (['multiple_choice', 'multiple choice', 'mcq', 'mc'].includes(v)) return 'multiple_choice'
  if (['true_false', 'true/false', 'true / false', 'tf'].includes(v)) return 'true_false'
  if (['multiple_select', 'multiple select', 'ms'].includes(v)) return 'multiple_select'
  return null
}

function parseCorrect(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[,;|\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function parseQuestionsCsv(text: string): ParseResult {
  const rows = parseCsvLines(text)
  const result: ParseResult = { questions: [], errors: [] }
  if (rows.length < 2) {
    result.errors.push('CSV must contain a header row and at least one question row.')
    return result
  }

  const headers = rows[0].map(normalizeHeader)
  const col = (header: string): number => headers.indexOf(header)

  const promptIdx = [col('prompt'), col('question')].find((i) => i >= 0) ?? -1
  const typeIdx = [col('type'), col('question_type')].find((i) => i >= 0) ?? -1
  const correctIdx = [col('correct'), col('correct_answer'), col('answer')].find((i) => i >= 0) ?? -1
  const pointsIdx = [col('points'), col('marks'), col('score')].find((i) => i >= 0) ?? -1
  const explanationIdx = col('explanation')

  if (promptIdx < 0) {
    result.errors.push('CSV is missing the "prompt" column.')
    return result
  }

  rows.slice(1).forEach((cells, rowIndex) => {
    const rowNum = rowIndex + 2 // 1-based, skipping the header
    const get = (idx: number): string => (idx >= 0 ? (cells[idx] || '').trim() : '')
    const errs: string[] = []

    const prompt = get(promptIdx)
    if (!prompt) errs.push('missing prompt')

    let question_type: CsvQuestion['question_type'] = 'multiple_choice'
    if (typeIdx >= 0 && get(typeIdx)) {
      const mapped = mapQuestionType(get(typeIdx))
      if (mapped) question_type = mapped
      else errs.push(`unknown type "${get(typeIdx)}"`)
    }

    const optionTexts: string[] = []
    for (const aliases of OPTION_SLOT_ALIASES) {
      const idx = aliases.map((a) => col(a)).find((i) => i >= 0)
      const opt = idx !== undefined && idx >= 0 ? get(idx) : ''
      if (opt) optionTexts.push(opt)
    }
    if (optionTexts.length < 2) errs.push('needs at least 2 options')

    let correct: string[] = []
    if (correctIdx >= 0 && get(correctIdx)) {
      correct = parseCorrect(get(correctIdx))
      const invalid = correct.filter((c) => c < 'a' || c > String.fromCharCode(96 + optionTexts.length) || c.length !== 1)
      if (invalid.length) errs.push(`invalid correct "${get(correctIdx)}"`)
      if (question_type !== 'multiple_select' && correct.length > 1) errs.push('MCQ/True-False allows exactly one correct answer')
    } else {
      errs.push('missing correct answer')
    }

    const points = pointsIdx >= 0 && get(pointsIdx) ? Number(get(pointsIdx)) : 1

    if (errs.length) {
      result.errors.push(`Row ${rowNum}: ${errs.join('; ')}`)
      return
    }

    result.questions.push({
      question_type,
      prompt,
      optionTexts,
      correct,
      points: Number.isFinite(points) && points > 0 ? points : 1,
      explanation: explanationIdx >= 0 ? get(explanationIdx) : '',
    })
  })

  if (result.questions.length === 0 && result.errors.length > 0) {
    result.errors.unshift('No valid question rows found.')
  }
  return result
}

const TEMPLATE_HEADERS = [
  'type', 'prompt', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'points', 'explanation',
]

/** Build the downloadable template CSV (header + one example row). */
export function buildQuestionCsvTemplate(): string {
  const example = [
    'multiple_choice',
    'What is 2 + 2?',
    'Three', 'Four', 'Five', '',
    'b',
    '5',
    'Basic addition',
  ]
  const escape = (v: string): string => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v)
  return [
    TEMPLATE_HEADERS.join(','),
    example.map(escape).join(','),
  ].join('\n')
}