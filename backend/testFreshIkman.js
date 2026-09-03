const axios = require('axios');
const cheerio = require('cheerio');

async function testFreshIkman() {
  console.log('Fetching fresh ikman data with cache-busting...');
  const cacheBuster = Date.now();
  const url = `https://ikman.lk/en/ads/sri-lanka/three-wheelers?sort=date&order=desc&_t=${cacheBuster}`;

  const { data } = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(data);
  const ads = [];
  const seenUrls = new Set();

  $('a[href*="/en/ad/"]').each((i, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const fullUrl = href.startsWith('http') ? href : `https://ikman.lk${href}`;

    if (seenUrls.has(fullUrl)) return;

    // Find card container
    const card = $(el).closest('li, div[class*="item--"], div[class*="card--"]');
    if (!card.length) return;

    const title = card.find('h2, [class*="title--"]').first().text().trim() || $(el).text().trim();
    if (!title || title.length < 3) return;

    seenUrls.add(fullUrl);

    const fullCardText = card.text();
    let priceText = card.find('[class*="price--"]').first().text().trim();
    if (!priceText) {
      const pm = fullCardText.match(/Rs\s?[\d,]+/i);
      priceText = pm ? pm[0] : 'Negotiable';
    }

    let timeText = card.find('[class*="updated-time--"], [class*="date--"]').text().trim();
    if (!timeText) {
      const tm = fullCardText.match(/(\d+\s*(?:minute|min|hour|hr|day|week|month)s?|Just now|Today|Yesterday)/i);
      timeText = tm ? tm[0] : 'Just now';
    }

    ads.push({ title, price: priceText, timeText, url: fullUrl });
  });

  console.log(`Successfully extracted ${ads.length} ads from ikman.lk:`);
  ads.slice(0, 10).forEach((ad, idx) => {
    console.log(`#${idx + 1}: ${ad.title} | ${ad.price} | Time: "${ad.timeText}" | ${ad.url}`);
  });
}

testFreshIkman();
