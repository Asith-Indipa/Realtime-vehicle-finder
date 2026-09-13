const axios = require('axios');
const crypto = require('crypto');
const cloudinary = require('../config/cloudinary');

const getImagePublicId = (url) => {
  const hash = crypto.createHash('md5').update(url).digest('hex');
  return `img_${hash}`;
};

/**
 * Auto-uploads scraped image URLs to Cloudinary Cloud Storage for long-term backup
 * @param {Array<string>} imageUrls 
 * @returns {Promise<Array<string>>}
 */
const backupImages = async (imageUrls = []) => {
  if (!imageUrls || imageUrls.length === 0) return [];
  
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return imageUrls;
  }

  const uploadedUrls = [];
  for (const url of imageUrls) {
    if (!url || typeof url !== 'string') continue;
    try {
      const publicId = getImagePublicId(url);

      // Fetch image buffer with standard Browser User-Agent to bypass hotlink protection
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 8000,
      });

      const mimeType = response.headers['content-type'] || 'image/jpeg';
      const base64Image = `data:${mimeType};base64,${Buffer.from(response.data).toString('base64')}`;

      // Upload base64 data to Cloudinary using deterministic public_id to prevent duplicates
      const res = await cloudinary.uploader.upload(base64Image, {
        folder: 'three_wheel_deals',
        public_id: publicId,
        overwrite: false,
      });

      if (res && res.secure_url) {
        uploadedUrls.push(res.secure_url);
        console.log(`✨ [Cloudinary Backup Success] Uploaded: ${res.secure_url}`);
      } else {
        uploadedUrls.push(url);
      }
    } catch (err) {
      // If image already exists, construct Cloudinary URL or fallback
      if (err.message && err.message.includes('already exists')) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const publicId = getImagePublicId(url);
        const existingUrl = `https://res.cloudinary.com/${cloudName}/image/upload/v1/three_wheel_deals/${publicId}.jpg`;
        uploadedUrls.push(existingUrl);
      } else {
        console.error(`[Cloudinary Upload Notice] ${err.message || 'Upload error'}, using direct link fallback.`);
        uploadedUrls.push(url);
      }
    }
  }

  return uploadedUrls;
};

/**
 * Deletes photos from Cloudinary given their secure URLs.
 * Uses per-request timeout and graceful error handling to prevent server blocking.
 * @param {Array<string>} imageUrls 
 */
const deleteCloudinaryImages = async (imageUrls = []) => {
  if (!imageUrls || imageUrls.length === 0) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) return;

  let deletedCount = 0;
  let failedCount = 0;

  for (const url of imageUrls) {
    if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) continue;
    try {
      const match = url.match(/three_wheel_deals\/[^.]+/);
      if (match && match[0]) {
        const publicId = match[0];
        // Wrap each delete in a 5-second timeout to prevent hanging on network issues
        const deletePromise = cloudinary.uploader.destroy(publicId);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cloudinary delete timed out (5s)')), 5000)
        );
        await Promise.race([deletePromise, timeoutPromise]);
        deletedCount++;
      }
    } catch (err) {
      failedCount++;
      // Only log first 3 failures to avoid flooding the console
      if (failedCount <= 3) {
        const errMsg = (err && err.message) ? err.message : 'Unknown error';
        console.log(`[Cloudinary Delete Skip] ${errMsg}`);
      }
    }
  }

  if (deletedCount > 0 || failedCount > 0) {
    console.log(`🗑️ [Cloudinary Cleanup Done] Deleted: ${deletedCount}, Skipped: ${failedCount}`);
  }
};

module.exports = { backupImages, deleteCloudinaryImages };
