require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const Listing = require('./models/Listing');
const { scrapeIkman } = require('./services/ikmanScraper');
const { scrapeRiyasevana } = require('./services/riyasevanaScraper');
const { backupImages } = require('./services/imageService');
const { sendWhatsAppAlert, sendWhatsAppPriceDropAlert, getWhatsAppStatus, restartWhatsAppBot, logoutWhatsAppBot } = require('./services/whatsappService');
const listingRoutes = require('./routes/listingRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/listings', listingRoutes);
app.use('/api/auth', authRoutes);

app.get('/api/whatsapp/status', (req, res) => {
  res.json({
    success: true,
    ...getWhatsAppStatus(),
  });
});

app.post('/api/whatsapp/restart', async (req, res) => {
  restartWhatsAppBot();
  res.json({ success: true, message: 'WhatsApp Bot restarting...' });
});

app.use('/api/whatsapp/test', async (req, res) => {
  const sampleListing = {
    title: 'TVS King 2026 (Filter Verification Test)',
    price: 'Rs 1,850,000',
    priceNumeric: 1850000,
    location: 'Colombo',
    phone: '0716394044',
    source: 'ikman.lk',
    sourceUrl: 'https://ikman.lk/test-deal',
  };
  const result = await sendWhatsAppAlert(sampleListing);
  res.json({ success: result, message: 'Test alert sent to matching subscribers.' });
});

