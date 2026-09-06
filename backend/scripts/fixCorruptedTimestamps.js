const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const Listing = require('../models/Listing');

async function fixTimestamps() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Fix] Connected to MongoDB Atlas.');

    const listings = await Listing.find({});
    console.log(`[Fix] Total listings in database: ${listings.length}`);

    let fixedCount = 0;
    for (const item of listings) {
      if (!item.createdAt) continue;
      
      const createdMs = new Date(item.createdAt).getTime();
      const postedMs = item.postedTimestamp ? new Date(item.postedTimestamp).getTime() : createdMs;

      // If postedTimestamp was artificially updated to be after createdAt (due to repeated scrape cycle updates)
      if (postedMs > createdMs + 60000) {
        item.postedTimestamp = item.createdAt;
        item.postedTimeText = new Date(item.createdAt).toLocaleDateString();
        await item.save();
        fixedCount++;
      }
    }

    console.log(`✅ [Fix Completed] Successfully restored true original timestamps for ${fixedCount} listings!`);
    
    // Print top 5 ads now
    const topAds = await Listing.find().sort({ postedTimestamp: -1 }).limit(5);
    console.log('\nTop 5 listings after restoration:');
    topAds.forEach((a, i) => {
      console.log(`#${i+1}: ${a.title} | ${a.price} | postedTimestamp: ${a.postedTimestamp} | createdAt: ${a.createdAt}`);
    });

    process.exit(0);
  } catch (err) {
    console.error('Error fixing timestamps:', err);
    process.exit(1);
  }
}

fixTimestamps();
