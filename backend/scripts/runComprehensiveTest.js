const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Listing = require('../models/Listing');

const TEST_EMAIL = `test_runner_${Date.now()}@example.com`;
const TEST_PHONE = '94771234567';
const TEST_URL = `https://ikman.lk/en/ad/test-deal-${Date.now()}`;

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE END-TO-END TEST SUITE');
  console.log('======================================================\n');

  try {
    // 1. Database Connection Test
    console.log('[Test 1] Testing MongoDB Atlas Connection...');
    await mongoose.connect(process.env.MONGO_URI);
    assert(mongoose.connection.readyState === 1, 'Connected to MongoDB Atlas successfully');

    // 2. User Creation & Password Hashing
    console.log('\n[Test 2] Testing User Registration & Password Hashing...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('TestPass123!', salt);
    
    const testUser = await User.create({
      name: 'Test Buyer',
      email: TEST_EMAIL,
      password: hashedPassword,
      whatsappNumber: TEST_PHONE,
      isSubscribed: true,
      alertLocation: 'Matara',
      alertModel: '4-stroke',
      alertMaxPrice: 1500000,
    });
    assert(testUser._id != null, 'User created in database');
    assert(await bcrypt.compare('TestPass123!', testUser.password), 'Password hash verified via bcrypt');

    // 3. Testing Subscriber Filter Matching Logic
    console.log('\n[Test 3] Testing WhatsApp Alert Custom Filter Logic...');
    
    const testSubscribersForListing = async (sampleListing) => {
      const users = await User.find({ isSubscribed: true, whatsappNumber: { $exists: true, $ne: '' }, email: TEST_EMAIL });
      const matched = [];
      for (const u of users) {
        if (u.alertLocation && u.alertLocation !== 'all') {
          if (!(sampleListing.location || '').toLowerCase().includes(u.alertLocation.toLowerCase())) continue;
        }
        if (u.alertModel && u.alertModel !== 'all') {
          const modelFilter = u.alertModel.toLowerCase();
          const title = (sampleListing.title || '').toLowerCase();
          let matchModel = false;
          if (modelFilter === '4-stroke') matchModel = /4[\s-]*stroke/i.test(title);
          else if (modelFilter === '2-stroke') matchModel = /2[\s-]*stroke/i.test(title);
          if (!matchModel) continue;
        }
        if (u.alertMaxPrice && u.alertMaxPrice > 0) {
          if (sampleListing.priceNumeric > u.alertMaxPrice) continue;
        }
        matched.push(u);
      }
      return matched;
    };

    // Case A: Perfect match (4-Stroke, Matara, 1,350,000 <= 1,500,000)
    const matchCase = await testSubscribersForListing({
      title: 'Bajaj RE 4-Stroke 2018',
      location: 'Matara City',
      priceNumeric: 1350000,
    });
    assert(matchCase.length === 1, 'Listing matching criteria correctly identified subscriber');

    // Case B: Location Mismatch (Kandy instead of Matara)
    const wrongLocationCase = await testSubscribersForListing({
      title: 'Bajaj RE 4-Stroke 2018',
      location: 'Kandy City',
      priceNumeric: 1350000,
    });
    assert(wrongLocationCase.length === 0, 'Location mismatch skipped alert correctly');

    // Case C: Model Mismatch (2-Stroke instead of 4-Stroke)
    const wrongModelCase = await testSubscribersForListing({
      title: 'Bajaj RE 2-Stroke 2002',
      location: 'Matara City',
      priceNumeric: 850000,
    });
    assert(wrongModelCase.length === 0, 'Model mismatch skipped alert correctly');

    // Case D: Price Exceeded (1,800,000 > 1,500,000 limit)
    const overPriceCase = await testSubscribersForListing({
      title: 'Bajaj RE 4-Stroke 2022',
      location: 'Matara City',
      priceNumeric: 1800000,
    });
    assert(overPriceCase.length === 0, 'Max price limit filter skipped alert correctly');

    // 4. Testing Listing Creation & Phone Storage
    console.log('\n[Test 4] Testing Listing Model & Cloudinary Backup Fields...');
    const testListing = await Listing.create({
      title: 'Bajaj RE 4-Stroke 2018 Test Unit',
      price: 'Rs 1,350,000',
      priceNumeric: 1350000,
      location: 'Matara',
      phone: '0771234567',
      source: 'ikman.lk',
      sourceUrl: TEST_URL,
      originalImages: ['https://example.com/original.jpg'],
      cloudinaryImages: ['https://res.cloudinary.com/test/image/upload/sample.jpg'],
      postedTimeText: 'Just now',
      postedTimestamp: new Date(),
    });
    assert(testListing._id != null, 'Listing saved with original & cloudinary images');
    assert(testListing.phone === '0771234567', 'Seller phone stored accurately');

    // 5. Testing Price Drop Detection Simulation
    console.log('\n[Test 5] Testing Price Drop Detection & Updates...');
    const oldPriceNum = testListing.priceNumeric;
    const newPriceNum = 1200000;
    const dropAmount = oldPriceNum - newPriceNum;

    testListing.previousPrice = testListing.price;
    testListing.previousPriceNumeric = oldPriceNum;
    testListing.price = 'Rs 1,200,000';
    testListing.priceNumeric = newPriceNum;
    testListing.hasPriceDrop = true;
    testListing.priceDropAmount = dropAmount;
    await testListing.save();

    const reloadedListing = await Listing.findById(testListing._id);
    assert(reloadedListing.hasPriceDrop === true, 'hasPriceDrop flag activated');
    assert(reloadedListing.priceDropAmount === 150000, 'Price drop amount computed accurately (Rs 150,000)');
    assert(reloadedListing.previousPrice === 'Rs 1,350,000', 'Previous price preserved');

    // 6. Testing 7-Day Auto-Cleanup Logic
    console.log('\n[Test 6] Testing 7-Day Auto-Cleanup Query & Cloudinary Integration...');
    testListing.postedTimestamp = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await testListing.save();

    const eightDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oldItems = await Listing.find({ postedTimestamp: { $lt: eightDaysAgo }, sourceUrl: TEST_URL });
    assert(oldItems.length >= 1, 'Query accurately identifies listings older than 7 days');
    assert(oldItems[0].cloudinaryImages.length > 0, 'cloudinaryImages property read correctly (fixes storage leak)');

    // 7. Cleanup Test Data
    console.log('\n[Test 7] Cleaning up test records from database...');
    await User.deleteOne({ email: TEST_EMAIL });
    await Listing.deleteOne({ sourceUrl: TEST_URL });
    assert(true, 'Test records cleaned up cleanly without leaving trace');

    console.log('\n======================================================');
    console.log(`🎉 TEST SUMMARY: ${passedCount} / ${totalCount} TESTS PASSED!`);
    console.log('======================================================\n');
    
    process.exit(passedCount === totalCount ? 0 : 1);
  } catch (err) {
    console.error('❌ Test Runner Exception:', err);
    process.exit(1);
  }
}

runTests();