app.post('/api/whatsapp/logout', async (req, res) => {
  logoutWhatsAppBot();
  res.json({ success: true, message: 'WhatsApp Bot logging out...' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const puppeteer = require('puppeteer-core');
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

/**
 * Fetches the seller's contact phone number directly from the detail page URL using Puppeteer (prevents 403 Forbidden)
 */
const fetchSellerPhone = async (sourceUrl, source) => {
  let browser = null;
  try {
    const chromePath = findChromePath();
    if (!chromePath) return null;

    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });

    const phone = await page.evaluate(() => {
      const telEl = document.querySelector('a[href^="tel:"]');
      if (telEl) {
        const href = telEl.getAttribute('href') || '';
        const cleaned = href.replace('tel:', '').trim();
        if (cleaned) return cleaned;
        if (telEl.innerText.trim()) return telEl.innerText.trim();
      }

      // Check contact boxes or general text
      const pageText = document.body.innerText;
      const match = pageText.match(/(?:07[0-8]\d{7}|0[1-9]\d{8})/);
      return match ? match[0] : null;
    });

    return phone;
  } catch (e) {
    console.log(`[Phone Extractor Note] Detail page check for ${sourceUrl}: ${e.message}`);
    return null;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
};

// Master Scraping & Alert Execution Loop
const runScrapeCycle = async () => {
  console.log(`\n======================================================`);
  console.log(`[Scraper Cycle Started] ${new Date().toLocaleTimeString()} - Checking for new 3-Wheelers...`);
  console.log(`======================================================`);

  try {
    const [ikmanAds, riyasevanaAds] = await Promise.all([
      scrapeIkman(),
      scrapeRiyasevana(),
    ]);

    const allScrapedAds = [...ikmanAds, ...riyasevanaAds];
    let newItemsCount = 0;

    for (const ad of allScrapedAds) {
      const cleanSourceUrl = ad.sourceUrl ? ad.sourceUrl.split('?')[0] : ad.sourceUrl;
      ad.sourceUrl = cleanSourceUrl;

      // Step 1: Check if this exact URL already exists
      const existingByUrl = await Listing.findOne({ sourceUrl: cleanSourceUrl });
      if (existingByUrl) {
        // Check if price dropped!
        if (ad.priceNumeric > 0 && existingByUrl.priceNumeric > 0 && ad.priceNumeric < existingByUrl.priceNumeric) {
          const dropAmount = existingByUrl.priceNumeric - ad.priceNumeric;
          console.log(`📉 [PRICE DROP DETECTED] "${ad.title}": ${existingByUrl.price} → ${ad.price} (Saved Rs. ${dropAmount.toLocaleString()})`);

          existingByUrl.previousPrice = existingByUrl.price;
          existingByUrl.previousPriceNumeric = existingByUrl.priceNumeric;
          existingByUrl.price = ad.price;
          existingByUrl.priceNumeric = ad.priceNumeric;
          existingByUrl.hasPriceDrop = true;
          existingByUrl.priceDropAmount = dropAmount;
          existingByUrl.postedTimestamp = ad.postedTimestamp;
          existingByUrl.postedTimeText = ad.postedTimeText;
          existingByUrl.title = ad.title;
          await existingByUrl.save();

          await sendWhatsAppPriceDropAlert(existingByUrl);
        } else {
          // Same URL - update timestamp quietly
          await Listing.updateOne(
            { sourceUrl: cleanSourceUrl },
            { $set: { postedTimestamp: ad.postedTimestamp, postedTimeText: ad.postedTimeText, title: ad.title } }
          );
        }
        continue; // Skip new deal alert & image backup for existing URLs
      }

      // Step 2: Smart duplicate detection - match by Image URL OR Title + Price
      const adImageUrl = (ad.originalImages && ad.originalImages.length > 0) ? ad.originalImages[0] : null;
      let duplicateEntry = null;

      if (adImageUrl && adImageUrl.length > 10) {
        duplicateEntry = await Listing.findOne({
          source: ad.source,
          originalImages: adImageUrl,
        });
      }

      if (!duplicateEntry && ad.title && ad.priceNumeric > 0) {
        duplicateEntry = await Listing.findOne({
          source: ad.source,
          title: ad.title,
          priceNumeric: ad.priceNumeric,
        });
      }

      if (duplicateEntry) {
        // Same vehicle reposted - update quietly without duplicate Cloudinary upload or repeat WhatsApp alert
        console.log(`🔄 [DUPLICATE REPOST UPDATED] "${duplicateEntry.title}" (${ad.source})`);
        await Listing.updateOne(
          { _id: duplicateEntry._id },
          { $set: { sourceUrl: cleanSourceUrl, postedTimestamp: ad.postedTimestamp, postedTimeText: ad.postedTimeText } }
        );
        continue; // Skip WhatsApp alert & duplicate Cloudinary upload
      }

      // Step 3: Check age of listing - ONLY process recent ads (posted within last 48 hours)
      const nowMs = Date.now();
      const listingMs = ad.postedTimestamp ? new Date(ad.postedTimestamp).getTime() : nowMs;
      const ageInHours = (nowMs - listingMs) / (1000 * 60 * 60);

      if (ageInHours > 48) {
        console.log(`ℹ️ [WhatsApp Skip] "${ad.title}" is a promoted/bumped ad originally posted on "${ad.postedTimeText}". Skipping instant alert.`);
        continue;
      }

      // Step 4: ONLY Upload to Cloudinary & save BRAND NEW genuine recent deal to database
      const cloudImages = await backupImages(ad.originalImages);
      const newListing = await Listing.create({
        ...ad,
        cloudinaryImages: cloudImages,
      });

      newItemsCount++;
      console.log(`✨ [GENUINE NEW DEAL] [${ad.source}] ${ad.title} (${ad.price})`);

      // Extract seller phone number directly from detail page if missing
      if (!newListing.phone || newListing.phone === 'N/A') {
        const detailPhone = await fetchSellerPhone(newListing.sourceUrl, newListing.source);
        if (detailPhone) {
          newListing.phone = detailPhone;
          await newListing.save();
          console.log(`📞 [Seller Phone Extracted] ${detailPhone} for ${newListing.title}`);
        }
      }

      // Trigger instant WhatsApp alert ONLY for genuinely new ads posted within the last 48 hours
      const sent = await sendWhatsAppAlert(newListing);
      if (sent) {
        newListing.notifiedWhatsApp = true;
        await newListing.save();
      }
    }

    console.log(`[Scraper Cycle Finished] Found ${newItemsCount} new 3-Wheel deal(s).\n`);
  } catch (error) {
    console.error(`[Scraper Cycle Error] ${error.message}`);
  }
};

const { cleanupOldListings } = require('./controllers/listingController');

const PORT = process.env.PORT || 5000;

// Connect Database & Launch Server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 [Server Ready] Running on http://localhost:${PORT}`);
    
    // Initial cleanup & scrape 3 seconds after server startup
    setTimeout(async () => {
      await cleanupOldListings();
      await runScrapeCycle();
    }, 3000);

    // Schedule automatic scraping & 7-day auto-cleanup cycle every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      await cleanupOldListings();
      await runScrapeCycle();
    });
    console.log('⏰ [Scheduler] Cron job registered: Running every 5 minutes (Auto-Scrape + 7-Day Cleanup).');
  });
});
