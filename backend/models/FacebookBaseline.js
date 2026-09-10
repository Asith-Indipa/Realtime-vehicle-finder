const mongoose = require('mongoose');

const facebookBaselineSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 2592000, // TTL index: automatically clean up after 30 days
  },
});

module.exports = mongoose.model('FacebookBaseline', facebookBaselineSchema);
