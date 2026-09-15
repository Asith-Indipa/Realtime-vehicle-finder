const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const FacebookBaseline = require('../models/FacebookBaseline');

async function cleanMisleadingAds() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Find Facebook ads saved today (last 24 hours) where the ad on FB was actually old or had fake timestamps
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFbAds = await Listing.find({
      source: 'facebook.com',
      createdAt: { $gte: cutoff }
    });

    console.log(`Found ${recentFbAds.length} Facebook ads created in DB today.`);
    for (const ad of recentFbAds) {
      console.log(`- Deleting misleading ad: "${ad.title}" (${ad.price}) | URL: ${ad.sourceUrl}`);
      // Register into baseline so it stays ignored
      const match = ad.sourceUrl ? ad.sourceUrl.match(/item\/(\d+)/) : null;
      if (match && match[1]) {
        await FacebookBaseline.create({ itemId: match[1] }).catch(() => {});
      }
      await Listing.findByIdAndDelete(ad._id);
    }

    console.log('Cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
  }
}

cleanMisleadingAds();
