/**
 * AKADEMI Digital Campus — Take Roll end-to-end coverage
 *
 * Opens the roll-call modal from the Attendance page (Mon Sep 7 schedule),
 * changes a student's status via the roster, saves it, and verifies the
 * change persisted through the API (panel shows it, and re-opening the
 * modal shows the saved status from the roster endpoint).
 *
 * Requires the seeded demo timetable: schedules on 2026-09-07 with the
 * seeded student enrolled in "Algebraic Expressions" (Mathematics 7A).
 * The test reverts its own change so the dev database stays at the seed
 * baseline.
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

async function openRollModalForAlgebraic(page: Page) {
  // Select the Mon Sep 7 schedule row so the records panel shows that day
  const row = page.locator('div.cursor-pointer', { hasText: 'Algebraic Expressions' }).first()
  await row.click()

  const takeRoll = page.getByRole('button', { name: 'Take Roll' })
  await expect(takeRoll).toBeVisible()
  await takeRoll.click()

  // Modal with a 4-lesson picker: pick the Algebraic Expressions lesson
  const heading = page.getByRole('heading', { name: 'Take Roll' })
  await expect(heading).toBeVisible()
  await selectAlgebraicLesson(page)

  // Roster loaded with the seeded student
  const status = page.getByLabel('Attendance status for Student')
  await expect(status).toBeVisible()
  await expect(status).toHaveValue('present')
}

// selectOption requires an exact string label — read the option's real text first
async function selectAlgebraicLesson(page: Page) {
  const option = page.locator('#roll-schedule option', { hasText: 'Algebraic Expressions' }).first()
  const label = (await option.textContent())?.trim() ?? ''
  expect(label).not.toBe('')
  await page.locator('#roll-schedule').selectOption({ label })
}

// The right-hand records panel list rows (direct children of the scroller)
function recordsPanel(page: Page) {
  return page.locator('.max-h-\\[500px\\]')
}

async function revertRoll(page: Page) {
  // Make sure the modal is open on Algebraic Expressions (idempotent)
  const saveBtn = page.getByRole('button', { name: 'Save Attendance' })
  if (!(await saveBtn.isVisible().catch(() => false))) {
    await page.locator('div.cursor-pointer', { hasText: 'Algebraic Expressions' }).first().click()
    await page.getByRole('button', { name: 'Take Roll' }).click()
    await selectAlgebraicLesson(page)
  }
  const status = page.getByLabel('Attendance status for Student')
  await expect(status).toBeVisible()
  await status.selectOption('present')
  await page.getByLabel('Note for Student').fill('')
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()
  await expect(page.getByRole('button', { name: 'Save Attendance' })).toHaveCount(0)
}

test.describe('Take Roll — end-to-end status change', () => {
  test('marks a student late, saves, and reverts the change', async ({ page }) => {
    await loginAs(page, 'instructor@mahardhika.id')
    await page.goto('/attendance')
    await expect(page.locator('h1')).toContainText('Attendance')
    // Let schedules/records load
    await expect(page.locator('div.cursor-pointer', { hasText: 'Algebraic Expressions' }).first()).toBeVisible()

    try {
      await openRollModalForAlgebraic(page)

      // Change status to Late with a note, then save
      await page.getByLabel('Attendance status for Student').selectOption('late')
      await page.getByLabel('Note for Student').fill('e2e roll test')
      await page.getByRole('button', { name: 'Save Attendance' }).click()

      // Modal closed after a successful save
      await expect(page.getByRole('button', { name: 'Save Attendance' })).toHaveCount(0)

      // Records panel live-updated for the day's list
      const panel = recordsPanel(page)
      await expect(panel.locator('> div').filter({ hasText: 'Algebraic Expressions' })).toHaveCount(1)
      await expect(panel).toContainText('Late')
      await expect(panel).toContainText('e2e roll test')

      // Re-opening the modal reads the persisted status from the roster API
      await page.getByRole('button', { name: 'Take Roll' }).click()
      await selectAlgebraicLesson(page)
      await expect(page.getByLabel('Attendance status for Student')).toHaveValue('late')
      await expect(page.getByLabel('Note for Student')).toHaveValue('e2e roll test')
      // Close without changing anything further
      await page.getByRole('button', { name: 'Cancel' }).click()
    } finally {
      // Restore the seeded baseline so other tests/demos are unaffected
      await revertRoll(page).catch(() => {})
      const panel = recordsPanel(page)
      await expect(panel.locator('> div').filter({ hasText: 'Algebraic Expressions' })).toHaveCount(1)
      await expect(panel).toContainText('Present')
      await expect(panel).not.toContainText('e2e roll test')
    }
  })
})
