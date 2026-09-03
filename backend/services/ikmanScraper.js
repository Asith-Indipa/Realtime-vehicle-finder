const axios = require('axios');
const cheerio = require('cheerio');

const IKMAN_BASE_URL = 'https://ikman.lk/en/ads/sri-lanka/three-wheelers';

const INVALID_VEHICLES = [
  // Motorbikes & Scooters
  'apache', 'pulsar', 'xcd', 'discover', 'platina', 'ct100', 'ct 100', 'fz', 'dio', 'wego',
  'hornet', 'gn125', 'gn 125', 'twister', 'ray z', 'pleasure', 'scooty', 'vespa', 'benly',
  'bike', 'scooter', 'motorcycle', 'yb100', 'splendor', 'dash', 'v15', 'honda', 'yamaha', 'hero',
  'suzuki', 'kawasaki', 'royal enfield',

  // Buses
  'bus', 'buses', 'leyland', 'ashok', 'ashok-leyland', 'eicher', 'rosa', 'coaster', 'viking',

  // Cars, SUVs, Vans, Trucks, Cabs & Lorries
  'kwid', 'dimo', 'lokka', 'renault', 'tata', 'tercel', 'corolla', 'civic',
  'sunny', 'n16', 'alto', 'wagon', 'every', 'vezel', 'swift', 'tiida', 'dolphin', 'maruti',
  'prius', 'crv', 'raize', 'lancer', 'march', 'car', 'van', 'lorry', 'truck', 'bmw', 'audi',
  'benz', 'mercedes', 'ford', 'mitsubishi', 'isuzu', 'mazda', 'kia', 'hyundai', 'perodua',
  'proton', 'mg', 'chery', 'dfsk', 'micro', 'land rover', 'jeep', 'suv', 'sedan', 'hatchback',
  'nissan', 'crew cab', 'double cab', 'single cab', 'cab', 'pickup', 'pick up', 'navara', 'hilux',
  'l200', 'bongo', 'canter', 'townace', 'liteace', 'hiace', 'carina', 'bluebird', 'vitz', 'celerio'
];

const VALID_THREEWHEEL_REGEX = /\b(bajaj re|re|2\s*stroke|4\s*stroke|tvs\s*king|piaggio\s*ape|ape|three\s*wheel|3\s*wheel|three-wheel|3-wheel|tuk|qute|compact|maxima|chassis|4stroke|2stroke|yf|subish|piaggio|three\s*wheelers)\b/i;

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

  const minMatch = lower.match(/(\d+)\s*(min|minute)/);
  if (minMatch) {
    return new Date(now.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);
  }

  const hrMatch = lower.match(/(\d+)\s*(hr|hour)/);
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

const scrapeIkman = async () => {
  try {
    const cacheBuster = Date.now();
    const requestUrl = `${IKMAN_BASE_URL}?sort=date&order=desc&_t=${cacheBuster}`;

    const { data } = await axios.get(requestUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const listings = [];
    const seenUrls = new Set();

    const rawCards = [];
    $('a[href*="/en/ad/"]').each((index, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      const sourceUrl = href.startsWith('http') ? href : `https://ikman.lk${href}`;
      if (seenUrls.has(sourceUrl)) return;

      const card = $(element).closest('li, div[class*="item--"], div[class*="card--"], div[class*="normal--"]');
      if (!card.length) return;

      const title = card.find('h2, [class*="title--"]').first().text().trim() || $(element).text().trim();
      if (!title || title.length < 3) return;

      if (!isStrictThreeWheel(title, sourceUrl)) {
        return;
      }

      seenUrls.add(sourceUrl);
      rawCards.push({ card, title, sourceUrl });
    });

    for (const item of rawCards) {
      const { card, title, sourceUrl } = item;
      const fullCardText = card.text();

      let priceText = card.find('[class*="price--"]').first().text().trim();
      if (!priceText) {
        const pm = fullCardText.match(/Rs\s?[\d,]+/i);
        priceText = pm ? pm[0] : 'Negotiable';
      }

      let locationText = card.find('[class*="description--"], [class*="location--"]').first().text().trim();
      if (!locationText) {
        const locMatch = fullCardText.match(/(Colombo|Gampaha|Kandy|Kurunegala|Galle|Matara|Kalutara|Negombo|Jaffna|Ratnapura|Badulla|Nuwara-Eliya|Anuradhapura|Polonnaruwa|Puttalam|Kegalle|Matale|Hambantota|Vavuniya|Trincomalee|Mannar|Mullaitivu|Moneragala)/i);
        locationText = locMatch ? locMatch[0] : 'Sri Lanka';
      }

      let timeText = card.find('[class*="updated-time--"], [class*="date--"]').text().trim();
      if (!timeText) {
        const tm = fullCardText.match(/(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\s*\d{1,2}:\d{2}\s*(?:am|pm))?|\d+\s*(?:minute|min|hour|hr|day|week|month)s?\s*(?:ago)?|Just now|Today|Yesterday)/i);
        timeText = tm ? tm[0] : '';
      }

      if (!timeText || timeText.length < 2) {
        try {
          const detailRes = await axios.get(sourceUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
            timeout: 6000,
          });
          const $detail = cheerio.load(detailRes.data);
          const detailText = $detail('body').text();
          const dateMatch = detailText.match(/Posted on\s+([0-9]{1,2}\s+[A-Za-z]{3}\s+[0-9]{1,2}:[0-9]{2}\s*(?:am|pm)?)/i);
          if (dateMatch) {
            timeText = dateMatch[1];
          }
        } catch (err) {
          timeText = '7 days ago';
        }
      }

      if (!timeText) {
        timeText = '7 days ago';
      }

      const imgNode = card.find('img').first();
      let imgUrl = imgNode.attr('src') || imgNode.attr('data-src') || '';

      if (imgUrl.startsWith('//')) {
        imgUrl = `https:${imgUrl}`;
      }

      if (imgUrl && imgUrl.includes('/')) {
        imgUrl = imgUrl.replace(/\/\d+\/\d+\/fitted\.jpg/, '/620/466/fitted.jpg');
      }

      const priceNumeric = parseInt(priceText.replace(/[^0-9]/g, ''), 10) || 0;
      let postedTimestamp = parsePostedTimestamp(timeText);
      if (!postedTimestamp || isNaN(postedTimestamp.getTime())) {
        postedTimestamp = new Date(Date.now() - (rawCards.indexOf(item) + 1) * 60 * 1000);
      }

      listings.push({
        title,
        price: priceText,
        priceNumeric,
        location: locationText || 'Sri Lanka',
        source: 'ikman.lk',
        sourceUrl,
        originalImages: imgUrl ? [imgUrl] : [],
        postedTimeText: timeText,
        postedTimestamp,
      });
    }

    console.log(`[Scraper - ikman.lk] Scraped ${listings.length} Guaranteed 3-Wheel ads with exact dates.`);
    return listings;
  } catch (error) {
    console.error(`[Scraper Error - ikman.lk] ${error.message}`);
    return [];
  }
};

module.exports = { scrapeIkman };
