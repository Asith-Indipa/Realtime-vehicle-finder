const puppeteer = require('puppeteer-core');
const { normalizeLocation } = require('../utils/locationHelper');
const { extractPhoneFromText, findChromePath } = require('./detailService');

const INVALID_VEHICLES = [
  // Motorbikes & Scooters + Common Sri Lankan Typos & Slang
  'apache', 'pulsar', 'palser', 'pulser', 'polser', 'plsr', 'xcd', 'discover', 'discorver', 'discove',
  'platina', 'plateno', 'platino', 'ct100', 'ct 100', 'ct-100', 'boxer', 'fz', 'fzs', 'fz-s', 'dio',
  'wego', 'hornet', 'gn125', 'gn 125', 'gn-125', 'twister', 'ray z', 'ray-z', 'rayzr',
  'pleasure', 'scooty', 'vespa', 'benly', 'bike', 'bikes', 'scooter', 'scooters',
  'motorcycle', 'motor cycle', 'motorbike', 'motor bike', 'yb100', 'yb 100', 'splendor',
  'dash', 'v15', 'honda', 'yamaha', 'hero', 'suzuki', 'kawasaki', 'royal enfield',
  'gixxer', 'passion', 'glamour', 'cb400', 'cbr', 'duke', 'ns200', 'ns 200', 'ns160', 'ns 160',
  'xr125', 'xr250', 'dtracker', 'd-tracker', 'volty', 'grasstracker',

  // Motorbike Engine Capacities / CC (Three-wheelers are 175cc, 198cc, 205cc - NEVER 150cc, 125cc, etc.)
  '100cc', '110cc', '125cc', '135cc', '150cc', '160cc', '180cc', '220cc', '250cc',
  '100 cc', '110 cc', '125 cc', '135 cc', '150 cc', '160 cc', '180 cc', '220 cc', '250 cc',
  'bajaj 100', 'bajaj 110', 'bajaj 125', 'bajaj 135', 'bajaj 150', 'bajaj 160', 'bajaj 180', 'bajaj 220',

  // Buses
  'bus', 'buses', 'leyland', 'ashok', 'ashok-leyland', 'eicher', 'rosa', 'coaster', 'viking',

  // Cars, SUVs, Vans, Trucks, Cabs & Lorries
  'kwid', 'dimo', 'lokka', 'renault', 'tata', 'tercel', 'corolla', 'civic',
  'sunny', 'n16', 'alto', 'wagon', 'every', 'vezel', 'swift', 'tiida', 'dolphin', 'maruti',
  'prius', 'crv', 'raize', 'lancer', 'march', 'car', 'van', 'lorry', 'truck', 'bmw', 'audi',
  'benz', 'mercedes', 'ford', 'mitsubishi', 'isuzu', 'mazda', 'kia', 'hyundai', 'perodua',
  'proton', 'mg', 'chery', 'dfsk', 'micro', 'land rover', 'jeep', 'suv', 'sedan', 'hatchback',
  'nissan', 'crew cab', 'double cab', 'single cab', 'cab', 'pickup', 'pick up', 'navara', 'hilux',
  'l200', 'bongo', 'canter', 'townace', 'liteace', 'hiace', 'carina', 'bluebird', 'vitz', 'celerio',

  // Spare Parts, Tyres, Engines, Accessories (Not complete vehicles)
  'tyre', 'tire', 'tyres', 'tires', 'hood', 'canopy', 'meter', 'silencer', 'silancer',
  'carburetor', 'carborator', 'engine', 'spare part', 'spare parts', 'alloy wheel', 'alloy rim',
  'rims', 'battery', 'clutch', 'gear box', 'bare chassis', 'chassis only', 'seat cover', 'curtain',
  'seat set', 'buffer', 'mudguard', 'door net', 'audio setup', 'subwoofer', 'dashboard', 'wheel rack'
];

const VALID_THREEWHEEL_REGEX = /\b(bajaj\s*re|re\b|2\s*stroke|4\s*stroke|tvs\s*king|piaggio|ape|three\s*wheel|3\s*wheel|three-wheel|3-wheel|tuk\s*tuk|tuk|tuktuk|triwheel|auto\s*rickshaw|qute|compact|maxima|4stroke|2stroke|2t\b|4t\b|205\b|alfa|atul|(?:20[0-9]|aa[a-z]|ab[a-z]|ac[a-z])\s*-?\s*\d{4})\b/i;

