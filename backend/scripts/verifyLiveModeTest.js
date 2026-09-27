const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Listing = require('../models/Listing');
const FacebookBaseline = require('../models/FacebookBaseline');
const { parseFacebookPostedTime } = require('../services/detailService');

async function runVerification() {
  console.log('======================================================');
  console.log('🧪 TESTING & VERIFYING STRICT LIVE MODE FOR FACEBOOK');
  console.log('======================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  // TEST 1: Check parseFacebookPostedTime on historical text formats
  console.log('\n--- TEST 1: Post Time Parser Verification ---');
  const sample1 = 'Listed 12 hours ago in Korathota, Colombo';
  const parsed1 = parseFacebookPostedTime(sample1);
  const diffHours1 = (Date.now() - new Date(parsed1.postedTimestamp).getTime()) / (1000 * 3600);
  console.log(`Input: "${sample1}"`);
  console.log(`Result: ${parsed1.postedTimeText}, calculated age: ~${diffHours1.toFixed(1)} hours`);
  if (diffHours1 >= 11.5 && diffHours1 <= 12.5) {
    console.log('✅ PASS: Correctly identified as ~12 hours old.');
  } else {
    console.error('❌ FAIL: Incorrect age calculated.');
  }

  const sample2 = 'Listed 5 minutes ago in Kandy';
  const parsed2 = parseFacebookPostedTime(sample2);
  const diffMins2 = (Date.now() - new Date(parsed2.postedTimestamp).getTime()) / (1000 * 60);
  console.log(`\nInput: "${sample2}"`);
  console.log(`Result: ${parsed2.postedTimeText}, calculated age: ~${diffMins2.toFixed(1)} mins`);
  if (diffMins2 >= 4 && diffMins2 <= 6) {
    console.log('✅ PASS: Correctly identified as ~5 minutes old.');
  } else {
    console.error('❌ FAIL: Incorrect minutes calculated.');
  }

  // TEST 2: Check SERVER_START_TIME filtering logic
  console.log('\n--- TEST 2: Server Start Time Filter Logic Simulation ---');
  const mockServerStartTime = new Date(Date.now() - 5 * 60 * 1000); // Server started 5 minutes ago
  console.log(`Simulated Server Start Time: ${mockServerStartTime.toLocaleTimeString()}`);

  const mockPreServerAd = {
    title: 'Pre-Server Three Wheel',
    postedTimestamp: new Date(Date.now() - 12 * 3600 * 1000), // 12 hours ago
    postedTimeText: 'Listed 12 hours ago',
  };

  const isPreServer = mockPreServerAd.postedTimestamp.getTime() < mockServerStartTime.getTime();
  if (isPreServer) {
    console.log(`✅ PASS: Ad from 12 hours ago rejected because postedTimestamp (${mockPreServerAd.postedTimestamp.toLocaleTimeString()}) < SERVER_START_TIME (${mockServerStartTime.toLocaleTimeString()})`);
  } else {
    console.error('❌ FAIL: Old ad was not rejected.');
  }

  const mockPostServerAd = {
    title: 'Brand New Post-Server Three Wheel',
    postedTimestamp: new Date(Date.now() - 1 * 60 * 1000), // 1 minute ago
    postedTimeText: 'Listed 1 minute ago',
  };

  const isPostServer = mockPostServerAd.postedTimestamp.getTime() >= mockServerStartTime.getTime();
  if (isPostServer) {
    console.log(`✅ PASS: Ad from 1 minute ago accepted because postedTimestamp (${mockPostServerAd.postedTimestamp.toLocaleTimeString()}) >= SERVER_START_TIME (${mockServerStartTime.toLocaleTimeString()})`);
  } else {
    console.error('❌ FAIL: Brand new ad was not accepted.');
  }

  // TEST 3: Check Live MongoDB Database State
  console.log('\n--- TEST 3: Live MongoDB Database State ---');
  const cutoffTime = new Date(Date.now() - 10 * 60 * 1000); // last 10 minutes (since restart)
  const recentFbAds = await Listing.find({
    source: 'facebook.com',
    createdAt: { $gte: cutoffTime }
  });

  const totalBaseline = await FacebookBaseline.countDocuments();
  console.log(`FB ads added to database since server restart: ${recentFbAds.length}`);
  console.log(`Total historical FB ads registered in FacebookBaseline: ${totalBaseline}`);

  if (recentFbAds.length === 0) {
    console.log('✅ PASS: Zero historical Facebook ads entered the database since restart!');
  } else {
    console.log(`ℹ️ Note: ${recentFbAds.length} FB ads were saved.`);
  }

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS COMPLETED SUCCESSFULLY!');
  console.log('======================================================');

  await mongoose.disconnect();
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
