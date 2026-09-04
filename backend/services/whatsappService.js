const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ──────────────────────────────────────────────────────────────
// 1. AUTO-DETECT ANY INSTALLED BROWSER ENGINE (Chrome, Edge, Brave, etc.)
// ──────────────────────────────────────────────────────────────
const getBrowserExecutablePath = () => {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

  const candidates = [
    // Chrome
    path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    // Edge
    path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    // Brave
    path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    // Vivaldi & Opera
    path.join(localAppData, 'Vivaldi', 'Application', 'vivaldi.exe'),
    path.join(programFiles, 'Opera', 'launcher.exe'),
    // ENV override
    process.env.CHROME_PATH,
  ];

  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      console.log(`[WhatsApp Bot] Using browser: ${path.basename(p)} (${p})`);
      return p;
    }
  }
  console.warn('[WhatsApp Bot] No browser found! Puppeteer will try its bundled Chromium.');
  return undefined;
};

// ──────────────────────────────────────────────────────────────
// 2. KILL ORPHANED CHROME PROCESSES FROM PREVIOUS SERVER RUNS
//    (This is the key fix — old Ctrl+C leaves zombie Chrome alive)
// ──────────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────────
// 2. KILL ORPHANED CHROME PROCESSES FROM PREVIOUS SERVER RUNS
// ──────────────────────────────────────────────────────────────
const killOrphanedBrowserProcesses = () => {
  try {
    const wmicOutput = execSync(
      'wmic process where "commandline like \'%wwebjs_auth%\'" get processid /format:list',
      { encoding: 'utf-8', timeout: 8000, stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const pids = wmicOutput.match(/ProcessId=(\d+)/gi);
    if (pids && pids.length > 0) {
      for (const match of pids) {
        const pid = match.split('=')[1];
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore', timeout: 3000 });
          } catch (e) { /* process already dead */ }
        }
      }
      console.log(`[WhatsApp Bot] Cleaned ${pids.length} orphaned browser process(es).`);
    }
  } catch (e) {
    // No matching processes found — normal
  }
};

// ──────────────────────────────────────────────────────────────
// 3. CLEAN STALE LOCK FILES FROM AUTH DIRECTORY
// ──────────────────────────────────────────────────────────────
const cleanLockFiles = (dir) => {
  if (!dir) dir = path.resolve('./.wwebjs_auth');
  if (!fs.existsSync(dir)) return;

  try {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        cleanLockFiles(fullPath);
      } else if (entry === 'SingletonLock' || entry === 'SingletonCookie' || entry === 'SingletonSocket') {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {}
      }
    }
  } catch (e) { /* ignore */ }
};

// ──────────────────────────────────────────────────────────────
// 4. FULL PRE-FLIGHT CLEANUP
// ──────────────────────────────────────────────────────────────
const preFlightCleanup = () => {
  killOrphanedBrowserProcesses();
  cleanLockFiles();
};

// ──────────────────────────────────────────────────────────────
// 5. CLIENT STATE
// ──────────────────────────────────────────────────────────────
let clientReady = false;
let whatsappStatus = 'INITIALIZING'; // 'INITIALIZING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED'
let qrCodeImageUrl = null;

const createPuppeteerOptions = () => {
  const opts = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
    ],
  };
  const execPath = getBrowserExecutablePath();
  if (execPath) {
    opts.executablePath = execPath;
  }
  return opts;
};

// ──────────────────────────────────────────────────────────────
// 6. CLIENT CREATION & EVENT BINDING
// ──────────────────────────────────────────────────────────────
let client = new Client({
  authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
  puppeteer: createPuppeteerOptions(),
});

let isRestarting = false;

