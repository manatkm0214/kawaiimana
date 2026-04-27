const puppeteer = require('puppeteer');
const path = require('path');

const targets = [
  { html: '../docs/export/html/user-manual.html', pdf: '../docs/export/pdf/user-manual.pdf' },
  { html: '../docs/export/html/security-check.html', pdf: '../docs/export/pdf/security-check.pdf' },
  { html: '../docs/export/html/specification.html', pdf: '../docs/export/pdf/specification.pdf' },
  { html: '../docs/export/html/design.html', pdf: '../docs/export/pdf/design.pdf' },
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  for (const { html, pdf } of targets) {
    const htmlPath = path.resolve(__dirname, html);
    const pdfPath = path.resolve(__dirname, pdf);
    const page = await browser.newPage();
    await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' }
    });
    await page.close();
    console.log('PDF generated:', pdfPath);
  }
  await browser.close();
})();
