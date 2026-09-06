require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const puppeteer = require('puppeteer-core');
const Listing = require('../models/Listing');
const { fetchSellerDetails, findChromePath } = require('../services/detailService');

async function enrichMissingPhones() {
  console.log('======================================================');
  console.log('Starting Phone Number Enrichment Process...');
  console.log('======================================================');

  if (!process.env.MONGO_URI) {
    console.error('Error: MONGO_URI not found in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  let retries = 5;
  while (retries > 0) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
      console.log('Connected to MongoDB Atlas.\n');
      break;
    } catch (err) {
      retries--;
      console.log(`[DB Retry] Atlas connection failed (${err.message}). Retrying in 3s... (${retries} retries left)`);
      if (retries === 0) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Parse optional limit from command line args: e.g. --limit=30
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 50;

  // Target listings with phone missing or 'N/A', sorted newest first
  const missingAds = await Listing.find({
    $or: [
      { phone: 'N/A' },
      { phone: null },
      { phone: '' },
      { phone: { $exists: false } }
    ]
  })
    .sort({ postedTimestamp: -1 })
    .limit(limit)
    .lean();

  console.log(`Found ${missingAds.length} candidate listings with missing contact numbers (Limit: ${limit}).`);
  if (missingAds.length === 0) {
    console.log('All listings already have contact numbers! Nothing to enrich.\n');
    await mongoose.disconnect();
    return;
  }

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error('Error: Chrome executable not found.');
    await mongoose.disconnect();
    return;
  }

  console.log('Launching browser worker for fast, parallel extraction...');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  let enrichedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < missingAds.length; i++) {
    const ad = missingAds[i];
    console.log(`[${i + 1}/${missingAds.length}] Checking: "${ad.title}" (${ad.source})`);

    try {
      const details = await fetchSellerDetails(ad.sourceUrl, ad.source, browser);

      if (details.phone && details.phone !== 'N/A') {
        const updateFields = { phone: details.phone };

        // Also enrich location if we now have specific "City, District"
        if (
          details.location &&
          details.location !== 'Sri Lanka' &&
          details.location.includes(',') &&
          (!ad.location || !ad.location.includes(','))
        ) {
          updateFields.location = details.location;
        }

        // Quiet update: preserves original timestamps & does NOT trigger repeat alerts
        await Listing.updateOne(
          { _id: ad._id },
          { $set: updateFields }
        );

        enrichedCount++;
        console.log(`   ✅ Extracted Phone: ${details.phone} | Location: ${updateFields.location || ad.location}`);
      } else {
        skippedCount++;
        console.log(`   ⚠️ No phone visible on detail page.`);
      }
    } catch (err) {
      skippedCount++;
      console.log(`   ❌ Error fetching details: ${err.message}`);
    }

    // Polite pause between requests to prevent anti-bot rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  await browser.close().catch(() => {});

  console.log('\n======================================================');
  console.log(`Enrichment Complete!`);
  console.log(`Successfully Enriched: ${enrichedCount} listings`);
  console.log(`Skipped / Unavailable: ${skippedCount} listings`);
  console.log('======================================================\n');

  await mongoose.disconnect();
}

if (require.main === module) {
  enrichMissingPhones().catch(err => {
    console.error('Fatal enrichment error:', err);
    process.exit(1);
  });
}

module.exports = { enrichMissingPhones };
