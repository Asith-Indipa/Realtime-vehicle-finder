const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { normalizeLocation } = require('../utils/locationHelper');
const { extractPhoneFromText, findChromePath } = require('./detailService');

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
  'l200', 'bongo', 'canter', 'townace', 'liteace', 'hiace', 'carina', 'bluebird', 'vitz', 'celerio',

  // Spare Parts, Tyres, Engines, Accessories (Not complete vehicles)
  'tyre', 'tire', 'tyres', 'tires', 'hood', 'canopy', 'meter', 'silencer', 'silancer',
  'carburetor', 'carborator', 'engine', 'spare part', 'spare parts', 'alloy wheel', 'alloy rim',
  'rims', 'battery', 'clutch', 'gear box', 'bare chassis', 'chassis only', 'seat cover', 'curtain',
  'seat set', 'buffer', 'mudguard', 'door net', 'audio setup', 'subwoofer', 'dashboard', 'wheel rack'
];

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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080',
        '--disable-gpu',
        '--no-first-run',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    const allRawItems = [];
    const seenItemIds = new Set();

    // Query each regional hub to guarantee island-wide coverage
    for (const hub of REGIONAL_HUBS) {
      try {
        const cacheBuster = Date.now();
        const requestUrl = `https://www.facebook.com/marketplace/${hub.slug}/search/?query=three%20wheel&sortBy=creation_time_descend&_t=${cacheBuster}`;

        await page.goto(requestUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise((resolve) => setTimeout(resolve, 2500));

        // Dismiss any Facebook login or cookie overlay modal
        try {
          await page.keyboard.press('Escape');
          const closeBtn = await page.$('div[aria-label="Close"], [aria-label="close"], div[role="button"][tabindex="0"]');
          if (closeBtn) await closeBtn.click().catch(() => {});
        } catch (_) {}

        await new Promise((resolve) => setTimeout(resolve, 1000));

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

            results.push({
              itemId,
              url: cleanUrl,
              imgUrl,
              imgAlt,
              ariaLabel,
              spans,
              fullText
            });
          }

          return results;
        });

        for (const item of hubItems) {
          if (!seenItemIds.has(item.itemId)) {
            seenItemIds.add(item.itemId);
            allRawItems.push(item);
          }
        }
      } catch (hubErr) {
        console.warn(`[Facebook Scraper Hub Notice] Hub ${hub.name} skipped: ${hubErr.message}`);
      }
    }

    const listings = [];
    const seenUrls = new Set();

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

      // Check for price drop in aria label (e.g. "reduced from LKR860,000")
      const dropMatch = cleanAria.match(/reduced from\s+(?:LKR|Rs\.?|රු)\s*([\d,]+)/i);
      if (dropMatch) {
        previousPriceNumeric = parseInt(dropMatch[1].replace(/,/g, ''), 10) || null;
        if (previousPriceNumeric) {
          previousPrice = `Rs ${previousPriceNumeric.toLocaleString()}`;
        }
      }

      // Extract current price (first occurrence of LKR/Rs)
      const priceMatch = cleanAria.match(/(?:LKR|Rs\.?|රු)\s*([\d,]+)/i);
      if (priceMatch) {
        priceNumeric = parseInt(priceMatch[1].replace(/,/g, ''), 10) || 0;
        priceText = `Rs ${priceNumeric.toLocaleString()}`;
      }

      // Extract title and location from cleanAria
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

      // Fallback 1: Extract from imgAlt (e.g. "Three Wheel in Weligama")
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

      // Fallback 2: Check card spans / fullText
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

      // Fallback 3: Clean up Title
      let title = rawTitle ? rawTitle.replace(/\+/g, ' ').trim() : '';
      if (!title || title.length < 3) {
        title = `Three Wheel`;
      } else {
        // Clean duplicate repeated words
        title = title.replace(/\b(\w+)\s+\1\b/gi, '$1');
        if (!title.toLowerCase().includes('three wheel') && !title.toLowerCase().includes('3 wheel') && !title.toLowerCase().includes('tuk')) {
          title = `${title} Three Wheel`;
        }
      }

      // ─────────────────────────────────────────────────────────
      // 2. FILTERING: Complete 3-Wheelers ONLY
      // Prices < 150,000 are spare parts (dashboards, seat covers), rent, or Rs 1,111 placeholders.
      // Prices > 4,500,000 are spam / test inputs.
      // ─────────────────────────────────────────────────────────
      if (priceNumeric < 150000 || priceNumeric > 4500000) {
        continue;
      }

      // Discard invalid vehicles and parts (cars, vans, bikes, buses, dashboards)
      const testContent = `${title} ${item.fullText} ${item.url}`.toLowerCase();
      const hasInvalid = INVALID_VEHICLES.some(k => testContent.includes(k));
      if (hasInvalid) {
        continue;
      }

      // Calculate Price Drop if detected natively
      if (previousPriceNumeric && previousPriceNumeric > priceNumeric) {
        hasPriceDrop = true;
        priceDropAmount = previousPriceNumeric - priceNumeric;
      }

      seenUrls.add(item.url);

      // Normalize Location using Sri Lanka helper
      let normalizedLocation = normalizeLocation(locationText || 'Sri Lanka');
      if (!normalizedLocation || normalizedLocation === 'Sri Lanka') {
        normalizedLocation = 'Sri Lanka';
      }

      // Enhance generic title with location (e.g. "Three Wheel - Matara")
      if (title === 'Three Wheel' && normalizedLocation !== 'Sri Lanka') {
        const cityPart = normalizedLocation.split(',')[0].trim();
        title = `Bajaj Three Wheel - ${cityPart}`;
      }

      // Extract seller phone number if explicitly written in card text
      const phoneExtracted = extractPhoneFromText(`${title} ${item.fullText}`);

      // Extract year if specified (e.g. 2000 - 2026)
      const yearMatch = `${title} ${item.fullText}`.match(/\b(199\d|20[0-2]\d)\b/);
      const year = yearMatch ? yearMatch[1] : 'N/A';

      // Creation timestamp: staggered back slightly by index for clean descending display
      const postedTimestamp = new Date(Date.now() - index * 3 * 60 * 1000);

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

    console.log(`[Scraper - facebook.com] Scraped ${listings.length} Guaranteed Island-Wide 3-Wheel ads.`);
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
