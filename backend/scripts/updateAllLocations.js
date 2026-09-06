require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const cheerio = require('cheerio');
const Listing = require('../models/Listing');
const {
  extractIkmanLocation,
  extractRiyasevanaLocation,
  normalizeLocation
} = require('../utils/locationHelper');

async function updateLocations() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB.\n');

  // Step 1: Update Riyasevana listings via URL slug
  console.log('--- Step 1: Bulk Updating Riyasevana listings ---');
  const riyasevanaAds = await Listing.find({ source: 'riyasevana.com' }).lean();
  const riyaOps = [];

  for (const ad of riyasevanaAds) {
    const extracted = extractRiyasevanaLocation(ad.sourceUrl);
    if (extracted && extracted !== ad.location) {
      riyaOps.push({
        updateOne: {
          filter: { _id: ad._id },
          update: { $set: { location: extracted } }
        }
      });
    } else if (ad.location) {
      const norm = normalizeLocation(ad.location);
      if (norm !== ad.location) {
        riyaOps.push({
          updateOne: {
            filter: { _id: ad._id },
            update: { $set: { location: norm } }
          }
        });
      }
    }
  }

  if (riyaOps.length > 0) {
    await Listing.bulkWrite(riyaOps);
    console.log(`Bulk updated ${riyaOps.length} / ${riyasevanaAds.length} Riyasevana listings.\n`);
  } else {
    console.log('All Riyasevana listings already up-to-date.\n');
  }

  // Step 2: Normalize all Ikman locations (clean 'Three Wheelers', 'Rs ...')
  console.log('--- Step 2: Normalizing Ikman listings ---');
  const ikmanAds = await Listing.find({ source: 'ikman.lk' }).lean();
  const ikmanOps = [];

  for (const ad of ikmanAds) {
    const norm = normalizeLocation(ad.location);
    if (norm !== ad.location) {
      ikmanOps.push({
        updateOne: {
          filter: { _id: ad._id },
          update: { $set: { location: norm } }
        }
      });
    }
  }

  if (ikmanOps.length > 0) {
    await Listing.bulkWrite(ikmanOps);
    console.log(`Bulk normalized ${ikmanOps.length} Ikman listing location strings.\n`);
  } else {
    console.log('All Ikman listings already normalized.\n');
  }

  // Step 3: Fetch exact City + District from detail pages for all Ikman listings
  console.log('--- Step 3: Fetching exact City + District for all Ikman listings ---');
  // Target ads without a city (no comma in location) or with 'Sri Lanka'
  const ikmanNeedDetails = await Listing.find({
    source: 'ikman.lk',
    $or: [
      { location: { $not: /,/ } },
      { location: 'Sri Lanka' }
    ]
  }).sort({ postedTimestamp: -1 }).lean();

  console.log(`Found ${ikmanNeedDetails.length} recent Ikman ads to enrich with exact City & District.`);

  const detailOps = [];
  const BATCH_SIZE = 8;

  for (let i = 0; i < ikmanNeedDetails.length; i += BATCH_SIZE) {
    const batch = ikmanNeedDetails.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (ad) => {
      try {
        const res = await axios.get(ad.sourceUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
          timeout: 6000,
        });
        const $ = cheerio.load(res.data);
        const subText = $('[class*="subtitle--"], [class*="sub-title--"]').first().text().trim();
        const exactLoc = extractIkmanLocation(subText);
        if (exactLoc && exactLoc !== ad.location) {
          console.log(`📍 [Enriched] "${ad.title}" : "${ad.location}" -> "${exactLoc}"`);
          detailOps.push({
            updateOne: {
              filter: { _id: ad._id },
              update: { $set: { location: exactLoc } }
            }
          });
        }
      } catch (err) {
        // detail page blocked or removed, skip
      }
    }));
  }

  if (detailOps.length > 0) {
    await Listing.bulkWrite(detailOps);
    console.log(`\nSuccessfully bulk updated ${detailOps.length} Ikman ads with exact City + District!`);
  }

  // Summary
  const withCity = await Listing.countDocuments({ location: /,/ });
  const total = await Listing.countDocuments();
  console.log(`\n==============================================`);
  console.log(`Migration Complete! Total listings: ${total}`);
  console.log(`Listings with exact "City, District": ${withCity} (${Math.round((withCity / total) * 100)}%)`);
  console.log(`Listings with clean "District": ${total - withCity}`);
  console.log(`==============================================\n`);

  await mongoose.disconnect();
}

updateLocations().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
