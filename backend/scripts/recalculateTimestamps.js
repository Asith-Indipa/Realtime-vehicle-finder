const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Listing = require('../models/Listing');

const parseTimeTextToTimestamp = (timeStr, createdAt) => {
  const baseTime = createdAt ? new Date(createdAt) : new Date();
  if (!timeStr) return baseTime;
  const lower = timeStr.toLowerCase().trim();

  if (lower.includes('just now') || lower.includes('now')) {
    return baseTime;
  }

  const minMatch = lower.match(/(\d+)\s*(m|min|minute)/);
  if (minMatch) {
    return new Date(baseTime.getTime() - parseInt(minMatch[1], 10) * 60 * 1000);
  }

  const hrMatch = lower.match(/(\d+)\s*(h|hr|hour)/);
  if (hrMatch) {
    return new Date(baseTime.getTime() - parseInt(hrMatch[1], 10) * 60 * 60 * 1000);
  }

  const dayMatch = lower.match(/(\d+)\s*day/);
  if (dayMatch) {
    return new Date(baseTime.getTime() - parseInt(dayMatch[1], 10) * 24 * 60 * 60 * 1000);
  }

  if (lower.includes('yesterday')) {
    return new Date(baseTime.getTime() - 24 * 60 * 60 * 1000);
  }

  return baseTime;
};

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/three_wheel_app';
    await mongoose.connect(mongoUri);
    console.log('[Fix] Connected to MongoDB.');

    const listings = await Listing.find({});
    console.log(`[Fix] Normalizing timestamps for ${listings.length} listings...`);

    let updatedCount = 0;
    for (const item of listings) {
      const newTimestamp = parseTimeTextToTimestamp(item.postedTimeText, item.createdAt);
      item.postedTimestamp = newTimestamp;
      await item.save();
      updatedCount++;
    }

    console.log(`[Fix] Successfully normalized ${updatedCount} timestamps!`);
    process.exit(0);
  } catch (err) {
    console.error('[Fix Error]', err);
    process.exit(1);
  }
};

run();
