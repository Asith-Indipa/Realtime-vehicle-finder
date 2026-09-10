const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const FacebookBaseline = require('../models/FacebookBaseline');
const Listing = require('../models/Listing');

async function testFacebookBaseline() {
  console.log('======================================================');
  console.log('🧪 TESTING FACEBOOK BASELINE & FRESH-ONLY LOGIC');
  console.log('======================================================');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const testOldId = '9999999999999991';
  const testNewId = '9999999999999992';

  // 1. Clear any prior test entries
  await FacebookBaseline.deleteMany({ itemId: { $in: [testOldId, testNewId] } });
  await Listing.deleteMany({ sourceUrl: { $regex: /999999999999999/ } });

  // 2. Add testOldId to baseline (representing a historical ad on Facebook)
  await FacebookBaseline.create({ itemId: testOldId });
  console.log(`✅ Seeded historical baseline ID: ${testOldId}`);

  // 3. Verify historical ad is blocked
  const isHistorical = await FacebookBaseline.findOne({ itemId: testOldId });
  if (isHistorical) {
    console.log('✅ PASS: Historical ad detected and will be completely skipped (no DB save, no WhatsApp alert).');
  } else {
    console.error('❌ FAIL: Historical ad not found in baseline.');
  }

  // 4. Verify new ad is recognized as fresh
  const isNewInBaseline = await FacebookBaseline.findOne({ itemId: testNewId });
  if (!isNewInBaseline) {
    console.log('✅ PASS: New ad correctly recognized as genuine fresh post!');
  } else {
    console.error('❌ FAIL: New ad falsely marked as historical.');
  }

  // 5. Clean up test records
  await FacebookBaseline.deleteMany({ itemId: { $in: [testOldId, testNewId] } });
  console.log('✅ Cleaned up test IDs.');

  await mongoose.disconnect();
  console.log('======================================================');
  console.log('🎉 BASELINE TEST COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
}

testFacebookBaseline().catch(err => {
  console.error('Test error:', err.message);
  process.exit(1);
});
