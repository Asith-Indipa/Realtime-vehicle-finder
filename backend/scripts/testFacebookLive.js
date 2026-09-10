const { scrapeFacebook } = require('../services/facebookScraper');

async function testFacebookLive() {
  console.log('======================================================');
  console.log('Testing Facebook Marketplace 3-Wheel Scraper...');
  console.log('======================================================');

  const startTime = Date.now();
  try {
    const listings = await scrapeFacebook();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nCompleted in ${duration}s. Extracted ${listings.length} deal(s).`);

    if (listings.length > 0) {
      console.log('\nTop extracted listings:');
      listings.slice(0, 5).forEach((item, idx) => {
        console.log(`\n#${idx + 1}:`);
        console.log(`   Title:    ${item.title}`);
        console.log(`   Price:    ${item.price} (${item.priceNumeric})`);
        console.log(`   Location: ${item.location}`);
        console.log(`   Phone:    ${item.phone}`);
        console.log(`   Source:   ${item.source}`);
        console.log(`   URL:      ${item.sourceUrl}`);
        console.log(`   Images:   ${item.originalImages.length > 0 ? item.originalImages[0] : 'None'}`);
      });
    } else {
      console.log('Note: 0 items returned (either guest checkpoint or no 3-wheel items matching strict regex right now). Error handling worked cleanly without crashing.');
    }
  } catch (err) {
    console.error('Test error:', err.message);
  }
}

testFacebookLive();
