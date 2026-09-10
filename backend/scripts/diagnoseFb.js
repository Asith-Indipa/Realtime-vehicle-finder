const puppeteer = require('puppeteer-core');
const dns = require('dns').promises;
const { findChromePath } = require('../services/detailService');

async function testFlags() {
  const chromePath = findChromePath();
  console.log('Using Chrome:', chromePath);

  // First check what IPv4 address facebook.com resolves to
  let fbIpv4 = '57.144.242.141';
  try {
    const res = await dns.resolve4('www.facebook.com');
    console.log('Resolved IPv4 for www.facebook.com:', res);
    if (res && res.length > 0) fbIpv4 = res[0];
  } catch (e) {
    console.log('DNS resolve error:', e.message);
  }

  const configurations = [
    {
      name: 'Host Resolver Rules (Forces IPv4)',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        `--host-resolver-rules=MAP *.facebook.com ${fbIpv4}, MAP facebook.com ${fbIpv4}`,
      ],
    },
    {
      name: 'Disable AsyncDns & DnsOverHttps',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-features=AsyncDns,DnsOverHttps',
      ],
    },
  ];

  for (const config of configurations) {
    console.log(`\n--- Testing: ${config.name} ---`);
    let browser = null;
    try {
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: config.args,
      });

      const page = await browser.newPage();
      console.log('Navigating to https://www.facebook.com ...');
      const start = Date.now();
      await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 12000 });
      console.log(`>>> SUCCESS in ${Date.now() - start}ms! Page Title: "${await page.title()}"`);
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    } finally {
      if (browser) await browser.close();
    }
  }
}

testFlags();
