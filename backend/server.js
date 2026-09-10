require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const Listing = require('./models/Listing');
const FacebookBaseline = require('./models/FacebookBaseline');
const { scrapeIkman } = require('./services/ikmanScraper');
const { scrapeRiyasevana } = require('./services/riyasevanaScraper');
const { scrapeFacebook } = require('./services/facebookScraper');
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

const { fetchSellerDetails, extractPhoneFromText, findChromePath } = require('./services/detailService');

let isFirstScrapeCycle = true;

// Master Scraping & Alert Execution Loop
const runScrapeCycle = async () => {
  const isInitialRun = isFirstScrapeCycle;
  isFirstScrapeCycle = false;

  console.log(`\n======================================================`);
  console.log(`[Scraper Cycle Started] ${new Date().toLocaleTimeString()} - Checking for new 3-Wheelers... (Initial Run: ${isInitialRun})`);
  console.log(`======================================================`);

  try {
    const [ikmanAds, riyasevanaAds, facebookAds] = await Promise.all([
      scrapeIkman(),
      scrapeRiyasevana(),
      scrapeFacebook(),
    ]);

    // Baseline Initialization for Facebook Marketplace
    // On the initial scrape cycle of server boot, ALL current Facebook ads across all 9 provinces
    // are registered into FacebookBaseline and completely skipped (NOT saved to DB, 0 WhatsApp alerts).
    if (isInitialRun && facebookAds.length > 0) {
      const initialFbItems = facebookAds
        .map(ad => ({ itemId: ad.itemId || (ad.sourceUrl ? (ad.sourceUrl.match(/item\/(\d+)/) || [])[1] : null) }))
        .filter(d => Boolean(d.itemId));

      if (initialFbItems.length > 0) {
        await FacebookBaseline.insertMany(initialFbItems, { ordered: false }).catch(() => {});
        console.log(`ℹ️ [Facebook Baseline] Initialized ALL ${initialFbItems.length} historical Facebook ads in MongoDB.`);
        console.log(`ℹ️ [Facebook Baseline] Initial run: ALL historical Facebook ads completely ignored (0 WhatsApp alerts).`);
        console.log(`🔔 [Facebook Live Alert] Armed: ONLY genuine new 3-wheel ads posted from now on will be displayed and alerted!`);
      }
    }

    // Deduplicate batch by clean source URL to prevent E11000 duplicate key race conditions
    const allScrapedAds = [...ikmanAds, ...riyasevanaAds, ...facebookAds];
    const uniqueBatch = [];
    const seenBatchUrls = new Set();
    for (const item of allScrapedAds) {
      const cUrl = item.sourceUrl ? item.sourceUrl.split('?')[0] : item.sourceUrl;
      if (!cUrl || seenBatchUrls.has(cUrl)) continue;
      seenBatchUrls.add(cUrl);
      item.sourceUrl = cUrl;
      uniqueBatch.push(item);
    }

    let newItemsCount = 0;

    for (const ad of uniqueBatch) {
      // Step 0: If Facebook ad, completely skip if in baseline OR during initial boot cycle
      if (ad.source === 'facebook.com') {
        if (isInitialRun) {
          continue; // 100% guarantee: 0 Facebook ads alerted during initial run!
        }
        const fbItemId = ad.itemId || (ad.sourceUrl ? (ad.sourceUrl.match(/item\/(\d+)/) || [])[1] : null);
        if (fbItemId) {
          const isHistorical = await FacebookBaseline.findOne({ itemId: fbItemId });
          if (isHistorical) {
            continue; // Historical ad. Completely ignored!
          }
        }
      }

      const cleanSourceUrl = ad.sourceUrl;

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
          existingByUrl.title = ad.title;
          await existingByUrl.save();

          await sendWhatsAppPriceDropAlert(existingByUrl);
        }
        // IMPORTANT: Do NOT update postedTimestamp for existing ads!
        // Keeping original post timestamp prevents old ads from constantly jumping to the top of the website.
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
        // Same vehicle reposted - update sourceUrl only if needed, do NOT change original timestamp
        console.log(`🔄 [DUPLICATE REPOST SKIPPED] "${duplicateEntry.title}" (${ad.source})`);
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
      let newListing;
      try {
        newListing = await Listing.create({
          ...ad,
          cloudinaryImages: cloudImages,
        });
      } catch (createErr) {
        if (createErr.code === 11000) {
          continue; // Safely ignore duplicate key collisions
        }
        throw createErr;
      }

      // Record this newly alerted Facebook deal into FacebookBaseline
      if (ad.source === 'facebook.com') {
        const fbItemId = ad.itemId || (ad.sourceUrl ? (ad.sourceUrl.match(/item\/(\d+)/) || [])[1] : null);
        if (fbItemId) {
          await FacebookBaseline.create({ itemId: fbItemId }).catch(() => {});
        }
      }

      newItemsCount++;
      console.log(`✨ [GENUINE NEW DEAL] [${ad.source}] ${ad.title} (${ad.price})`);

      // Extract seller phone number and exact location (City, District) directly from detail page
      const details = await fetchSellerDetails(newListing.sourceUrl, newListing.source);
      let listingUpdated = false;

      if (details.phone && (!newListing.phone || newListing.phone === 'N/A')) {
        newListing.phone = details.phone;
        listingUpdated = true;
        console.log(`📞 [Seller Phone Extracted] ${details.phone} for ${newListing.title}`);
      }

      if (details.location && details.location !== 'Sri Lanka' && (!newListing.location || newListing.location === 'Sri Lanka' || !newListing.location.includes(','))) {
        newListing.location = details.location;
        listingUpdated = true;
        console.log(`📍 [Exact Location Extracted] ${details.location} for ${newListing.title}`);
      }

      if (listingUpdated) {
        await newListing.save();
      }

      // Trigger instant WhatsApp alert ONLY for genuinely new ads posted within the last 48 hours
      const sent = await sendWhatsAppAlert(newListing);
      if (sent) {
        newListing.notifiedWhatsApp = true;
        await newListing.save();
      }
    }

    console.log(`[Scraper Cycle Finished] Found ${newItemsCount} new 3-Wheel deal(s).\n`);

    // Automatic background enrichment for recent listings with missing contact numbers
    try {
      const pendingPhoneAds = await Listing.find({
        $or: [{ phone: 'N/A' }, { phone: null }, { phone: '' }]
      })
        .sort({ postedTimestamp: -1 })
        .limit(5)
        .lean();

      if (pendingPhoneAds.length > 0) {
        console.log(`🔍 [Auto-Enrichment] Checking ${pendingPhoneAds.length} recent ad(s) with missing contact details...`);
        for (const pad of pendingPhoneAds) {
          const detail = await fetchSellerDetails(pad.sourceUrl, pad.source);
          if (detail.phone && detail.phone !== 'N/A') {
            const updateDoc = { phone: detail.phone };
            if (detail.location && detail.location.includes(',') && (!pad.location || !pad.location.includes(','))) {
              updateDoc.location = detail.location;
            }
            await Listing.updateOne({ _id: pad._id }, { $set: updateDoc });
            console.log(`   ✅ [Auto-Enriched] "${pad.title}" (${pad.source}) -> Phone: ${detail.phone}`);
          }
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    } catch (enrichErr) {
      console.log(`[Auto-Enrichment Note] ${enrichErr.message}`);
    }
  } catch (error) {
    console.error(`[Scraper Cycle Error] ${error.message}`);
  }
};

const { cleanupOldListings } = require('./controllers/listingController');

// One-time cleanup: migrate previous test Facebook ads to FacebookBaseline and clear them from website feed
const purgeTestFacebookListings = async () => {
  try {
    const existingFbListings = await Listing.find({ source: 'facebook.com' });
    if (existingFbListings.length > 0) {
      console.log(`🧹 [Facebook Clean] Found ${existingFbListings.length} previous Facebook ads in database.`);
      const baselineDocs = existingFbListings
        .map(l => ({ itemId: (l.sourceUrl ? (l.sourceUrl.match(/item\/(\d+)/) || [])[1] : null) }))
        .filter(d => Boolean(d.itemId));

      if (baselineDocs.length > 0) {
        await FacebookBaseline.insertMany(baselineDocs, { ordered: false }).catch(() => {});
      }
      await Listing.deleteMany({ source: 'facebook.com' });
      console.log(`✅ [Facebook Clean] Successfully cleared previous Facebook ads from website feed. Only fresh ads will appear from now on.`);
    }
  } catch (err) {
    console.log(`[Facebook Clean Note] ${err.message}`);
  }
};

const PORT = process.env.PORT || 5000;

// Connect Database & Launch Server if executed directly
if (require.main === module) {
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 [Server Ready] Running on http://localhost:${PORT}`);
      
      // Initial cleanup & scrape 3 seconds after server startup
      setTimeout(async () => {
        await cleanupOldListings();
        await purgeTestFacebookListings();
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
}

module.exports = { app, fetchSellerDetails, extractPhoneFromText, findChromePath, runScrapeCycle };
