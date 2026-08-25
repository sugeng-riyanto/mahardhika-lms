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

// Pages to capture: [route, filename, label, roles that can see it]
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
];

// Mock auth: simulate login by setting localStorage before navigation
async function setupAuth(page) {
  // The app uses mock auth via localStorage when Supabase isn't configured
  // We just need to navigate and let the mock auth auto-login as admin
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
}

async function captureAll() {
  console.log(`\n📸 AKADEMI Weekly Screenshot Capture`);
  console.log(`   Date: ${today}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log(`   Base URL: ${BASE_URL}\n`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Setup auth
  await setupAuth(page);

  const results = [];

  for (const [route, filename, label, roles] of PAGES) {
    const outPath = path.join(OUTPUT_DIR, `${filename}.png`);
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500); // Let animations settle

      // Close any modals/notifications that might overlay
      try {
        const closeBtn = page.locator('button[aria-label="Close"]').first();
        if (await closeBtn.isVisible({ timeout: 500 })) {
          await closeBtn.click();
          await page.waitForTimeout(200);
        }
      } catch {}

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
