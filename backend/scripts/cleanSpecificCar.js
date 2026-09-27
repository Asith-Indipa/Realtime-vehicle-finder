const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Listing = require('../models/Listing');
const FacebookBaseline = require('../models/FacebookBaseline');

async function cleanCar() {
  await mongoose.connect(process.env.MONGO_URI);
  const deleted = await Listing.deleteMany({
    source: 'facebook.com',
    sourceUrl: { $regex: /1432066745690555/ }
  });
  console.log('Deleted Lancer Car ad from DB:', deleted.deletedCount);
  await FacebookBaseline.create({ itemId: '1432066745690555' }).catch(() => {});

  // Also clean any FB ads that don't match three-wheeler patterns
  const fbAds = await Listing.find({ source: 'facebook.com' });
  const VALID_REGEX = /\b(three[\s-]*wheelers?|3[\s-]*wheelers?|three[\s-]*wheel|3[\s-]*wheel|three-wheel|3-wheel|tuk[\s-]*tuk|tuktuk|tuk\b|triwheel|auto[\s-]*rickshaw|bajaj[\s-]*re|tvs[\s-]*king|piaggio|ape\b|re\s*205|re205|bajaj\s*205|qute|compact|maxima|(?:20[0-9]|aa[a-z]|ab[a-z]|ac[a-z])\s*-?\s*\d{4})\b/i;

  for (const ad of fbAds) {
    if (!VALID_REGEX.test(ad.title)) {
      console.log(`Deleting non-matching ad: "${ad.title}"`);
      await Listing.findByIdAndDelete(ad._id);
    }
  }

  console.log('Remaining Facebook ads in DB:', await Listing.countDocuments({ source: 'facebook.com' }));
  await mongoose.disconnect();
}

cleanCar().catch(err => console.error(err));
