const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Listing = require('../models/Listing');

async function seedTestFacebookAd() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const testFbAd = {
    title: 'Bajaj RE 4 Stroke Three Wheel 2018',
    price: 'Rs 1,450,000',
    priceNumeric: 1450000,
    location: 'Colombo',
    year: '2018',
    phone: '0771234567',
    source: 'facebook.com',
    sourceUrl: 'https://www.facebook.com/marketplace/item/1183219389712345/',
    originalImages: [
      'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80'
    ],
    cloudinaryImages: [],
    postedTimeText: 'Recently posted',
    postedTimestamp: new Date(),
  };

  const existing = await Listing.findOne({ sourceUrl: testFbAd.sourceUrl });
  if (!existing) {
    const created = await Listing.create(testFbAd);
    console.log('Created test Facebook listing:', created._id, created.title);
  } else {
    console.log('Test Facebook listing already exists:', existing._id);
  }

  await mongoose.disconnect();
}

seedTestFacebookAd();
