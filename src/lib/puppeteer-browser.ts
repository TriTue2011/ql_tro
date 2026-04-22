/**
 * Singleton Puppeteer browser — tái sử dụng giữa các request.
 * Giảm độ trễ từ ~1s xuống ~50ms mỗi lần render PDF.
 */
import type { Browser } from 'puppeteer';

let _browser: Browser | null = null;
let _launching: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const puppeteer = await import('puppeteer');
  return puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none',
    ],
  });
}

export async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.connected) return _browser;
  if (_launching) return _launching;
  _launching = launch().then(b => {
    _browser = b;
    b.on('disconnected', () => { _browser = null; });
    _launching = null;
    return b;
  }).catch(err => {
    _launching = null;
    throw err;
  });
  return _launching;
}

/**
 * Render HTML → PDF buffer, định dạng A4.
 * @param html Full HTML (sẽ wrap trong template có <html><body>)
 */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const fullHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 10mm 8mm; }
  body { margin: 0; padding: 0; font-family: 'Times New Roman', Times, serif; }
</style>
</head>
<body>${html}</body>
</html>`;
    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}
