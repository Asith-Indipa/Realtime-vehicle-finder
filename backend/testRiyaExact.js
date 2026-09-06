const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const fs = require('fs');

const findChromePath = () => {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of commonPaths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
};

async function check() {
  const chromePath = findChromePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(`https://riyasewana.com/search/three-wheels?_t=${Date.now()}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('Listings found on Riyasevana:');
    $('ul.v-list li, li').each((i, el) => {
      const link = $(el).find('a[href*="/buy/"]').first().attr('href');
      if (!link) return;
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const title = $(el).find('h2').text().trim() || $(el).find('a[title]').attr('title') || '';
      console.log(`[${i}] Title: "${title}" | URL: "${link}" | Text: "${text}"`);
    });
  } catch (e) {
    console.error(e.message);
  } finally {
    await browser.close();
  }
}

check();
