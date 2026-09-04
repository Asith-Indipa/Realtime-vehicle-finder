const express = require('express');
const router = express.Router();
const { getListings, getLocations, getLocationHierarchy, getStats, cleanupOldListings } = require('../controllers/listingController');

router.get('/', getListings);
router.get('/locations/hierarchy', getLocationHierarchy);
router.get('/locations', getLocations);
router.get('/stats', getStats);
router.delete('/cleanup', cleanupOldListings);

module.exports = router;
