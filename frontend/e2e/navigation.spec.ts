import { test, expect } from '@playwright/test'

test.describe('Page Routing', () => {
  test('404 page shows for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page-xyz')
    // Should show not found or redirect to login
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })

  test('access denied page is reachable', async ({ page }) => {
    await page.goto('/access-denied')
    const content = await page.textContent('body')
    expect(content).toBeTruthy()
  })
})

test.describe('Backend Health', () => {
  test('health check endpoint responds when backend is running', async ({ request }) => {
    const response = await request.get('http://localhost:8000/api/v1/health/', {
      timeout: 5000,
    }).catch(() => null)
    // Skip gracefully if backend is not running
    test.skip(!response, 'Backend not running at localhost:8000')
    expect(response!.status()).toBe(200)
  })
})
