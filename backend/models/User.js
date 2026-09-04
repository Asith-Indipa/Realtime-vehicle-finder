const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true,
    },
    isSubscribed: {
      type: Boolean,
      default: true,
    },
    alertLocation: {
      type: String,
      default: 'all',
      trim: true,
    },
    alertModel: {
      type: String,
      default: 'all',
      trim: true,
    },
    alertMaxPrice: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('User', userSchema);
