import { describe, it, expect } from 'vitest'
import { parseQuestionsCsv, buildQuestionCsvTemplate } from '@/utils/assignmentCsv'

describe('parseQuestionsCsv', () => {
  it('parses multiple-choice rows with flexible headers', () => {
    const csv = [
      'type,prompt,option_a,option_b,option_c,correct,points',
      'multiple_choice,What is 2 + 2?,Three,Four,Five,b,5',
      'mcq,Capital of Indonesia?,Jakarta,Bandung,Surabaya,a,2',
    ].join('\n')
    const { questions, errors } = parseQuestionsCsv(csv)
    expect(errors).toEqual([])
    expect(questions).toHaveLength(2)
    expect(questions[0]).toMatchObject({
      question_type: 'multiple_choice',
      prompt: 'What is 2 + 2?',
      optionTexts: ['Three', 'Four', 'Five'],
      correct: ['b'],
      points: 5,
    })
    expect(questions[1].correct).toEqual(['a'])
  })

  it('maps true_false and multiple_select types', () => {
    const csv = [
      'type,prompt,option_a,option_b,option_c,option_d,correct,points',
      'true_false,The sky is blue during the day.,True,False,,,a,1',
      'multiple_select,Which are prime numbers?,2,4,7,9,"a,c",4',
    ].join('\n')
    const { questions, errors } = parseQuestionsCsv(csv)
    expect(errors).toEqual([])
    expect(questions[0].question_type).toBe('true_false')
    expect(questions[0].optionTexts).toEqual(['True', 'False'])
    expect(questions[1].question_type).toBe('multiple_select')
    expect(questions[1].correct).toEqual(['a', 'c'])
  })

  it('accepts option1/option2 aliases and correct separated by spaces', () => {
    const csv = [
      'type,prompt,option1,option2,option3,option4,answer,marks',
      'multiple_select,Pick the odd one,1,2,3,4,b d',
    ].join('\n')
    const { questions, errors } = parseQuestionsCsv(csv)
    expect(errors).toEqual([])
    expect(questions[0].optionTexts).toEqual(['1', '2', '3', '4'])
    expect(questions[0].correct).toEqual(['b', 'd'])
  })

  it('handles quoted prompts with commas', () => {
    const csv = [
      'prompt,option_a,option_b,correct',
      '"A question, with a comma?",Yes,No,a',
    ].join('\n')
    const { questions } = parseQuestionsCsv(csv)
    expect(questions[0].prompt).toBe('A question, with a comma?')
  })

  it('defaults points to 1 and carries explanation', () => {
    const csv = [
      'prompt,option_a,option_b,correct,explanation',
      'Q?,X,Y,a,Because of physics',
    ].join('\n')
    const { questions } = parseQuestionsCsv(csv)
    expect(questions[0].points).toBe(1)
    expect(questions[0].explanation).toBe('Because of physics')
  })

  it('reports per-row validation errors and skips bad rows', () => {
    const csv = [
      'prompt,option_a,option_b,correct',
      'Good question,Yes,No,a',
      'Missing options,Only one, ,a',
      'Missing correct,Yes,No,',
      'MCQ with two corrects,Yes,No,"a,b"',
    ].join('\n')
    const { questions, errors } = parseQuestionsCsv(csv)
    expect(questions).toHaveLength(1)
    expect(questions[0].prompt).toBe('Good question')
    expect(errors).toHaveLength(3)
    expect(errors[0]).toContain('Row 3')
    expect(errors[1]).toContain('Row 4')
    expect(errors[2]).toContain('Row 5')
  })

  it('rejects empty files and files without a prompt column', () => {
    expect(parseQuestionsCsv('').errors[0]).toMatch(/header row/)
    expect(parseQuestionsCsv('type,option_a,option_b,correct\nmcq,x,y,a').errors[0]).toMatch(/prompt/)
  })
})

describe('buildQuestionCsvTemplate', () => {
  it('contains headers and an example row', () => {
    const tpl = buildQuestionCsvTemplate()
    const lines = tpl.split('\n')
    expect(lines[0].toLowerCase()).toContain('prompt')
    expect(lines[0].toLowerCase()).toContain('option_a')
    expect(lines[0].toLowerCase()).toContain('correct')
    expect(lines[1]).toContain('multiple_choice')
    expect(lines[1]).toContain('What is 2 + 2?')
    // Template round-trips through the parser
    const { questions, errors } = parseQuestionsCsv(tpl)
    expect(errors).toEqual([])
    expect(questions[0]).toMatchObject({ correct: ['b'], points: 5 })
  })
})