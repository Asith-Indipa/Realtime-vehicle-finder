const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'threewheel_jwt_secret_2026', {
    expiresIn: '30d',
  });
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, whatsappNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let cleanPhone = whatsappNumber ? whatsappNumber.replace(/[^0-9]/g, '') : '';

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      whatsappNumber: cleanPhone,
      isSubscribed: true,
    });

    if (user) {
      res.status(201).json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isSubscribed: user.isSubscribed,
          alertLocation: user.alertLocation,
          alertModel: user.alertModel,
          alertMaxPrice: user.alertMaxPrice,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: cleanEmail });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          whatsappNumber: user.whatsappNumber,
          isSubscribed: user.isSubscribed,
          alertLocation: user.alertLocation,
          alertModel: user.alertModel,
          alertMaxPrice: user.alertMaxPrice,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private
 */
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * @desc    Update user profile & WhatsApp settings
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name ? req.body.name.trim() : user.name;
      if (req.body.email) {
        user.email = req.body.email.toLowerCase().trim();
      }

      if (req.body.whatsappNumber !== undefined) {
        user.whatsappNumber = req.body.whatsappNumber ? req.body.whatsappNumber.replace(/[^0-9]/g, '') : '';
      }

      if (req.body.isSubscribed !== undefined) {
        user.isSubscribed = Boolean(req.body.isSubscribed);
      }

      if (req.body.alertLocation !== undefined) {
        user.alertLocation = req.body.alertLocation ? req.body.alertLocation.trim() : 'all';
      }

      if (req.body.alertModel !== undefined) {
        user.alertModel = req.body.alertModel ? req.body.alertModel.trim() : 'all';
      }

      if (req.body.alertMaxPrice !== undefined) {
        user.alertMaxPrice = req.body.alertMaxPrice ? Number(req.body.alertMaxPrice) : null;
      }

      if (req.body.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        user: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          whatsappNumber: updatedUser.whatsappNumber,
          isSubscribed: updatedUser.isSubscribed,
          alertLocation: updatedUser.alertLocation,
          alertModel: updatedUser.alertModel,
          alertMaxPrice: updatedUser.alertMaxPrice,
        },
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('[Update Profile Error]', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
};
