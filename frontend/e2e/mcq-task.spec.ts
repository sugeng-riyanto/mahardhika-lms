/**
 * AKADEMI Digital Campus — MCQ task end-to-end coverage
 *
 * Instructor creates a Multiple Choice Quiz task using the question
 * builder (2 questions, correct answers marked), then a student opens
 * the published task, answers both questions, submits, and the quiz is
 * auto-graded (score 100, per-question ✓ results).
 *
 * Requires the seeded demo data: instructor teaches "Mathematics 7A"
 * and the seeded student is enrolled in it. The test deletes its own
 * assignment at the end so the dev database stays at the seed baseline.
 */

import { test, expect, type Page } from '@playwright/test'

// Login via mock auth: set localStorage then reload (same helper as flows.spec.ts)
async function loginAs(page: Page, email: string) {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate((e) => {
    localStorage.setItem('akademi_mock_user', e)
    localStorage.setItem('akademi_access_token', `mock-token-${e}`)
  }, email)
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () => window.location.pathname.includes('/dashboard'),
    { timeout: 10000 },
  ).catch(() => {})
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(500)
}

// Unique title so parallel/rerun executions never collide
const taskTitle = () => `E2E MCQ Task ${Date.now()}`

async function createMcqTask(page: Page, title: string) {
  await page.goto('/assignments')
  await expect(page.locator('h1')).toContainText('Assignments')

  await page.getByRole('button', { name: 'Create Assignment' }).click()
  // Task type picker
  await page.getByRole('button', { name: /Multiple Choice Quiz/ }).click()

  // Basic fields (labels aren't for-associated, so target the inputs directly)
  await page.getByPlaceholder('Assignment title').fill(title)
  await page.locator('select').nth(0).selectOption({ label: 'Mathematics 7A' }) // course
  await page.locator('select').nth(1).selectOption({ label: 'Published' })     // status — students only see published tasks

  // Question 1 — Multiple Choice (default)
  const q1 = page.locator('div.space-y-4 > div').nth(0)
  await q1.locator('input.input-field').first().fill('What is 2 + 2?')
  await q1.locator('input.input-field').nth(2).fill('Three')   // option A
  await q1.locator('input.input-field').nth(3).fill('Four')    // option B
  await q1.locator('input.input-field').nth(4).fill('Five')    // option C
  await q1.locator('button[title="Mark correct"]').nth(1).click() // B is correct

  // Question 2 — True / False
  await page.getByRole('button', { name: 'Add Question' }).click()
  const q2 = page.locator('div.space-y-4 > div').nth(1)
  await q2.locator('input.input-field').first().fill('The sky is blue during the day.')
  await q2.locator('select').first().selectOption({ label: 'True / False' })
  await q2.locator('input.input-field').nth(2).fill('True')    // option A
  await q2.locator('input.input-field').nth(3).fill('False')   // option B
  await q2.locator('button[title="Mark correct"]').first().click() // A is correct

  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // Card appears with the MCQ Quiz badge
  const card = page.locator('.card', { hasText: title })
  await expect(card).toBeVisible({ timeout: 15000 })
  await expect(card).toContainText('MCQ Quiz')

  // Read the assignment id from the detail link so we can clean up later
  const href = await card.locator('a', { hasText: 'View details' }).getAttribute('href')
  expect(href).toMatch(/\/assignments\/[0-9a-f-]+$/)
  return href!.split('/').pop()!
}

async function answerAndVerify(page: Page, assignmentId: string) {
  await page.goto(`/assignments/${assignmentId}`)
  await expect(page.getByText('Answer the questions')).toBeVisible({ timeout: 15000 })

  const radios = page.locator('input[type="radio"]')
  await expect(radios).toHaveCount(5) // Q1: 3 options + Q2: 2 options
  await radios.nth(1).check() // Q1 → B (Four)
  await radios.nth(3).check() // Q2 → A (True)

  await page.getByRole('button', { name: 'Submit Quiz' }).click()

  // Auto-grade result: heading + full score + per-question correctness
  await expect(page.getByText('Quiz graded automatically')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/Score: 100/)).toBeVisible()
  await expect(page.getByText('✓ Correct').first()).toBeVisible()
}

test.describe('MCQ task — assign, answer, auto-grade', () => {
  test('instructor builds a quiz, student answers, score is computed automatically', async ({ page }) => {
    const title = taskTitle()
    let assignmentId = ''

    // Instructor: create the quiz with the question builder
    await loginAs(page, 'instructor@mahardhika.id')
    assignmentId = await createMcqTask(page, title)

    try {
      // Student: open the published task and answer both questions
      await loginAs(page, 'student@mahardhika.id')
      await answerAndVerify(page, assignmentId)

      // Instructor: the submission shows the auto-grade breakdown
      await loginAs(page, 'instructor@mahardhika.id')
      await page.goto(`/assignments/${assignmentId}`)
      await expect(page.getByText('Submissions (1)')).toBeVisible({ timeout: 15000 })
      await expect(page.getByText(/MCQ score: 2 \/ 2/)).toBeVisible({ timeout: 15000 }) // both questions correct
      await expect(page.getByText('Score: 100.00')).toBeVisible()
    } finally {
      // Clean up: delete the task we created so the seed baseline is preserved
      const del = await page.request.delete(
        `http://localhost:8000/api/v1/assignments/${assignmentId}/`,
        { headers: { Authorization: 'Bearer mock-token-instructor@mahardhika.id' } },
      )
      expect(del.ok()).toBeTruthy()
    }
  })
})