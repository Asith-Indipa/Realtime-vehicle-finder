const axios = require('axios');
const cloudinary = require('../config/cloudinary');

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

      // Upload base64 data to Cloudinary
      const res = await cloudinary.uploader.upload(base64Image, {
        folder: 'three_wheel_deals',
      });

      if (res && res.secure_url) {
        uploadedUrls.push(res.secure_url);
        console.log(`✨ [Cloudinary Backup Success] Uploaded: ${res.secure_url}`);
      } else {
        uploadedUrls.push(url);
      }
    } catch (err) {
      console.error(`[Cloudinary Upload Notice] ${err.message || 'Upload error'}, using direct link fallback.`);
      uploadedUrls.push(url);
    }
  }

  return uploadedUrls;
};

module.exports = { backupImages };