// Complete Sri Lankan regional hubs covering all 9 provinces & 25 districts on Facebook Marketplace
const REGIONAL_HUBS = [
  { name: 'Western (Colombo / Gampaha / Kalutara)', slug: 'colombo' },
  { name: 'Southern (Matara / Galle / Hambantota)', slug: 'matara' },
  { name: 'Central (Kandy / Matale / Nuwara Eliya)', slug: 'kandy' },
  { name: 'North Western (Kurunegala / Puttalam)', slug: 'kurunegala' },
  { name: 'Northern (Jaffna / Mannar / Vavuniya / Kilinochchi / Mullaitivu)', slug: 'jaffna' },
  { name: 'Eastern (Trincomalee / Batticaloa / Ampara)', slug: 'trincomalee' },
  { name: 'North Central (Anuradhapura / Polonnaruwa)', slug: 'anuradhapura' },
  { name: 'Uva (Badulla / Moneragala)', slug: 'badulla' },
  { name: 'Sabaragamuwa (Ratnapura / Kegalle)', slug: 'ratnapura' },
];

// Expanded search queries to capture all 3-wheeler titles (numeric, word, model specific)
const SEARCH_QUERIES = ['three wheel', '3 wheel', 'bajaj re'];

// ── Tunables ────────────────────────────────────────────────────────────────
const HUB_TIMEOUT_MS = 45000;      // per-attempt navigation timeout (was 20000)
const MAX_RETRIES = 2;             // extra attempts after the first (3 tries total)
const HUB_CONCURRENCY = 2;         // 2 parallel pages for stable memory & zero CDP socket drops
const CARD_WAIT_TIMEOUT_MS = 8000; // adaptive wait for ad cards to hydrate
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);

/**
 * Runs `worker(item)` over `items` with at most `limit` running concurrently.
 * Plain implementation, no extra dependency needed.
 */
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function lane() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  }

  const lanes = Array.from({ length: Math.min(limit, items.length) }, lane);
  await Promise.all(lanes);
  return results;
}

/**
 * Blocks heavy assets (images/fonts/css/media) on a page while leaving
 * document/script/xhr/fetch untouched — Marketplace's card grid is populated
 * via GraphQL/XHR after the initial shell, so those must stay allowed.
 * NOTE: blocking the image *request* does not remove the `src` attribute
 * already present in the DOM — we only ever read that attribute string,
 * never the decoded pixels, so captured image URLs are unaffected.
 */
async function blockHeavyAssets(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (BLOCKED_RESOURCE_TYPES.has(req.resourceType())) {
      req.abort().catch(() => {});
    } else {
      req.continue().catch(() => {});
    }
  });
}

/**
 * Scrapes a single regional hub with retry + backoff. Never throws —
 * returns [] if every attempt fails, so one bad hub can't kill the cycle.
 */
async function scrapeHub(browser, hub, query = 'three wheel') {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let page = null;
    try {
      page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1920, height: 1080 });
      await blockHeavyAssets(page);

      const cacheBuster = Date.now();
      const requestUrl = `https://www.facebook.com/marketplace/${hub.slug}/search/?query=${encodeURIComponent(query)}&sortBy=creation_time_descend&_t=${cacheBuster}`;

      await page.goto(requestUrl, { waitUntil: 'domcontentloaded', timeout: HUB_TIMEOUT_MS });

      // Dismiss any Facebook login or cookie overlay modal
      try {
        await page.keyboard.press('Escape');
        const closeBtn = await page.$('div[aria-label="Close"], [aria-label="close"], div[role="button"][tabindex="0"]');
        if (closeBtn) await closeBtn.click().catch(() => {});
      } catch (_) {}

      // Adaptive wait: proceed as soon as cards exist instead of a blind fixed sleep
      try {
        await page.waitForSelector('a[href*="/marketplace/item/"]', { timeout: CARD_WAIT_TIMEOUT_MS });
      } catch (_) {
        // Genuinely could be an empty hub — fall through and let evaluate() return []
      }
      await new Promise((resolve) => setTimeout(resolve, 800)); // small settle buffer

      const hubItems = await page.evaluate(() => {
        const results = [];
        const links = Array.from(document.querySelectorAll('a[href*="/marketplace/item/"]'));

        for (const a of links) {
          const href = a.getAttribute('href') || '';
          const match = href.match(/\/marketplace\/item\/(\d+)/);
          if (!match) continue;

          const itemId = match[1];
          const cleanUrl = `https://www.facebook.com/marketplace/item/${itemId}/`;

          const imgEl = a.querySelector('img');
          const imgUrl = imgEl ? (imgEl.getAttribute('src') || '') : '';
          const imgAlt = imgEl ? (imgEl.getAttribute('alt') || '') : '';

          const ariaLabel = a.getAttribute('aria-label') || '';

          const spans = Array.from(a.querySelectorAll('span[dir="auto"], span'))
            .map(s => s.innerText ? s.innerText.trim() : '')
            .filter(Boolean);

          const fullText = a.innerText ? a.innerText.replace(/\r?\n+/g, ' | ').trim() : '';

          results.push({ itemId, url: cleanUrl, imgUrl, imgAlt, ariaLabel, spans, fullText });
        }

        return results;
      });

      await page.close().catch(() => {});
      console.log(`[FB Hub OK] ${hub.name} ("${query}") -> ${hubItems.length} raw item(s)`);
      return hubItems;
    } catch (err) {
      lastError = err;
      if (page) await page.close().catch(() => {});
      console.warn(`[FB Hub Retry] ${hub.name} ("${query}") attempt ${attempt}/${MAX_RETRIES + 1} failed: ${err.message}`);
      if (attempt <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * attempt)); // linear backoff
      }
    }
  }

  console.warn(`[Facebook Scraper Hub Notice] Hub ${hub.name} ("${query}") skipped after ${MAX_RETRIES + 1} attempts: ${lastError ? lastError.message : 'unknown error'}`);
  return [];
}

