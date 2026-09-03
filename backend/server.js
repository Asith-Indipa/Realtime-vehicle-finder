require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const connectDB = require('./config/db');
const Listing = require('./models/Listing');
const { scrapeIkman } = require('./services/ikmanScraper');
const { scrapeRiyasevana } = require('./services/riyasevanaScraper');
const { backupImages } = require('./services/imageService');
const { sendWhatsAppAlert } = require('./services/whatsappService');
const listingRoutes = require('./routes/listingRoutes');

const app = express();
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/listings', listingRoutes);

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
      // Check if ad exists in DB
      const existing = await Listing.findOne({ sourceUrl: ad.sourceUrl });
      if (!existing) {
        // Auto-backup images to Cloudinary (if configured in .env)
        const cloudImages = await backupImages(ad.originalImages);

        // Save new listing to database
        const newListing = await Listing.create({
          ...ad,
          cloudinaryImages: cloudImages,
        });

        newItemsCount++;
        console.log(`✨ [NEW DEAL DETECTED] [${ad.source}] ${ad.title} (${ad.price})`);

        // Trigger instant WhatsApp alert
        const sent = await sendWhatsAppAlert(newListing);
        if (sent) {
          newListing.notifiedWhatsApp = true;
          await newListing.save();
        }
      } else {
        // Update the timestamp so sorting/filtering stays accurate
        await Listing.updateOne(
          { sourceUrl: ad.sourceUrl },
          { $set: { postedTimestamp: ad.postedTimestamp, postedTimeText: ad.postedTimeText } }
        );
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
