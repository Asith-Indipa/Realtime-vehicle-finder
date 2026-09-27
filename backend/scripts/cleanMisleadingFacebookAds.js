const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const FacebookBaseline = require('../models/FacebookBaseline');

async function cleanMisleadingAds() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Find all historical Facebook ads currently in the DB
    const allFbAds = await Listing.find({ source: 'facebook.com' });

    console.log(`Found ${allFbAds.length} historical Facebook ads in DB.`);
    for (const ad of allFbAds) {
      console.log(`- Moving to baseline & deleting: "${ad.title}" (${ad.price})`);
      const match = ad.sourceUrl ? ad.sourceUrl.match(/item\/(\d+)/) : null;
      const itemId = ad.itemId || (match ? match[1] : null);
      if (itemId) {
        await FacebookBaseline.create({ itemId }).catch(() => {});
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
