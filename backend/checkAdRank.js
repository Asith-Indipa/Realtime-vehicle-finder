const puppeteer = require('puppeteer-core');
const p = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

(async () => {
  const b = await puppeteer.launch({ executablePath: p, headless: 'new', args: ['--no-sandbox'] });
  const page = await b.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
  
  try {
    await page.goto('https://riyasewana.com/buy/bajaj-re-4-sale-colombo-12266194', { waitUntil: 'domcontentloaded', timeout: 15000 });
    console.log('Status: Loaded page');
    console.log('Title:', await page.title());
    const info = await page.evaluate(() => {
      const more = document.querySelector('.vmore-content, body');
      return more ? more.innerText.substring(0, 300) : '';
    });
    console.log('Info:', info.replace(/\s+/g, ' '));
  } catch (e) {
    console.log('Error loading URL:', e.message);
  }

  await b.close();
})();
