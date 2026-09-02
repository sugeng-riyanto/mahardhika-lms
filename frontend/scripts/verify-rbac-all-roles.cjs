const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const roles = [
    { email: 'owner@mahardhika.id', name: 'Owner' },
    { email: 'admin@mahardhika.id', name: 'Admin' },
    { email: 'instructor@mahardhika.id', name: 'Instructor' },
    { email: 'student@mahardhika.id', name: 'Student' },
    { email: 'parent@mahardhika.id', name: 'Parent' },
    { email: 'treasurer@mahardhika.id', name: 'Treasurer' },
    { email: 'sponsor@mahardhika.id', name: 'Sponsor' },
    { email: 'thirdparty@mahardhika.id', name: 'ThirdParty' }
  ];

  const results = [];

  for (const role of roles) {
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', role.email);
    await page.fill('input[type="password"]', 'dev-password-2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/**', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const navItems = await page.$$eval('nav a, aside a', els =>
      els.map(e => e.textContent.trim()).filter(t => t.length > 0 && t.length < 50)
    );
    const mainContent = await page.textContent('main') || '';
    const hasContent = mainContent.length > 10;
    const contentPreview = mainContent.substring(0, 80).replace(/\s+/g, ' ').trim();
    const url = page.url();

    const ok = navItems.length > 0 && hasContent;
    results.push({
      role: role.name,
      navCount: navItems.length,
      hasContent,
      ok,
      url,
      contentPreview
    });

    console.log(`${role.name}: ${navItems.length} nav items, content=${hasContent ? 'YES' : 'NO'}, url=${url} ${ok ? '✅' : '❌'}`);
    if (navItems.length > 0) {
      console.log(`  Nav: ${navItems.join(' | ')}`);
    }
    if (hasContent) {
      console.log(`  Content: ${contentPreview}...`);
    }
  }

  await browser.close();

  const allPass = results.every(r => r.ok);
  console.log(`\n=== SUMMARY: ${results.filter(r => r.ok).length}/${results.length} roles OK ${allPass ? '✅ ALL PASS' : '❌ SOME FAILURES'} ===`);
})();
