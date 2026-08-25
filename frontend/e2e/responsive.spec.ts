import { test, expect } from '@playwright/test'

test.describe('Responsive Design', () => {
  test('login page is responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')
    // Login form should be visible on mobile
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login page is responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login page is responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/login')
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('no horizontal overflow on login page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 1)
  })
})
