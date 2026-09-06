const puppeteer = require('puppeteer-core');
const cheerio = require('cheerio');
const p = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: p, headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage();
  
  // Test 1: three-wheel
  await page.goto('https://riyasewana.com/search/three-wheel', { waitUntil: 'domcontentloaded' });
  console.log('URL 1 final:', page.url());
  const html1 = await page.content();
  const $1 = cheerio.load(html1);
  console.log('Heading 1:', $1('h1').text().trim());

  // Test 2: three-wheels
  await page.goto('https://riyasewana.com/search/three-wheels', { waitUntil: 'domcontentloaded' });
  console.log('URL 2 final:', page.url());
  const html2 = await page.content();
  const $2 = cheerio.load(html2);
  console.log('Heading 2:', $2('h1').text().trim());

  // Test 3: vehicles/three-wheelers or three-wheel
  await page.goto('https://riyasewana.com', { waitUntil: 'domcontentloaded' });
  const homeHtml = await page.content();
  const $h = cheerio.load(homeHtml);
  $h('a').each((i, el) => {
    const href = $h(el).attr('href') || '';
    const txt = $h(el).text().trim();
    if (txt.toLowerCase().includes('three wheel') || href.includes('three-wheel')) {
      console.log('Home link:', txt, '->', href);
    }
  });

  await b.close();
})();
