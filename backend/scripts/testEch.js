const puppeteer = require('puppeteer-core');
const { findChromePath } = require('../services/detailService');

async function testEch() {
  const chromePath = findChromePath();
  console.log('Testing Chrome with Encrypted Client Hello (ECH) and Cloudflare DoH...');

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=EncryptedClientHello,DnsOverHttps',
      '--dns-over-https-mode=secure',
      '--dns-over-https-templates=https://chrome.cloudflare-dns.com/dns-query',
    ],
  });

  try {
    const page = await browser.newPage();
    console.log('Navigating to https://www.facebook.com ...');
    const start = Date.now();
    await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log(`>>> ECH SUCCESS in ${Date.now() - start}ms! Title: "${await page.title()}"`);
  } catch (err) {
    console.log('ECH Test failed:', err.message);
  } finally {
    await browser.close();
  }
}

testEch();
