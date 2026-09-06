const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const p = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: p, headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  await page.goto('https://riyasewana.com/search/three-wheels', { waitUntil: 'domcontentloaded' });
  const html = await page.content();
  const $ = cheerio.load(html);
  
  $('ul.v-list li, li').each((i, el) => {
    const link = $(el).find('a[href*="/buy/"]').first().attr('href');
    if (!link) return;
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t.includes('1,960,000') || t.includes('1960000') || t.includes('476,000') || t.includes('1,287,000')) {
      console.log(`- ${link} | ${t}`);
    }
  });

  await b.close();
})();
