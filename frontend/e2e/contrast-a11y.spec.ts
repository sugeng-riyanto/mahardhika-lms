import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * WCAG AA color-contrast regression guard.
 *
 * The app's contrast was audited and fixed per-page (essay workspace,
 * gradebook, sidebar/header chrome) with a composited-alpha checker plus axe.
 * This spec enforces that those pages never regress: axe's color-contrast rule
 * runs on every audited page in BOTH themes, and any violation NOT listed in
 * the baseline (frontend/a11y/contrast-baseline.json) fails the build.
 *
 * When a violation is genuinely fixed, remove its signature from the baseline.
 * When a NEW page is added to `PAGES`, audit it, fix what you can, then record
 * remaining signatures by running:
 *   npx playwright test e2e/contrast-a11y.spec.ts --project=chromium --update-baseline
 * and committing the refreshed baseline alongside the fixes.
 */

const BASELINE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'a11y', 'contrast-baseline.json')

type Baseline = Record<string, { rule: string; target: string }[]>

function loadBaseline(): Baseline {
  try {
    return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baseline
  } catch {
    return {}
  }
}

// key -> [ { rule, target } ] of currently-known violations.
// Maintained via UPDATE_BASELINE=1; commit changes deliberately.
const UPDATE_BASELINE = process.env.UPDATE_BASELINE === '1'
let KNOWN: Baseline = loadBaseline()
if (UPDATE_BASELINE) KNOWN = {}

/** Boot the app with mock auth + the given theme before any JS runs. */
async function boot(page: Page, email: string, theme: 'dark' | 'light') {
  await page.addInitScript(
    ({ email, theme }) => {
      localStorage.setItem('akademi_access_token', `mock-token-${email}`)
      localStorage.setItem('akademi_mock_user', email)
      localStorage.setItem('akademi-theme', theme)
      localStorage.setItem('akademi_lang', 'en')
    },
    { email, theme }
  )
}

const sig = (rule: string, target: string) => `${rule}::${target}`

async function audit(page: Page): Promise<{ rule: string; target: string }[]> {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze()
  const out: { rule: string; target: string }[] = []
  for (const v of results.violations) {
    for (const n of v.nodes) {
      out.push({ rule: v.id, target: n.target.join(' ') })
    }
  }
  return out
}

/** Pages to guard. Each needs real seeded data to be a meaningful audit. */
const PAGES: { name: string; url: string; email: string; needsEssayId?: boolean }[] = [
  { name: 'gradebook', url: '/gradebook', email: 'instructor@mahardhika.id' },
  { name: 'essay-workspace', url: '/essays/', email: 'student@mahardhika.id', needsEssayId: true },
]

async function essayWorkspaceUrl(page: Page): Promise<string> {
  // Discover a seeded essay question the student can actually open.
  const res = await page.request.get('/api/v1/essays/questions/', {
    headers: { Authorization: 'Bearer mock-token-student@mahardhika.id' },
  })
  const data = (await res.json()) as { results?: { id: string }[] }
  const q = (data.results || [])[0]
  if (!q) throw new Error('No seeded essay question found — run seed_data + seed_comprehensive first')
  return `/essays/${q.id}`
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`color-contrast — ${theme} theme`, () => {
    test.afterAll(() => {
      if (!UPDATE_BASELINE) return
      const dir = path.dirname(BASELINE_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      // Keep the file strict JSON: loadBaseline() uses JSON.parse.
      const knownJson = JSON.stringify(KNOWN, null, 2) + '\n'
      fs.writeFileSync(BASELINE_PATH, knownJson, 'utf8')
      console.log(`Wrote ${BASELINE_PATH}`)
    })
    for (const pageCfg of PAGES) {
      test(`${pageCfg.name} has no NEW WCAG AA contrast violations`, async ({ page }) => {
        await boot(page, pageCfg.email, theme)
        const url = pageCfg.needsEssayId ? await essayWorkspaceUrl(page) : pageCfg.url
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForTimeout(1200)

        const found = await audit(page)
        const key = `${pageCfg.name}:${theme}`
        const known = new Set((KNOWN[key] || []).map((v) => sig(v.rule, v.target)))
        const knownList = KNOWN[key] || []

        // Update mode: record everything we found and continue.
        if (UPDATE_BASELINE) {
          KNOWN[key] = found.map((f) => ({ rule: f.rule, target: f.target }))
          console.log(`[baseline] ${key}: ${found.length} violations recorded`)
          return
        }

        const newOnes = found.filter((f) => !known.has(sig(f.rule, f.target)))
        const fixed = knownList.filter((k) => !found.some((f) => f.rule === k.rule && f.target === k.target))

        for (const v of found) {
          console.log(`  [${v.rule}] ${v.target}`)
        }
        if (fixed.length > 0) {
          console.log(`  (${fixed.length} baseline entries no longer occur — remove them from ${path.basename(BASELINE_PATH)})`)
        }
        expect(
          newOnes,
          `${pageCfg.name} (${theme}) has ${newOnes.length} NEW contrast violations not in the baseline. ` +
            `Fix them, or if intentional record them with UPDATE_BASELINE=1.`
        ).toEqual([])
      })
    }
  })
}