const setupClientEvents = (clientInstance) => {
  clientInstance.on('qr', (qr) => {
    whatsappStatus = 'QR_READY';
    qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`;

    console.log('\n======================================================');
    console.log('📲 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT:');
    console.log('======================================================\n');
    qrcode.generate(qr, { small: true });
  });

  clientInstance.on('ready', () => {
    clientReady = true;
    whatsappStatus = 'CONNECTED';
    qrCodeImageUrl = null;
    console.log('\n======================================================');
    console.log('✅ WHATSAPP CONNECTED SUCCESSFULLY & READY FOR ALERTS!');
    console.log('======================================================\n');
  });

  clientInstance.on('auth_failure', (msg) => {
    console.error('[WhatsApp Auth Failure] Session unlinked:', msg);
    clientReady = false;
    whatsappStatus = 'DISCONNECTED';
    qrCodeImageUrl = null;
  });

  clientInstance.on('disconnected', (reason) => {
    console.log('[WhatsApp Disconnected] Session unlinked/logged out:', reason);
    clientReady = false;
    whatsappStatus = 'DISCONNECTED';
    qrCodeImageUrl = null;
  });
};

setupClientEvents(client);

// Guard against temporary Puppeteer navigation context destruction errors during WhatsApp login
process.on('unhandledRejection', (reason) => {
  if (reason && reason.message && reason.message.includes('Execution context was destroyed')) {
    console.log('[WhatsApp Bot Guard] Handled temporary page navigation during authentication.');
    return;
  }
  console.error('[Unhandled Promise Rejection]', reason);
});

// ──────────────────────────────────────────────────────────────
// 7. INITIALIZATION & RESTART
// ──────────────────────────────────────────────────────────────
const initializeWhatsAppBot = async () => {
  preFlightCleanup();
  whatsappStatus = 'INITIALIZING';
  try {
    await client.initialize();
  } catch (err) {
    console.error('[WhatsApp Initialization Warning]', err.message);
    whatsappStatus = 'DISCONNECTED';
  }
};

// Initialize on startup
initializeWhatsAppBot();

const restartWhatsAppBot = async () => {
  if (isRestarting) {
    console.log('[WhatsApp Bot] Restart already in progress...');
    return;
  }
  isRestarting = true;
  console.log('[WhatsApp Bot] Clean restarting client...');
  whatsappStatus = 'INITIALIZING';
  qrCodeImageUrl = null;
  clientReady = false;

  // Clear saved session so fresh QR code generates cleanly
  try {
    const authDir = path.resolve('./.wwebjs_auth');
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch (e) {}

  // Destroy existing client & browser
  try {
    if (client && client.pupBrowser) {
      await client.pupBrowser.close().catch(() => {});
    }
    await client.destroy().catch(() => {});
  } catch (e) { /* ignore */ }

  // Kill any orphaned processes & clean lock files
  preFlightCleanup();

  // Create fresh client
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
    puppeteer: createPuppeteerOptions(),
  });
  setupClientEvents(client);

  try {
    await client.initialize();
  } catch (err) {
    console.error('[WhatsApp Restart Error]', err.message);
    whatsappStatus = 'DISCONNECTED';
  } finally {
    isRestarting = false;
  }
};

const User = require('../models/User');

/**
 * Retrieves all subscribers whose alert filters match the given listing
 */
const getSubscribedUsersForListing = async (listing) => {
  const matchingSubscribers = [];

  if (process.env.ALERT_PHONE_NUMBER && process.env.ALERT_PHONE_NUMBER.trim()) {
    const envPhone = process.env.ALERT_PHONE_NUMBER.trim().replace(/[^0-9]/g, '');
    if (envPhone) {
      matchingSubscribers.push({ whatsappNumber: envPhone, name: 'Admin Alert' });
    }
  }

  try {
    const users = await User.find({ isSubscribed: true, whatsappNumber: { $exists: true, $ne: '' } });
    for (const u of users) {
      const cleanPhone = u.whatsappNumber ? u.whatsappNumber.trim().replace(/[^0-9]/g, '') : '';
      if (!cleanPhone) continue;

      // 1. Check Location Filter
      if (u.alertLocation && u.alertLocation !== 'all') {
        const locFilter = u.alertLocation.toLowerCase().trim();
        const listingLoc = (listing.location || '').toLowerCase();
        if (!listingLoc.includes(locFilter)) {
          continue; // Skip: Location doesn't match
        }
      }

      // 2. Check Model Filter
      if (u.alertModel && u.alertModel !== 'all') {
        const modelFilter = u.alertModel.toLowerCase().trim();
        const listingTitle = (listing.title || '').toLowerCase();
        let matchesModel = true;

        if (modelFilter === '2-stroke') {
          matchesModel = /2\s*stroke/i.test(listingTitle);
        } else if (modelFilter === '4-stroke') {
          matchesModel = /4\s*stroke/i.test(listingTitle);
        } else if (modelFilter === 'tvs-king') {
          matchesModel = /tvs|king/i.test(listingTitle);
        } else if (modelFilter === 'piaggio-ape') {
          matchesModel = /piaggio|ape/i.test(listingTitle);
        } else if (modelFilter === 'bajaj-205') {
          matchesModel = /205|re205/i.test(listingTitle);
        } else {
          matchesModel = listingTitle.includes(modelFilter);
        }

        if (!matchesModel) {
          continue; // Skip: Model doesn't match
        }
      }

      // 3. Check Max Price Filter
      if (u.alertMaxPrice && u.alertMaxPrice > 0) {
        if (listing.priceNumeric && listing.priceNumeric > u.alertMaxPrice) {
          continue; // Skip: Price exceeds max limit
        }
      }

      matchingSubscribers.push({
        whatsappNumber: cleanPhone,
        name: u.name,
      });
    }
  } catch (err) {
    console.error('[WhatsApp Service] Subscriber match error:', err.message);
  }

  return matchingSubscribers;
};

/**
 * Sends instant WhatsApp alert for a newly detected listing to matching subscribers
 * @param {Object} listing 
 */
const sendWhatsAppAlert = async (listing) => {
  if (!clientReady) {
    console.log(`[WhatsApp] Client not authenticated yet. Skipping instant alert for: ${listing.title}`);
    return false;
  }

  try {
    const subscribers = await getSubscribedUsersForListing(listing);
    if (subscribers.length === 0) {
      console.log(`[WhatsApp Filter Note] No matching subscribers for "${listing.title}" in ${listing.location}`);
      return false;
    }

    const imageToUse = (listing.originalImages && listing.originalImages.length > 0)
      ? listing.originalImages[0]
      : null;

    const sellerContact = (listing.phone && listing.phone !== 'N/A' && listing.phone.trim() !== '')
      ? listing.phone.trim()
      : 'Available on Direct Link';

    const messageText = `🚨 *NEW THREE-WHEEL DEAL DETECTED!* 🛺

📌 *${listing.title}*
💰 *Price:* ${listing.price}
📍 *Location:* ${listing.location}
📞 *Seller Contact:* ${sellerContact}
🌐 *Source:* ${listing.source}

🔗 *Direct Link:* ${listing.sourceUrl}`;

    let successCount = 0;
    for (const sub of subscribers) {
      try {
        const targetJid = await resolveTargetJid(sub.whatsappNumber);
        if (!targetJid) continue;

        if (imageToUse) {
          try {
            const media = await MessageMedia.fromUrl(imageToUse);
            await client.sendMessage(targetJid, media, { caption: messageText });
          } catch (mediaErr) {
            console.log(`[WhatsApp Media Warning for ${targetJid}] ${mediaErr.message}. Sending text alert...`);
            await client.sendMessage(targetJid, messageText);
          }
        } else {
          await client.sendMessage(targetJid, messageText);
        }
        successCount++;
        console.log(`[WhatsApp Alert Delivered] Sent to ${targetJid} (${sub.name})`);
      } catch (err) {
        console.error(`[WhatsApp Send Error to ${sub.whatsappNumber}] ${err.message}`);
      }
    }

    console.log(`[WhatsApp Alert Sent] Delivered "${listing.title}" to ${successCount} matching subscriber(s).`);
    return successCount > 0;
  } catch (error) {
    console.error(`[WhatsApp Send Error] ${error.message}`);
    return false;
  }
};

/**
 * Sends instant WhatsApp alert when a price drop is detected to all active subscribers
 * @param {Object} listing 
 */
const sendWhatsAppPriceDropAlert = async (listing) => {
  if (!clientReady) {
    console.log(`[WhatsApp] Client not authenticated. Skipping price drop alert for: ${listing.title}`);
    return false;
  }

  try {
    const phoneNumbers = await getSubscribedPhoneNumbers();
    if (phoneNumbers.length === 0) return false;

    const imageToUse = (listing.originalImages && listing.originalImages.length > 0)
      ? listing.originalImages[0]
      : null;

    const formattedDrop = listing.priceDropAmount ? `Rs. ${listing.priceDropAmount.toLocaleString()}` : '';

    const sellerContact = (listing.phone && listing.phone !== 'N/A' && listing.phone.trim() !== '')
      ? listing.phone.trim()
      : 'Available on Direct Link';

    const messageText = `📉 *PRICE DROP ALERT!* 🔥 🛺

📌 *${listing.title}*
💰 *New Price:* ${listing.price} (Was: ~${listing.previousPrice || 'higher'}~)
💥 *SAVED:* ${formattedDrop} OFF!
📍 *Location:* ${listing.location}
📞 *Seller Contact:* ${sellerContact}
🌐 *Source:* ${listing.source}

🔗 *Direct Link:* ${listing.sourceUrl}`;

    let successCount = 0;
    for (const rawPhone of phoneNumbers) {
      try {
        const targetJid = await resolveTargetJid(rawPhone);
        if (!targetJid) continue;

        if (imageToUse) {
          try {
            const media = await MessageMedia.fromUrl(imageToUse);
            await client.sendMessage(targetJid, media, { caption: messageText });
          } catch (mediaErr) {
            await client.sendMessage(targetJid, messageText);
          }
        } else {
          await client.sendMessage(targetJid, messageText);
        }
        successCount++;
        console.log(`[WhatsApp Price Drop Delivered] Sent to ${targetJid}`);
      } catch (err) {
        console.error(`[WhatsApp Price Drop Send Error to ${rawPhone}] ${err.message}`);
      }
    }

    console.log(`[WhatsApp Price Drop Alert Sent] Broadcasted "${listing.title}" to ${successCount} subscriber(s).`);
    return successCount > 0;
  } catch (error) {
    console.error(`[WhatsApp Send Error] ${error.message}`);
    return false;
  }
};

const logoutWhatsAppBot = async () => {
  console.log('[WhatsApp Bot] User requested logout / session reset...');
  clientReady = false;
  whatsappStatus = 'DISCONNECTED';
  qrCodeImageUrl = null;
  try {
    if (client) {
      await client.logout().catch(() => {});
    }
  } catch (e) {}
  await restartWhatsAppBot();
};

const getWhatsAppStatus = () => {
  return {
    status: whatsappStatus,
    qrCodeImageUrl,
    ready: clientReady,
  };
};

// ──────────────────────────────────────────────────────────────
// 9. EXPORTS
// ──────────────────────────────────────────────────────────────
module.exports = {
  sendWhatsAppAlert,
  sendWhatsAppPriceDropAlert,
  isWhatsAppReady: () => clientReady,
  restartWhatsAppBot,
  logoutWhatsAppBot,
  getWhatsAppStatus,
};