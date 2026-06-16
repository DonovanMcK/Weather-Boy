// Full-page screenshots at the three QA viewports (docs/05-qa.md).
//
// Setup (first time):
//   npm i -D playwright
//   npx playwright install chromium
// Usage:
//   node qa-screenshots.js http://localhost:3000 [out-prefix]
//
// Writes <out-prefix>-375.png, -768.png, -1440.png (default prefix: qa).
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2];
  if (!url) {
    console.error('usage: node qa-screenshots.js <url> [out-prefix]');
    process.exit(1);
  }
  const prefix = process.argv[3] || 'qa';
  const browser = await chromium.launch();
  for (const width of [375, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(url);
    await page.screenshot({ path: `${prefix}-${width}.png`, fullPage: true });
    console.log(`${prefix}-${width}.png`);
  }
  await browser.close();
})();
