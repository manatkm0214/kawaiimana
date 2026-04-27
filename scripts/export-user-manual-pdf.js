const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const htmlPath = path.resolve(__dirname, '../docs/export/html/user-manual.html');
  const pdfPath = path.resolve(__dirname, '../docs/export/pdf/user-manual.pdf');
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', right: '16mm', bottom: '16mm', left: '16mm' }
  });
  await browser.close();
  console.log('PDF generated:', pdfPath);
})();
