import { test, expect } from '@playwright/test'

const API = 'http://localhost:8000'

test('Debug: check auth state after login', async ({ page }) => {
  // Navigate to login
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Check if we see the login form
  const emailInput = page.locator('input[type="email"]')
  await expect(emailInput).toBeVisible()
  
  // Fill and submit
  await emailInput.fill('owner@mahardhika.id')
  await page.fill('input[type="password"]', 'dev-password-2026')
  await page.click('button[type="submit"]')
  
  // Wait for navigation
  await page.waitForTimeout(3000)
  
  // Debug: check current URL
  const url = page.url()
  console.log('Current URL after login:', url)
  
  // Debug: check localStorage
  const ls = await page.evaluate(() => {
    const result: Record<string, string | null> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!
      result[key] = localStorage.getItem(key)
    }
    return result
  })
  console.log('localStorage:', JSON.stringify(ls, null, 2))
  
  // Debug: check the React auth state
  const authState = await page.evaluate(() => {
    // Try to access React internal state
    const el = document.querySelector('#root')
    if (!el) return 'No root element'
    return document.title + ' | ' + document.querySelector('main')?.textContent?.substring(0, 100)
  })
  console.log('Auth state:', authState)
  
  // Debug: check sidebar
  const sidebarHTML = await page.evaluate(() => {
    const aside = document.querySelector('aside')
    return aside ? aside.innerHTML.substring(0, 500) : 'No aside found'
  })
  console.log('Sidebar HTML:', sidebarHTML)
  
  // Debug: check nav items
  const navItems = await page.locator('aside a, nav a').allTextContents()
  console.log('Nav items:', navItems)
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-login.png', fullPage: true })
})
