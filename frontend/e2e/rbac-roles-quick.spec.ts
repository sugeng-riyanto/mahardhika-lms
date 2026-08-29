import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'

const roles = [
  { email: 'owner@mahardhika.id', name: 'Owner', minNav: 8 },
  { email: 'admin@mahardhika.id', name: 'Admin', minNav: 8 },
  { email: 'instructor@mahardhika.id', name: 'Instructor', minNav: 5 },
  { email: 'student@mahardhika.id', name: 'Student', minNav: 5 },
  { email: 'parent@mahardhika.id', name: 'Parent', minNav: 3 },
  { email: 'treasurer@mahardhika.id', name: 'Treasurer', minNav: 2 },
  { email: 'sponsor@mahardhika.id', name: 'Sponsor', minNav: 2 },
  { email: 'thirdparty@mahardhika.id', name: 'ThirdParty', minNav: 1 },
]

for (const role of roles) {
  test(`RBAC: ${role.name} sees correct sidebar and dashboard content`, async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"]', role.email)
    await page.fill('input[type="password"]', 'dev-password-2026')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard/**', { timeout: 8000 })
    await page.waitForTimeout(1500)

    // Verify sidebar has nav items
    const sidebarLinks = page.locator('aside a, nav a')
    const count = await sidebarLinks.count()
    expect(count, `${role.name} should have at least ${role.minNav} nav items`).toBeGreaterThanOrEqual(role.minNav)

    // Verify dashboard content is visible
    const main = page.locator('main')
    await expect(main).toBeVisible()
    const text = await main.textContent()
    expect(text?.length, `${role.name} main content should be non-empty`).toBeGreaterThan(10)
  })
}

test('RBAC: Unauthenticated user redirects to login', async ({ page }) => {
  await page.goto('/dashboard/student')
  await page.waitForTimeout(1000)
  expect(page.url()).toContain('/login')
})

test('RBAC: API health check responds', async ({ request }) => {
  const resp = await request.get(`${API}/api/v1/health/`)
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body.status).toBe('healthy')
})

test('RBAC: API root shows all endpoints', async ({ request }) => {
  const resp = await request.get(`${API}/api/v1/`)
  expect(resp.ok()).toBeTruthy()
  const body = await resp.json()
  expect(body.endpoints).toBeDefined()
  expect(Object.keys(body.endpoints).length).toBeGreaterThanOrEqual(25)
})
