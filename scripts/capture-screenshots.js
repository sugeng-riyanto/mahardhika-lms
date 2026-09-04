/**
 * AKADEMI Digital Campus — Weekly Screenshot Capture
 *
 * Captures screenshots of all key pages for the weekly progress report.
 * Requires the frontend dev server running on http://localhost:5173
 * and the backend on http://localhost:8000.
 *
 * Usage:
 *   node scripts/capture-screenshots.js                    # default: reports/weekly/YYYY-MM-DD/
 *   node scripts/capture-screenshots.js --output reports/weekly/custom/
 *   node scripts/capture-screenshots.js --base-url http://localhost:5174
 */
// Resolve playwright from frontend/node_modules
const path = require('path');
const frontendModules = path.resolve(__dirname, '..', 'frontend', 'node_modules');
const { chromium } = require(path.join(frontendModules, 'playwright'));
const fs = require('fs');

// Parse args
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const baseUrlIdx = args.indexOf('--base-url');
const BASE_URL = baseUrlIdx >= 0 ? args[baseUrlIdx + 1] : 'http://localhost:5173';
const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = outputIdx >= 0
  ? path.resolve(args[outputIdx + 1])
  : path.resolve(__dirname, '..', 'reports', 'weekly', today);

// Interactive prep steps reused by the roll-call entries below.
// The capture loop screenshots the page AFTER the step function runs.

