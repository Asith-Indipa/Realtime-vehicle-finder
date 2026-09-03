const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Auto-detect local Chrome or Edge installation on Windows
const getBrowserExecutablePath = () => {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.CHROME_PATH,
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      console.log(`[WhatsApp Bot] Using system browser: ${p}`);
      return p;
    }
  }
  return undefined;
};

let clientReady = false;

const puppeteerOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
  ],
};

const executablePath = getBrowserExecutablePath();
if (executablePath) {
  puppeteerOptions.executablePath = executablePath;
}

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: puppeteerOptions,
});

client.on('qr', (qr) => {
  console.log('\n======================================================');
  console.log('📲 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT:');
  console.log('======================================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  clientReady = true;
  console.log('\n======================================================');
  console.log('✅ WHATSAPP CONNECTED SUCCESSFULLY & READY FOR ALERTS!');
  console.log('======================================================\n');
});

client.on('auth_failure', (msg) => {
  console.error('[WhatsApp Auth Failure]', msg);
});

client.on('disconnected', (reason) => {
  clientReady = false;
  console.log('[WhatsApp Disconnected]', reason);
});

// Initialize WhatsApp client
client.initialize().catch((err) => {
  console.error('[WhatsApp Initialization Warning]', err.message);
});

/**
 * Sends instant WhatsApp alert for a newly detected listing
 * @param {Object} listing 
 * @param {string} targetPhone 
 */
const sendWhatsAppAlert = async (listing, targetPhone = process.env.ALERT_PHONE_NUMBER) => {
  if (!clientReady) {
    console.log(`[WhatsApp] Client not authenticated yet. Skipping instant alert for: ${listing.title}`);
    return false;
  }

  try {
    let formattedPhone = targetPhone ? targetPhone.trim() : '';
    if (!formattedPhone) {
      console.log('[WhatsApp] No target phone number specified in ALERT_PHONE_NUMBER in .env');
      return false;
    }

    if (!formattedPhone.endsWith('@c.us')) {
      formattedPhone = `${formattedPhone.replace(/[^0-9]/g, '')}@c.us`;
    }

    const imageToUse = (listing.originalImages && listing.originalImages.length > 0)
      ? listing.originalImages[0]
      : null;

    const messageText = `🚨 *NEW THREE-WHEEL DEAL DETECTED!* 🛺

📌 *${listing.title}*
💰 *Price:* ${listing.price}
📍 *Location:* ${listing.location}
🌐 *Source:* ${listing.source}
⏰ *Time:* ${listing.postedTimeText || 'Just now'}

🔗 *Direct Link:* ${listing.sourceUrl}`;

    if (imageToUse) {
      try {
        const media = await MessageMedia.fromUrl(imageToUse);
        await client.sendMessage(formattedPhone, media, { caption: messageText });
      } catch (mediaErr) {
        console.error('[WhatsApp Media Error] Fallback to text message:', mediaErr.message);
        await client.sendMessage(formattedPhone, messageText);
      }
    } else {
      await client.sendMessage(formattedPhone, messageText);
    }

    console.log(`[WhatsApp Alert Sent] Successfully sent alert for "${listing.title}" to ${formattedPhone}`);
    return true;
  } catch (error) {
    console.error(`[WhatsApp Send Error] ${error.message}`);
    return false;
  }
};

module.exports = {
  sendWhatsAppAlert,
  isWhatsAppReady: () => clientReady,
};
