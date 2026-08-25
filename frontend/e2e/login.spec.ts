import { test, expect } from '@playwright/test'

test.describe('Login Flow', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/')
    // Should redirect to login or show login page
    await expect(page).toHaveURL(/login/)
  })

  test('login form has email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('login form has submit button', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    // Fill with invalid credentials
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]')
    const passwordInput = page.locator('input[type="password"]')

    if (await emailInput.isVisible() && await passwordInput.isVisible()) {
      await emailInput.fill('wrong@email.com')
      await passwordInput.fill('wrongpassword')
      await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').click()
      // Should show some error indication
      await expect(page.locator('text=/invalid|error|incorrect|wrong/i')).toBeVisible({ timeout: 5000 })
    }
  })

  test('forgot password link is present', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('a:has-text("Forgot"), a:has-text("forgot"), a[href*="forgot"]')).toBeVisible()
  })
})

test.describe('Protected Routes', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
  })

  test('redirects to login for /courses when not authenticated', async ({ page }) => {
    await page.goto('/courses')
    await expect(page).toHaveURL(/login/)
  })
})