/**
 * Scrapes recently posted 3-Wheel deals from Facebook Marketplace across all Sri Lankan regions
 * Runs safely in guest / logged-out mode without requiring a personal Facebook account.
 * @returns {Promise<Array>} List of standardized 3-wheel listing objects
 */
const scrapeFacebook = async () => {
  let browser = null;
  try {
    const chromePath = findChromePath();
    if (!chromePath) {
      console.error('[Scraper Error - facebook.com] Chrome executable not found.');
      return [];
    }

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      protocolTimeout: 90000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-first-run',
      ],
    });

    // Generate tasks for all 9 regional hubs across all search queries
    const scrapeTasks = [];
    for (const hub of REGIONAL_HUBS) {
      for (const query of SEARCH_QUERIES) {
        scrapeTasks.push({ hub, query });
      }
    }

    // Scrape with bounded concurrency
    const perTaskResults = await runWithConcurrency(scrapeTasks, HUB_CONCURRENCY, (task) =>
      scrapeHub(browser, task.hub, task.query)
    );

    const allRawItems = [];
    const seenItemIds = new Set();
    for (const hubItems of perTaskResults) {
      if (!hubItems) continue;
      for (const item of hubItems) {
        if (!seenItemIds.has(item.itemId)) {
          seenItemIds.add(item.itemId);
          allRawItems.push(item);
        }
      }
    }

    const listings = [];
    const seenUrls = new Set();
    // Track unique ads by content fingerprint (price + location + image) to prevent
    // the same vehicle posted multiple times under different URLs from appearing as duplicates
    const seenContentFingerprints = new Set();

    for (let index = 0; index < allRawItems.length; index++) {
      const item = allRawItems[index];
      if (seenUrls.has(item.url)) continue;

      let rawTitle = '';
      let priceText = '';
      let priceNumeric = 0;
      let locationText = 'Sri Lanka';
      let hasPriceDrop = false;
      let previousPrice = null;
      let previousPriceNumeric = null;
      let priceDropAmount = 0;

      // ─────────────────────────────────────────────────────────
      // 1. INTELLIGENT PARSING FROM ARIA-LABEL & IMG-ALT
      // ─────────────────────────────────────────────────────────
      const aria = item.ariaLabel || '';
      const cleanAria = aria.replace(/,\s*listing\s*\d+.*$/i, '').trim();

      const dropMatch = cleanAria.match(/reduced from\s+(?:LKR|Rs\.?|රු)\s*([\d,]+)/i);
      if (dropMatch) {
        previousPriceNumeric = parseInt(dropMatch[1].replace(/,/g, ''), 10) || null;
        if (previousPriceNumeric) {
          previousPrice = `Rs ${previousPriceNumeric.toLocaleString()}`;
        }
      }

      const priceMatch = cleanAria.match(/(?:LKR|Rs\.?|රු)\s*([\d,]+)/i);
      if (priceMatch) {
        priceNumeric = parseInt(priceMatch[1].replace(/,/g, ''), 10) || 0;
        priceText = `Rs ${priceNumeric.toLocaleString()}`;
      }

      if (cleanAria.includes(',')) {
        const parts = cleanAria.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          const firstPart = parts[0];
          if (!/^(?:LKR|Rs|රු|\d|just listed|reduced)/i.test(firstPart) && firstPart.length > 2) {
            rawTitle = firstPart;
          }
        }

        if (parts.length >= 2) {
          const possibleLoc = parts[parts.length - 1];
          if (!possibleLoc.toLowerCase().includes('reduced') && !possibleLoc.toLowerCase().includes('lkr') && !possibleLoc.toLowerCase().includes('rs')) {
            locationText = possibleLoc;
          }
        }
      }

      if (item.imgAlt) {
        const altMatch = item.imgAlt.match(/^(.*?)\s+in\s+(.+)$/i);
        if (altMatch) {
          if (!rawTitle && altMatch[1] && altMatch[1].trim()) {
            rawTitle = altMatch[1].trim();
          }
          if ((!locationText || locationText === 'Sri Lanka') && altMatch[2]) {
            locationText = altMatch[2].trim();
          }
        } else if (!rawTitle && item.imgAlt.length > 2) {
          rawTitle = item.imgAlt.trim();
        }
      }

      if (!priceNumeric) {
        for (const s of item.spans) {
          const m = s.match(/(?:LKR|Rs\.?|රු)\s*([\d,]+)/i);
          if (m) {
            priceNumeric = parseInt(m[1].replace(/,/g, ''), 10) || 0;
            priceText = `Rs ${priceNumeric.toLocaleString()}`;
            break;
          }
        }
      }

      // ─────────────────────────────────────────────────────────
      // 2. FILTERING: Complete 3-Wheelers ONLY
      // ─────────────────────────────────────────────────────────
      if (priceNumeric < 150000 || priceNumeric > 4500000) {
        continue;
      }

      const testContent = `${rawTitle} ${item.ariaLabel} ${item.imgAlt} ${item.fullText} ${item.url}`.toLowerCase();
      const hasInvalid = INVALID_VEHICLES.some(k => testContent.includes(k));
      if (hasInvalid) {
        continue;
      }

      // Positive verification: Must match three-wheeler patterns OR have an empty/generic title
      const isPositiveThreeWheel = !rawTitle || rawTitle.length < 3 || VALID_THREEWHEEL_REGEX.test(testContent);
      if (!isPositiveThreeWheel) {
        continue;
      }

      let title = rawTitle ? rawTitle.replace(/\+/g, ' ').trim() : '';
      if (!title || title.length < 3) {
        title = `Three Wheel`;
      } else {
        title = title.replace(/\b(\w+)\s+\1\b/gi, '$1');
        const lowerTitle = title.toLowerCase();
        if (!lowerTitle.includes('three wheel') && !lowerTitle.includes('3 wheel') && !lowerTitle.includes('tuk')) {
          title = `${title} Three Wheel`;
        }
      }

      if (previousPriceNumeric && previousPriceNumeric > priceNumeric) {
        hasPriceDrop = true;
        priceDropAmount = previousPriceNumeric - priceNumeric;
      }

      // ─────────────────────────────────────────────────────────
      // 3. DUPLICATE DETECTION: Same vehicle posted under multiple URLs
      //    Fingerprint = price + location + image URL path (without CDN query params)
      // ─────────────────────────────────────────────────────────
      const imgFingerprint = item.imgUrl ? item.imgUrl.split('?')[0].split('/').pop() : '';
      const contentFingerprint = `${priceNumeric}|${locationText.toLowerCase()}|${imgFingerprint}`;
      if (seenContentFingerprints.has(contentFingerprint)) {
        continue; // Same vehicle already captured with a different URL
      }
      seenContentFingerprints.add(contentFingerprint);

      seenUrls.add(item.url);

      let normalizedLocation = normalizeLocation(locationText || 'Sri Lanka');
      if (!normalizedLocation || normalizedLocation === 'Sri Lanka') {
        normalizedLocation = 'Sri Lanka';
      }

      if (title === 'Three Wheel' && normalizedLocation !== 'Sri Lanka') {
        const cityPart = normalizedLocation.split(',')[0].trim();
        title = `Bajaj Three Wheel - ${cityPart}`;
      }

      const phoneExtracted = extractPhoneFromText(`${title} ${item.fullText}`);

      const yearMatch = `${title} ${item.fullText}`.match(/\b(199\d|20[0-2]\d)\b/);
      const year = yearMatch ? yearMatch[1] : 'N/A';

      const postedTimestamp = new Date();

      listings.push({
        title,
        price: priceText,
        priceNumeric,
        location: normalizedLocation,
        year,
        phone: phoneExtracted || 'N/A',
        source: 'facebook.com',
        sourceUrl: item.url,
        itemId: item.itemId,
        originalImages: item.imgUrl ? [item.imgUrl] : [],
        cloudinaryImages: [],
        postedTimeText: 'Recently posted',
        postedTimestamp,
        hasPriceDrop,
        previousPrice,
        previousPriceNumeric,
        priceDropAmount,
      });
    }

    const duplicatesFiltered = allRawItems.length - seenItemIds.size;
    console.log(`[Scraper - facebook.com] Scraped ${listings.length} Guaranteed Island-Wide 3-Wheel ads.${seenContentFingerprints.size < listings.length + 5 ? '' : ` (${allRawItems.length - listings.length} duplicates filtered)`}`);
    return listings;
  } catch (error) {
    console.error(`[Scraper Error - facebook.com] ${error.message}`);
    return [];
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

module.exports = { scrapeFacebook };
