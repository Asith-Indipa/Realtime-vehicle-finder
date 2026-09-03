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

const INVALID_VEHICLES = [
  // Motorbikes & Scooters
  'apache', 'pulsar', 'xcd', 'discover', 'platina', 'ct100', 'ct 100', 'fz', 'dio', 'wego',
  'hornet', 'gn125', 'gn 125', 'twister', 'ray z', 'pleasure', 'scooty', 'vespa', 'benly',
  'bike', 'scooter', 'motorcycle', 'yb100', 'splendor', 'dash', 'v15', 'honda', 'yamaha', 'hero',
  'suzuki', 'tvs', 'kawasaki', 'royal enfield',

  // Cars, SUVs, Vans, Trucks, Cabs & Lorries
  'kwid', 'dimo', 'lokka', 'renault', 'tata', 'tercel', 'corolla', 'civic',
  'sunny', 'n16', 'alto', 'wagon', 'every', 'vezel', 'swift', 'tiida', 'dolphin', 'maruti',
  'prius', 'crv', 'raize', 'lancer', 'march', 'car', 'van', 'lorry', 'truck', 'bmw', 'audi',
  'benz', 'mercedes', 'ford', 'mitsubishi', 'isuzu', 'mazda', 'kia', 'hyundai', 'perodua',
  'proton', 'mg', 'chery', 'dfsk', 'micro', 'land rover', 'jeep', 'suv', 'sedan', 'hatchback',
  'nissan', 'crew cab', 'double cab', 'single cab', 'cab', 'pickup', 'pick up', 'navara', 'hilux',
  'l200', 'bongo', 'canter', 'townace', 'liteace', 'hiace', 'carina', 'bluebird', 'vitz', 'celerio'
];

const VALID_THREEWHEEL_REGEX = /\b(bajaj re|re|2\s*stroke|4\s*stroke|tvs king|king|piaggio ape|ape|three\s*wheel|3\s*wheel|three-wheel|3-wheel|tuk|qute|compact|maxima|chassis|4stroke|2stroke|yf|subish|piaggio|three\s*wheelers)\b/i;

const isStrictThreeWheel = (title, sourceUrl) => {
  const text = `${title} ${sourceUrl}`.toLowerCase();
  
  const hasInvalid = INVALID_VEHICLES.some(k => text.includes(k));
  if (hasInvalid) return false;

  return VALID_THREEWHEEL_REGEX.test(text);
};

const parsePostedTimestamp = (timeStr) => {
  if (!timeStr) return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const lower = timeStr.toLowerCase().trim();

  if (lower.includes('just now') || lower.includes('now')) {
    return now;
  }

  const minMatch = lower.match(/(\d+)\s*(m|min|minute)/);
  if (minMatch) {
    return new Date(now.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);
  }

  const hrMatch = lower.match(/(\d+)\s*(h|hr|hour)/);
  if (hrMatch) {
    return new Date(now.getTime() - parseInt(hrMatch[1], 10) * 60 * 60 * 1000);
  }

  if (lower.includes('yesterday')) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (timeMatch) {
      let hrs = parseInt(timeMatch[1], 10);
      const mins = parseInt(timeMatch[2], 10);
      if (timeMatch[3] === 'pm' && hrs < 12) hrs += 12;
      if (timeMatch[3] === 'am' && hrs === 12) hrs = 0;
      yesterday.setHours(hrs, mins, 0, 0);
    }
    return yesterday;
  }

  if (lower.includes('today')) {
    const today = new Date(now);
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})\s*(am|pm)/);
    if (timeMatch) {
      let hrs = parseInt(timeMatch[1], 10);
      const mins = parseInt(timeMatch[2], 10);
      if (timeMatch[3] === 'pm' && hrs < 12) hrs += 12;
      if (timeMatch[3] === 'am' && hrs === 12) hrs = 0;
      today.setHours(hrs, mins, 0, 0);
    }
    return today;
  }

  const dateMatch = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\s*(\d{1,2}):(\d{2})\s*(am|pm))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthStr = dateMatch[2];
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const month = months[monthStr];
    
    const year = now.getFullYear();
    const d = new Date(year, month, day);

    if (dateMatch[3] && dateMatch[4] && dateMatch[5]) {
      let hrs = parseInt(dateMatch[3], 10);
      const mins = parseInt(dateMatch[4], 10);
      if (dateMatch[5] === 'pm' && hrs < 12) hrs += 12;
      if (dateMatch[5] === 'am' && hrs === 12) hrs = 0;
      d.setHours(hrs, mins, 0, 0);
    }

    if (d > now) {
      d.setFullYear(year - 1);
    }
    return d;
  }

  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) {
    return new Date(now.getTime() - parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000);
  }

  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
};

