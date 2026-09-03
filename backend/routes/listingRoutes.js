const express = require('express');
const router = express.Router();
const { getListings, getStats } = require('../controllers/listingController');

router.get('/', getListings);
router.get('/stats', getStats);

module.exports = router;
