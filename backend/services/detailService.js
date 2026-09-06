const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const { extractIkmanLocation, extractRiyasevanaLocation } = require('../utils/locationHelper');

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

/**
 * Extracts and cleans a valid Sri Lankan phone number from raw text or HTML attributes.
 * Handles spaces, hyphens, +94 prefixes, and local formats.
 */
const extractPhoneFromText = (text) => {
  if (!text) return null;
  // Prioritize Sri Lankan Mobile Numbers (070, 071, 072, 074, 075, 076, 077, 078)
  const mobileRegex = /(?:\+?94[\s.-]?|0)7[0-8](?:[\s.-]?\d){7}\b/g;
  const mobileMatches = text.match(mobileRegex);
  if (mobileMatches) {
    for (const m of mobileMatches) {
      let cleaned = m.replace(/[\s.-]/g, '');
      if (cleaned.startsWith('+94')) cleaned = '0' + cleaned.substring(3);
      if (cleaned.startsWith('94') && cleaned.length === 11) cleaned = '0' + cleaned.substring(2);
      if (/^07[0-8]\d{7}$/.test(cleaned)) {
        return cleaned;
      }
    }
  }

  // Fallback to Sri Lankan Landline Numbers (011, 033, 081, etc.)
  const landlineRegex = /(?:\+?94[\s.-]?|0)(?:11|21|22|23|24|25|26|27|31|32|33|34|35|36|37|38|41|45|47|51|52|54|55|57|63|65|66|67|81)(?:[\s.-]?\d){7}\b/g;
  const landlineMatches = text.match(landlineRegex);
  if (landlineMatches) {
    for (const m of landlineMatches) {
      let cleaned = m.replace(/[\s.-]/g, '');
      if (cleaned.startsWith('+94')) cleaned = '0' + cleaned.substring(3);
      if (cleaned.startsWith('94') && cleaned.length === 11) cleaned = '0' + cleaned.substring(2);
      if (/^0[1-9]\d{8}$/.test(cleaned)) {
        return cleaned;
      }
    }
  }
  return null;
};

/**
 * Fetches the seller's contact phone number and exact location (City, District) directly from detail page
 */
const fetchSellerDetails = async (sourceUrl, source, existingBrowser = null) => {
  if (!sourceUrl) return { phone: null, location: null };

  let extractedPhone = null;
  let extractedLocation = null;

  // Fast Path: Axios Cheerio check (instant for static HTML & SSR markup)
  try {
    const res = await axios.get(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      timeout: 7000,
    });
    const $ = cheerio.load(res.data);

    // Extract exact location
    if (source === 'ikman.lk' || sourceUrl.includes('ikman.lk')) {
      const subText = $('[class*="subtitle--"], [class*="sub-title--"]').first().text().trim();
      const loc = extractIkmanLocation(subText);
      if (loc) extractedLocation = loc;
    } else {
      const loc = extractRiyasevanaLocation(sourceUrl, $('body').text());
      if (loc) extractedLocation = loc;
    }

    // Extract phone from tel link or dedicated contact element
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
      const p = extractPhoneFromText(telLink);
      if (p) extractedPhone = p;
    }

    if (!extractedPhone) {
      const phEl = $('.ph-num, [class*="phone-number"], [class*="call-btn"]').text();
      if (phEl) {
        extractedPhone = extractPhoneFromText(phEl);
      }
    }

    if (!extractedPhone) {
      extractedPhone = extractPhoneFromText($('body').text());
    }

    // Check __NEXT_DATA__ JSON on Ikman
    if (!extractedPhone) {
      const nextDataEl = $('#__NEXT_DATA__').html();
      if (nextDataEl) {
        try {
          const nextJson = JSON.parse(nextDataEl);
          const adData = nextJson.props?.pageProps?.initialData?.ad || nextJson.props?.pageProps?.ad;
          if (adData && adData.contactDetail) {
            extractedPhone = extractPhoneFromText(JSON.stringify(adData.contactDetail));
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    // Fall through to browser if blocked or needs dynamic rendering
  }

  // If phone is unmasked and location is found, return immediately without browser overhead
  if (extractedPhone && extractedLocation) {
    return { phone: extractedPhone, location: extractedLocation };
  }

  // Browser Path for dynamic JS pages
  let browser = existingBrowser;
  let shouldCloseBrowser = false;

  try {
    if (!browser) {
      const chromePath = findChromePath();
      if (!chromePath) return { phone: extractedPhone, location: extractedLocation };

      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      });
      shouldCloseBrowser = true;
    }

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Abort heavy assets and tracking scripts to make page load under 1 second & prevent timeout
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url().toLowerCase();
      if (
        ['image', 'stylesheet', 'font', 'media'].includes(req.resourceType()) ||
        url.includes('google') ||
        url.includes('doubleclick') ||
        url.includes('facebook') ||
        url.includes('analytics') ||
        url.includes('clarity') ||
        url.includes('youtube') ||
        url.includes('scorecardresearch')
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    // On Ikman, click the "Call / Show Number" button if present and wait for dynamic render
    if (source === 'ikman.lk' || sourceUrl.includes('ikman.lk')) {
      try {
        await page.evaluate(() => {
          const btn = document.querySelector('button[aria-label*="Call"], button[class*="contact"], button[class*="phone"], [class*="show-number"]');
          if (btn) btn.click();
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (_) {}
    }

    const evalData = await page.evaluate(() => {
      // 1. Direct tel link
      let rawPhone = null;
      const telEl = document.querySelector('a[href^="tel:"]');
      if (telEl) {
        const href = telEl.getAttribute('href') || '';
        rawPhone = href.replace('tel:', '').trim();
        if (!rawPhone || rawPhone.includes('X')) {
          rawPhone = telEl.innerText.trim();
        }
      }

      // 2. Dedicated phone container (e.g. .ph-num on Riyasewana)
      if (!rawPhone) {
        const phEl = document.querySelector('.ph-num, [class*="phone-number"], [class*="call-btn"]');
        if (phEl) rawPhone = phEl.innerText.trim();
      }

      // 3. Subtitle location
      const subEl = document.querySelector('[class*="subtitle--"], [class*="sub-title--"]');
      const subText = subEl ? subEl.innerText.trim() : '';

      // 4. Visible body text
      const bodyText = document.body ? document.body.innerText : '';

      return { rawPhone, subText, bodyText };
    });

    if (evalData.rawPhone && !extractedPhone) {
      extractedPhone = extractPhoneFromText(evalData.rawPhone);
    }

    if (evalData.subText && !extractedLocation) {
      const loc = extractIkmanLocation(evalData.subText);
      if (loc) extractedLocation = loc;
    }

    if (!extractedLocation && source !== 'ikman.lk') {
      const loc = extractRiyasevanaLocation(sourceUrl, evalData.bodyText);
      if (loc) extractedLocation = loc;
    }

    if (!extractedPhone && evalData.bodyText) {
      extractedPhone = extractPhoneFromText(evalData.bodyText);
    }

    await page.close().catch(() => {});
  } catch (e) {
    console.log(`[Detail Extractor Note] Detail page check for ${sourceUrl}: ${e.message}`);
  } finally {
    if (shouldCloseBrowser && browser) {
      await browser.close().catch(() => {});
    }
  }

  return { phone: extractedPhone, location: extractedLocation };
};

module.exports = {
  fetchSellerDetails,
  extractPhoneFromText,
  findChromePath,
};
