const express = require('express');
const router = express.Router();
const { getListings, getLocations, getLocationHierarchy, getStats } = require('../controllers/listingController');

router.get('/', getListings);
router.get('/locations/hierarchy', getLocationHierarchy);
router.get('/locations', getLocations);
router.get('/stats', getStats);

module.exports = router;