async function openCalendarRollState(page) {
  // Open the Attendance panel so Take Roll is reachable
  const toggle = page.locator('button', { hasText: 'Attendance' }).first();
  await toggle.click();
  await page.waitForTimeout(400);
  // Select Monday Sep 7 in the current month grid (day cell '7')
  await page.locator('main').getByText('7', { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Take Roll' }).waitFor({ state: 'visible', timeout: 5000 });
}

async function openCalendarRollModal(page) {
  await openCalendarRollState(page);
  await page.getByRole('button', { name: 'Take Roll' }).click();
  await page.getByRole('button', { name: 'Save Attendance' }).waitFor({ state: 'visible', timeout: 5000 });
}

async function openAttendanceRollState(page) {
  // Select the first schedule row (Algebraic Expressions, Mon Sep 7)
  await page.locator('div.cursor-pointer', { hasText: 'Algebraic Expressions' }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Take Roll' }).waitFor({ state: 'visible', timeout: 5000 });
}

async function openAttendanceRollModal(page) {
  await openAttendanceRollState(page);
  await page.getByRole('button', { name: 'Take Roll' }).click();
  await page.getByRole('button', { name: 'Save Attendance' }).waitFor({ state: 'visible', timeout: 5000 });
}

// Click Export and show the downloaded CSV's contents in the page so it can be
// screenshotted. The Export button starts two downloads (schedules then, 500ms
// later, records), but Chromium's download pipeline is flaky under headless
// Playwright — a second in-flight download is sometimes dropped or misreported.
// Instead of matching browser download events, intercept the app's own anchor
// clicks and read the CSV text from the Blob it created. Deterministic.
async function showExportedCsv(page, which) {
  const csv = await page.evaluate(async (wanted) => {
    const blobs = new Map(); // object URL -> Blob
    const origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { const u = origCreate(b); blobs.set(u, b); return u; };
    const clicked = [];
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) clicked.push({ download: this.download, url: this.href });
      return origClick.apply(this, arguments);
    };
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Export'));
    if (!btn) return null;
    btn.click();
    await new Promise((r) => setTimeout(r, 1200)); // records export is deferred ~500ms
    const hit = clicked.find((c) => c.download.includes('attendance-' + wanted));
    if (!hit || !blobs.has(hit.url)) return null;
    return await blobs.get(hit.url).text();
  }, which);
  if (!csv) throw new Error(`export not found: attendance-${which}`);
  await page.goto('data:text/plain;charset=utf-8,' + encodeURIComponent(csv), { waitUntil: 'load', timeout: 10000 });
  await page.waitForTimeout(300);
}

// Pages to capture: [route, filename, label, roles, prepStep?]
const PAGES = [
  ['/login',                        '01-login',                       'Login Page',                  'public'],
  ['/dashboard/admin',              '02-admin-dashboard',             'Admin Dashboard',             'admin'],
  ['/dashboard/owner',              '03-owner-dashboard',             'Owner Dashboard',             'owner'],
  ['/dashboard/instructor',         '04-instructor-dashboard',        'Instructor Dashboard',        'instructor'],
  ['/dashboard/student',            '05-student-dashboard',           'Student Dashboard',           'student'],
  ['/dashboard/parent',             '06-parent-dashboard',            'Parent Dashboard',            'parent'],
  ['/dashboard/treasurer',          '07-treasurer-dashboard',         'Treasurer Dashboard',         'treasurer'],
  ['/dashboard/sponsor',            '08-sponsor-dashboard',           'Sponsor Dashboard',           'sponsorship'],
  ['/dashboard/third-party',        '09-thirdparty-dashboard',        'Third Party Dashboard',       'third_party'],
  ['/courses',                      '10-courses',                     'Course List',                 'all'],
  ['/users',                        '11-users',                       'User Management',             'admin'],
  ['/programmes',                   '12-programmes',                  'Programme Management',        'admin'],
  ['/gradebook',                    '13-gradebook',                   'Gradebook',                   'all'],
  ['/essays',                       '14-essays',                      'Essay List',                  'all'],
  ['/canvas',                       '15-canvas',                      'Annotation Canvas',           'all'],
  ['/attendance',                   '16-attendance',                  'Attendance',                  'all'],
  ['/calendar',                     '17-calendar',                    'Calendar',                    'all'],
  ['/content',                      '18-content-library',             'Content Library',             'instructor'],
  ['/assignments',                  '19-assignments',                 'Assignments',                 'all'],
  ['/finance',                      '20-finance',                     'Finance',                     'treasurer'],
  ['/notifications',                '21-notifications',               'Notifications',               'all'],
  ['/reports',                      '22-reports',                     'Reports & Analytics',         'admin'],
  ['/audit',                        '23-audit-log',                   'Audit Log',                   'admin'],
  ['/certificates',                 '24-certificates',                'Certificates',                'all'],
  ['/settings',                     '25-settings',                    'Settings',                    'admin'],
  ['/profile',                      '26-profile',                     'Profile',                     'all'],
  ['/privacy',                      '27-privacy',                     'Privacy Notice',              'all'],
  ['/consent',                      '28-consent',                     'Consent Management',          'parent'],
  // Roll-call flow — Calendar page (instructor)
  ['/calendar',                     '29-calendar-roll',               'Calendar — Take Roll ready',  'instructor', openCalendarRollState],
  ['/calendar',                     '30-calendar-roll-modal',         'Calendar — Take Roll modal',  'instructor', openCalendarRollModal],
  // Roll-call flow — Attendance page (instructor)
  ['/attendance',                   '31-attendance-roll',             'Attendance — Take Roll ready','instructor', openAttendanceRollState],
  ['/attendance',                   '32-attendance-roll-modal',       'Attendance — Take Roll modal','instructor', openAttendanceRollModal],
  // CSV export flow — actual downloaded file contents (Attendance page)
  ['/attendance',                   '33-attendance-export-schedules', 'Attendance Export — schedules CSV','instructor', async (page) => showExportedCsv(page, 'schedules')],
  ['/attendance',                   '34-attendance-export-records',   'Attendance Export — records CSV','instructor', async (page) => showExportedCsv(page, 'records')],
];

// Role-to-email mapping for mock auth
const ROLE_EMAILS = {
  'admin':       'admin@mahardhika.id',
  'owner':       'owner@mahardhika.id',
  'instructor':  'instructor@mahardhika.id',
  'student':     'student@mahardhika.id',
  'parent':      'parent@mahardhika.id',
  'treasurer':   'treasurer@mahardhika.id',
  'sponsorship': 'sponsor@mahardhika.id',
  'third_party': 'thirdparty@mahardhika.id',
  'all':         'admin@mahardhika.id',  // default to admin for shared pages
  'public':      null,                    // no auth needed
};

// Login as a specific role by setting mock auth in localStorage
async function loginAs(page, role) {
  const email = ROLE_EMAILS[role] || ROLE_EMAILS['all'];
  if (!email) return; // public page, no login needed

  // Navigate to login page first to initialize the app
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  
  // Set mock user in localStorage (this is how the app stores mock auth)
  await page.evaluate((em) => {
    localStorage.setItem('akademi_mock_user', em);
    localStorage.setItem('akademi_access_token', 'mock-token-' + em);
  }, email);
  
  // Reload to pick up the new auth state
  await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(800);
}

async function captureAll() {
  console.log(`\n📸 AKADEMI Weekly Screenshot Capture`);
  console.log(`   Date: ${today}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const results = [];
  let lastRole = null;

  for (const pageSpec of PAGES) {
    const [route, filename, label, roles, prepStep] = pageSpec;
    const outPath = path.join(OUTPUT_DIR, `${filename}.png`);
    try {
      // Login as the required role (skip if same role as previous page)
      if (roles !== lastRole) {
        await loginAs(page, roles);
        lastRole = roles;
      }

      // Navigate to the target page
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(800); // Let animations settle

      // Close any modals/notifications that might overlay
      try {
        const closeBtn = page.locator('button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 500 })) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        }
      } catch {}

      // Run an interactive prep step (e.g. open a modal) before capturing
      if (prepStep) {
        await prepStep(page);
        await page.waitForTimeout(300);
      }

      await page.screenshot({ path: outPath, fullPage: false });
      const size = fs.statSync(outPath).size;
      results.push({ label, filename, roles, status: '✅', size: `${(size / 1024).toFixed(0)}KB` });
      console.log(`  ✅ ${label} (${(size / 1024).toFixed(0)}KB)`);
    } catch (err) {
      results.push({ label, filename, roles, status: '❌', error: err.message.slice(0, 80) });
      console.log(`  ❌ ${label}: ${err.message.slice(0, 80)}`);
    }
  }

  await browser.close();

  // Generate manifest
  const manifest = {
    date: today,
    baseUrl: BASE_URL,
    totalScreenshots: results.length,
    successful: results.filter(r => r.status === '✅').length,
    failed: results.filter(r => r.status === '❌').length,
    screenshots: results,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n📊 Summary: ${manifest.successful}/${manifest.totalScreenshots} captured`);
  console.log(`   Output: ${OUTPUT_DIR}\n`);

  return manifest;
}

// Run if called directly
if (require.main === module) {
  captureAll().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { captureAll };
