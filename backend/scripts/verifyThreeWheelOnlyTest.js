const { extractPhoneFromText, findChromePath, parseFacebookPostedTime } = require('../services/detailService');

const INVALID_VEHICLES = [
  'apache', 'pulsar', 'palser', 'pulser', 'polser', 'plsr', 'xcd', 'discover', 'discorver', 'discove',
  'platina', 'plateno', 'platino', 'ct100', 'ct 100', 'ct-100', 'boxer', 'fz', 'fzs', 'fz-s', 'dio',
  'wego', 'hornet', 'gn125', 'gn 125', 'gn-125', 'twister', 'ray z', 'ray-z', 'rayzr',
  'pleasure', 'scooty', 'vespa', 'benly', 'bike', 'bikes', 'scooter', 'scooters',
  'motorcycle', 'motor cycle', 'motorbike', 'motor bike', 'yb100', 'yb 100', 'splendor',
  'dash', 'v15', 'honda', 'yamaha', 'hero', 'suzuki', 'kawasaki', 'royal enfield',
  'gixxer', 'passion', 'glamour', 'cb400', 'cbr', 'duke', 'ns200', 'ns 200', 'ns160', 'ns 160',
  'xr125', 'xr250', 'dtracker', 'd-tracker', 'volty', 'grasstracker',
  'kwid', 'dimo', 'lokka', 'renault', 'tata', 'tercel', 'corolla', 'civic',
  'sunny', 'n16', 'alto', 'wagon', 'every', 'vezel', 'swift', 'tiida', 'dolphin', 'maruti',
  'prius', 'crv', 'raize', 'lancer', 'march', 'car', 'van', 'lorry', 'truck', 'bmw', 'audi',
  'benz', 'mercedes', 'ford', 'mitsubishi', 'isuzu', 'mazda', 'kia', 'hyundai', 'perodua',
  'proton', 'mg', 'chery', 'dfsk', 'micro', 'land rover', 'jeep', 'suv', 'sedan', 'hatchback',
  'nissan', 'crew cab', 'double cab', 'single cab', 'cab', 'pickup', 'pick up', 'navara', 'hilux',
  'l200', 'bongo', 'canter', 'townace', 'liteace', 'hiace', 'carina', 'bluebird', 'vitz', 'celerio',
  'box 5fwd', '5fwd', 'lancer box', 'box lancer', 'ke70', 'ke72', 'ke74', 'dx', 'ek3', 'eg8', 'fb14', 'fb15', 'b11', '121', '141',
  'car sales', 'car sale', 'motor car', 'motor bike',
];

const VALID_THREEWHEEL_REGEX = /\b(three[\s-]*wheelers?|3[\s-]*wheelers?|three[\s-]*wheel|3[\s-]*wheel|three-wheel|3-wheel|tuk[\s-]*tuk|tuktuk|tuk\b|triwheel|auto[\s-]*rickshaw|bajaj[\s-]*re|tvs[\s-]*king|piaggio|ape\b|re\s*205|re205|bajaj\s*205|qute|compact|maxima|alfa|atul|(?:20[0-9]|aa[a-z]|ab[a-z]|ac[a-z])\s*-?\s*\d{4})\b/i;

function testFilter(rawTitle, fullText, ariaLabel) {
  const testContent = `${rawTitle} ${ariaLabel} ${fullText}`.toLowerCase();
  
  // 1. Invalid vehicles
  const hasInvalid = INVALID_VEHICLES.some(k => testContent.includes(k));
  if (hasInvalid) return { passed: false, reason: 'Matched INVALID_VEHICLES keyword' };

  // 2. Exchange offers
  const isExchangeAd = /\b(exchange|maru|maru\s*karanawa|maru\s*ok|change)\b/i.test(testContent) &&
    /\b(bike|motorcycle|scooter|pulsar|dio|car|lancer|alto|wagon|van|lorry)\b/i.test(testContent);
  if (isExchangeAd) return { passed: false, reason: 'Exchange offer from bike/car' };

  // 3. Must have title
  if (!rawTitle || rawTitle.trim().length < 3) return { passed: false, reason: 'Empty or unreadable title' };

  // 4. Positive three-wheel regex
  const isPositiveThreeWheel = VALID_THREEWHEEL_REGEX.test(rawTitle) || VALID_THREEWHEEL_REGEX.test(ariaLabel);
  if (!isPositiveThreeWheel) return { passed: false, reason: 'Not matching VALID_THREEWHEEL_REGEX' };

  return { passed: true, reason: 'Valid 3-Wheeler' };
}

