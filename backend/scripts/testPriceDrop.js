const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const Listing = require('../models/Listing');

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/three_wheel_app';
    await mongoose.connect(mongoUri);
    console.log('[Test] Connected to MongoDB.');

    // Pick one existing listing with price > 1,000,000
    const targetListing = await Listing.findOne({ priceNumeric: { $gte: 1000000 } });
    if (!targetListing) {
      console.log('[Test] No suitable listing found to simulate price drop.');
      process.exit(0);
    }

    const oldPriceNum = targetListing.priceNumeric;
    const oldPriceStr = targetListing.price;
    const newPriceNum = oldPriceNum - 150000;
    const newPriceStr = `Rs. ${newPriceNum.toLocaleString()}`;
    const dropAmount = 150000;

    targetListing.previousPrice = oldPriceStr;
    targetListing.previousPriceNumeric = oldPriceNum;
    targetListing.price = newPriceStr;
    targetListing.priceNumeric = newPriceNum;
    targetListing.hasPriceDrop = true;
    targetListing.priceDropAmount = dropAmount;

    await targetListing.save();

    console.log(`\n🎉 [PRICE DROP SIMULATION SUCCESSFUL]`);
    console.log(`📌 Title: "${targetListing.title}"`);
    console.log(`💰 Old Price: ${oldPriceStr} → New Price: ${newPriceStr}`);
    console.log(`📉 Saved Amount: Rs. ${dropAmount.toLocaleString()}`);

    process.exit(0);
  } catch (err) {
    console.error('[Test Error]', err);
    process.exit(1);
  }
};

run();
