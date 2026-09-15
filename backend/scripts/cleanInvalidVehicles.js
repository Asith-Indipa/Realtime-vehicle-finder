const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Listing = require('../models/Listing');

const INVALID_PATTERNS = [
  /palser/i, /pulsar/i, /apache/i, /discover/i, /platina/i, /ct100/i, /ct 100/i, /fz/i,
  /dio/i, /wego/i, /hornet/i, /gn125/i, /gn 125/i, /twister/i, /ray z/i, /pleasure/i,
  /scooty/i, /vespa/i, /benly/i, /bike/i, /scooter/i, /motorcycle/i, /splendor/i,
  /150\s*cc/i, /125\s*cc/i, /160\s*cc/i, /180\s*cc/i, /200\s*cc/i, /220\s*cc/i
];

async function cleanInvalid() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const allListings = await Listing.find({});
    console.log(`Total listings in DB: ${allListings.length}`);

    const toDelete = [];
    for (const item of allListings) {
      const text = `${item.title} ${item.sourceUrl}`.toLowerCase();
      const isInvalid = INVALID_PATTERNS.some(rgx => rgx.test(text));
      if (isInvalid) {
        toDelete.push(item);
      }
    }

    console.log(`Found ${toDelete.length} invalid vehicle listing(s):`);
    for (const item of toDelete) {
      console.log(`- [${item.source}] "${item.title}" | Price: ${item.price} | URL: ${item.sourceUrl}`);
      await Listing.findByIdAndDelete(item._id);
      console.log(`  -> Deleted ID: ${item._id}`);
    }

    console.log('Database cleanup completed successfully.');
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

cleanInvalid();