const RIYASEWANA_URL = 'https://riyasewana.com/search/three-wheels';

const scrapeRiyasevana = async () => {
  let browser = null;
  try {
    const chromePath = findChromePath();
    if (!chromePath) {
      console.error('[Scraper Error - riyasewana.com] Chrome browser executable not found.');
      return [];
    }

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    
    const cacheBustedUrl = `${RIYASEWANA_URL}?_t=${Date.now()}`;
    await page.goto(cacheBustedUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const html = await page.content();
    const $ = cheerio.load(html);
    const listings = [];
    const seenUrls = new Set();

    $('ul.v-list li, li').each((index, element) => {
      const linkNode = $(element).find('a[href*="/buy/"]').first();
      const href = linkNode.attr('href');
      if (!href) return;

      const sourceUrl = href.startsWith('http') ? href : (href.startsWith('//') ? `https:${href}` : `https://riyasewana.com${href}`);
      if (seenUrls.has(sourceUrl)) return;

      const h2Text = $(element).find('h2').text().trim() || $(element).find('a[title]').attr('title') || linkNode.text().trim();
      if (!h2Text || h2Text.length < 3) return;

      if (!isStrictThreeWheel(h2Text, sourceUrl)) {
        return;
      }

      seenUrls.add(sourceUrl);

      let title = h2Text;
      if (!title.toLowerCase().includes('three wheel') && !title.toLowerCase().includes('3 wheel') && !title.toLowerCase().includes('tuk')) {
        title = `${title} Three Wheel`;
      }

      const fullCardText = $(element).text();
      let priceText = 'Negotiable';
      const priceMatch = fullCardText.match(/Rs\.\s?[\d,]+/i);
      if (priceMatch) {
        priceText = priceMatch[0];
      }

      let locationText = 'Sri Lanka';
      const locMatch = fullCardText.match(/(Colombo|Gampaha|Kandy|Kurunegala|Galle|Matara|Kalutara|Negombo|Batticaloa|Jaffna|Ratnapura|Badulla|Nuwara-Eliya|Anuradhapura|Polonnaruwa|Puttalam|Kegalle|Matale|Hambantota|Vavuniya|Trincomalee|Mannar|Mullaitivu|Moneragala)/i);
      if (locMatch) {
        locationText = locMatch[0];
      }

      let timeText = 'Recently posted';
      const timeMatch = fullCardText.match(/(\d+\s*(?:m|h|d|w|min|hour|hr|day|week)s?\s*ago|Today|Yesterday)/i);
      if (timeMatch) {
        timeText = timeMatch[0];
      }

      const imgNode = $(element).find('img').first();
      let imgUrl = imgNode.attr('src') || imgNode.attr('data-src') || '';

      if (imgUrl.startsWith('//')) {
        imgUrl = `https:${imgUrl}`;
      } else if (imgUrl.startsWith('/')) {
        imgUrl = `https://riyasewana.com${imgUrl}`;
      }

      if (imgUrl && imgUrl.includes('/small/')) {
        imgUrl = imgUrl.replace('/small/', '/large/');
      }

      const priceNumeric = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;
      const postedTimestamp = parsePostedTimestamp(timeText);

      listings.push({
        title,
        price: priceText,
        priceNumeric,
        location: locationText,
        source: 'riyasevana.com',
        sourceUrl,
        originalImages: imgUrl ? [imgUrl] : [],
        postedTimeText: timeText,
        postedTimestamp,
      });
    });

    console.log(`[Scraper - riyasewana.com] Scraped ${listings.length} Guaranteed 3-Wheel ads.`);
    return listings;
  } catch (error) {
    console.error(`[Scraper Error - riyasewana.com] ${error.message}`);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

module.exports = { scrapeRiyasevana };