console.log('======================================================');
console.log('🧪 TESTING STRICT THREE-WHEELER FILTER RULES');
console.log('======================================================\n');

const testCases = [
  {
    title: 'LANCER BOX 5FWD 0728034306',
    fullText: 'MITSUBISHI LANCER BOX 5 FORWARD, Southernlanka Car Sales',
    ariaLabel: 'LANCER BOX 5FWD 0728034306, LKR860,000, Kamburugamuwa',
    expectedPass: false,
    label: 'Mitsubishi Lancer Car (from user screenshot)'
  },
  {
    title: '',
    fullText: 'Car for sale LKR 860,000',
    ariaLabel: 'LKR860,000, Kamburugamuwa',
    expectedPass: false,
    label: 'Empty Title (previously became "Bajaj Three Wheel")'
  },
  {
    title: 'Yamaha DT 125 2 stroke bike for sale',
    fullText: 'Good running condition 2 stroke bike',
    ariaLabel: 'Yamaha DT 125 2 stroke bike, LKR 350,000',
    expectedPass: false,
    label: '2-Stroke Motorcycle (Bikes)'
  },
  {
    title: 'Pulsar 150 bike exchange for three wheel',
    fullText: 'Pulsar 150 bike exchange for three wheel or cash',
    ariaLabel: 'Pulsar 150 bike exchange for three wheel, LKR 280,000',
    expectedPass: false,
    label: 'Exchange ad mentioning three-wheel'
  },
  {
    title: 'Bajaj RE 205 2018 Three Wheel',
    fullText: 'Original paint, 1st owner, clean documents',
    ariaLabel: 'Bajaj RE 205 2018 Three Wheel, LKR 1,590,000, Gampaha',
    expectedPass: true,
    label: 'Genuine Bajaj RE 205 3-Wheeler'
  },
  {
    title: 'TVS King 4 Stroke 3 Wheel',
    fullText: 'Excellent condition TVS King',
    ariaLabel: 'TVS King 4 Stroke 3 Wheel, LKR 1,450,000, Kandy',
    expectedPass: true,
    label: 'Genuine TVS King 3-Wheeler'
  },
  {
    title: '204-2732 Three Wheel for sale',
    fullText: '5 port engine, original book, 204-2732',
    ariaLabel: '204-2732 Three Wheel for sale, LKR 475,000, Korathota',
    expectedPass: true,
    label: 'Genuine Sri Lankan 204-xxxx 3-Wheeler (from user screenshot 1)'
  }
];

let allPassed = true;
for (const tc of testCases) {
  const result = testFilter(tc.title, tc.fullText, tc.ariaLabel);
  const ok = result.passed === tc.expectedPass;
  if (!ok) allPassed = false;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}: [${tc.label}]`);
  console.log(`   Title:    "${tc.title}"`);
  console.log(`   Outcome:  ${result.passed ? 'ACCEPTED' : 'REJECTED'} (Reason: ${result.reason})`);
  console.log(`   Expected: ${tc.expectedPass ? 'ACCEPTED' : 'REJECTED'}\n`);
}

if (allPassed) {
  console.log('🎉 ALL 7 TEST CASES PASSED WITH 100% ACCURACY!');
} else {
  console.error('❌ SOME TESTS FAILED!');
}
