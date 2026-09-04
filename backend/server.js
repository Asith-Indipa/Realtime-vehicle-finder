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

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/listings', listingRoutes);

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

app.post('/api/whatsapp/logout', async (req, res) => {
  logoutWhatsAppBot();
  res.json({ success: true, message: 'WhatsApp Bot logging out...' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

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
      // Step 1: Check if this exact URL already exists
      const existingByUrl = await Listing.findOne({ sourceUrl: ad.sourceUrl });
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
          // Same URL - just update timestamp
          await Listing.updateOne(
            { sourceUrl: ad.sourceUrl },
            { $set: { postedTimestamp: ad.postedTimestamp, postedTimeText: ad.postedTimeText, title: ad.title } }
          );
        }
        continue;
      }

      // Step 2: Smart duplicate detection - same vehicle, different URL
      // Check by: (A) Same image URL, OR (B) Same price + location + source
      const adImageUrl = (ad.originalImages && ad.originalImages.length > 0) ? ad.originalImages[0] : null;
      let duplicateEntry = null;

      // (A) Match by image URL
      if (adImageUrl && adImageUrl.length > 10) {
        duplicateEntry = await Listing.findOne({
          source: ad.source,
          originalImages: adImageUrl,
        });
      }

      // (B) Match by price + location (if image didn't match)
      if (!duplicateEntry && ad.priceNumeric > 0) {
        duplicateEntry = await Listing.findOne({
          source: ad.source,
          priceNumeric: ad.priceNumeric,
          location: ad.location,
        });
      }

      if (duplicateEntry) {
        // Same vehicle reposted with new URL - replace old with newest version
        console.log(`🔄 [DUPLICATE REPLACED] "${duplicateEntry.title}" → "${ad.title}"`);
        await Listing.deleteOne({ _id: duplicateEntry._id });
      }

      // Save new listing to database
      const cloudImages = await backupImages(ad.originalImages);
      const newListing = await Listing.create({
        ...ad,
        cloudinaryImages: cloudImages,
      });

      newItemsCount++;
      if (!duplicateEntry) {
        console.log(`✨ [NEW DEAL DETECTED] [${ad.source}] ${ad.title} (${ad.price})`);

        // Trigger instant WhatsApp alert
        const sent = await sendWhatsAppAlert(newListing);
        if (sent) {
          newListing.notifiedWhatsApp = true;
          await newListing.save();
        }
      }
    }

    console.log(`[Scraper Cycle Finished] Found ${newItemsCount} new 3-Wheel deal(s).\n`);
  } catch (error) {
    console.error(`[Scraper Cycle Error] ${error.message}`);
  }
};

const PORT = process.env.PORT || 5000;

// Connect Database & Launch Server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 [Server Ready] Running on http://localhost:${PORT}`);
    
    // Initial scrape 3 seconds after server startup
    setTimeout(runScrapeCycle, 3000);

    // Schedule automatic scraping cycle every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      runScrapeCycle();
    });
    console.log('⏰ [Scheduler] Cron job registered: Running every 5 minutes.');
  });
});
