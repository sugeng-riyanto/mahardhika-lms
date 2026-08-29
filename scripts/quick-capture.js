/**
 * Quick screenshot capture — uses domcontentloaded instead of networkidle
 * to avoid timeouts when backend API is not running.
 * 
 * Usage:
 *   PLAYWRIGHT_BROWSERS_PATH="C:/Users/User/AppData/Local/ms-playwright" node scripts/quick-capture.js
 */
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'playwright'));
const fs = require('fs');

const today = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.join(__dirname, '..', 'reports', 'weekly', today);
const BASE_URL = 'http://localhost:5173';

const PAGES = [
  ['/login', '01-login', 'Login Page', 'public'],
  ['/dashboard/admin', '02-admin-dashboard', 'Admin Dashboard', 'admin'],
  ['/dashboard/owner', '03-owner-dashboard', 'Owner Dashboard', 'owner'],
  ['/dashboard/instructor', '04-instructor-dashboard', 'Instructor Dashboard', 'instructor'],
  ['/dashboard/student', '05-student-dashboard', 'Student Dashboard', 'student'],
  ['/dashboard/parent', '06-parent-dashboard', 'Parent Dashboard', 'parent'],
  ['/dashboard/treasurer', '07-treasurer-dashboard', 'Treasurer Dashboard', 'treasurer'],
  ['/dashboard/sponsor', '08-sponsor-dashboard', 'Sponsor Dashboard', 'sponsorship'],
  ['/dashboard/third-party', '09-thirdparty-dashboard', 'Third Party Dashboard', 'third_party'],
  ['/courses', '10-courses', 'Course List', 'all'],
  ['/users', '11-users', 'User Management', 'admin'],
  ['/programmes', '12-programmes', 'Programme Management', 'admin'],
  ['/gradebook', '13-gradebook', 'Gradebook', 'all'],
  ['/essays', '14-essays', 'Essay List', 'all'],
  ['/canvas', '15-canvas', 'Annotation Canvas', 'all'],
  ['/attendance', '16-attendance', 'Attendance', 'all'],
  ['/calendar', '17-calendar', 'Calendar', 'all'],
  ['/content', '18-content-library', 'Content Library', 'instructor'],
  ['/assignments', '19-assignments', 'Assignments', 'all'],
  ['/finance', '20-finance', 'Finance', 'treasurer'],
  ['/notifications', '21-notifications', 'Notifications', 'all'],
  ['/reports', '22-reports', 'Reports & Analytics', 'admin'],
  ['/audit', '23-audit-log', 'Audit Log', 'admin'],
  ['/certificates', '24-certificates', 'Certificates', 'all'],
  ['/settings', '25-settings', 'Settings', 'admin'],
  ['/profile', '26-profile', 'Profile', 'all'],
  ['/privacy', '27-privacy', 'Privacy Notice', 'all'],
  ['/consent', '28-consent', 'Consent Management', 'parent'],
];

const ROLE_EMAILS = {
  'admin': 'admin@mahardhika.id',
  'owner': 'owner@mahardhika.id',
  'instructor': 'instructor@mahardhika.id',
  'student': 'student@mahardhika.id',
  'parent': 'parent@mahardhika.id',
  'treasurer': 'treasurer@mahardhika.id',
  'sponsorship': 'sponsor@mahardhika.id',
  'third_party': 'thirdparty@mahardhika.id',
  'all': 'admin@mahardhika.id',
  'public': null,
};

async function loginAs(page, role) {
  const email = ROLE_EMAILS[role] || ROLE_EMAILS['all'];
  if (!email) return;
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate((em) => {
    localStorage.setItem('akademi_mock_user', em);
    localStorage.setItem('akademi_access_token', 'mock-token-' + em);
  }, email);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.waitForTimeout(500);
}

async function captureAll() {
  console.log(`\n📸 AKADEMI Weekly Screenshot Capture (${today})\n`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  const results = [];
  let lastRole = null;

  for (const [route, filename, label, roles] of PAGES) {
    const outPath = path.join(OUTPUT_DIR, `${filename}.png`);
    try {
      if (roles !== lastRole) {
        await loginAs(page, roles);
        lastRole = roles;
      }
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(600);
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
  const manifest = {
    date: today, baseUrl: BASE_URL,
    totalScreenshots: results.length,
    successful: results.filter(r => r.status === '✅').length,
    failed: results.filter(r => r.status === '❌').length,
    screenshots: results,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n📊 ${manifest.successful}/${manifest.totalScreenshots} captured → ${OUTPUT_DIR}\n`);
  return manifest;
}

captureAll().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
