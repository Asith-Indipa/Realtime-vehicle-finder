const mongoose = require('mongoose');

const listingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    price: { type: String, required: true },
    priceNumeric: { type: Number, index: true },
    location: { type: String, default: 'Sri Lanka' },
    year: { type: String, default: 'N/A' },
    phone: { type: String, default: 'N/A' },
    source: { type: String, required: true, enum: ['ikman.lk', 'riyasevana.com'] },
    sourceUrl: { type: String, required: true, unique: true },
    originalImages: [{ type: String }],
    cloudinaryImages: [{ type: String }],
    postedTimeText: { type: String, default: 'Recently posted' },
    postedTimestamp: { type: Date, default: Date.now, index: true },
    notifiedWhatsApp: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Listing', listingSchema);
