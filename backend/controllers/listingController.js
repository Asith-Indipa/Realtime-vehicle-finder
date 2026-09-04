const Listing = require('../models/Listing');

const getListings = async (req, res) => {
  try {
    const { source, maxPrice, search, timeRange, priceDropOnly, location, modelType, sortBy = 'latest', page = 1, limit = 200 } = req.query;
    const query = {};

    if (source) query.source = source;
    if (priceDropOnly === 'true') query.hasPriceDrop = true;
    if (maxPrice && !isNaN(maxPrice)) query.priceNumeric = { $gt: 0, $lte: Number(maxPrice) };

    if (location && location !== 'all') {
      query.location = { $regex: location, $options: 'i' };
    }

    if (modelType && modelType !== 'all') {
      if (modelType === '2-stroke') {
        query.title = { $regex: '2\\s*stroke', $options: 'i' };
      } else if (modelType === '4-stroke') {
        query.title = { $regex: '4\\s*stroke', $options: 'i' };
      } else if (modelType === 'tvs-king') {
        query.title = { $regex: 'tvs|king', $options: 'i' };
      } else if (modelType === 'piaggio-ape') {
        query.title = { $regex: 'piaggio|ape', $options: 'i' };
      } else if (modelType === 'bajaj-205') {
        query.title = { $regex: '205|re205', $options: 'i' };
      }
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    // Time Range Filters (Today, This Week, This Month, All Time)
    if (timeRange && timeRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      if (timeRange === 'today') {
        startDate.setHours(0, 0, 0, 0); // Midnight start of today
      } else if (timeRange === 'week') {
        startDate.setDate(now.getDate() - 7); // 7 days ago
      } else if (timeRange === 'month') {
        startDate.setDate(now.getDate() - 30); // 30 days ago
      }

      query.postedTimestamp = { $gte: startDate };
    }

    // Sorting Logic
    let sortOptions = { postedTimestamp: -1, createdAt: -1 };
    if (sortBy === 'price_asc') {
      sortOptions = { priceNumeric: 1 };
      query.priceNumeric = { $gt: 0 };
    } else if (sortBy === 'price_desc') {
      sortOptions = { priceNumeric: -1 };
    } else if (sortBy === 'year_desc') {
      sortOptions = { year: -1, postedTimestamp: -1 };
    } else if (sortBy === 'year_asc') {
      sortOptions = { year: 1, postedTimestamp: -1 };
    }

    const numericLimit = limit === 'all' ? 0 : Number(limit);
    const skip = numericLimit > 0 ? (Number(page) - 1) * numericLimit : 0;

    let dbQuery = Listing.find(query).sort(sortOptions);
    if (numericLimit > 0) {
      dbQuery = dbQuery.skip(skip).limit(numericLimit);
    }

    const listings = await dbQuery;
    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      count: listings.length,
      total,
      page: Number(page),
      pages: numericLimit > 0 ? Math.ceil(total / numericLimit) : 1,
      data: listings,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getLocations = async (req, res) => {
  try {
    const rawLocations = await Listing.distinct('location');
    const cleaned = rawLocations
      .filter((loc) => loc && loc.trim() !== '' && loc !== 'Sri Lanka')
      .map((loc) => loc.trim())
      .sort((a, b) => a.localeCompare(b));

    const uniqueLocations = Array.from(new Set(cleaned));

    res.json({
      success: true,
      data: uniqueLocations,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const totalListings = await Listing.countDocuments();
    const ikmanCount = await Listing.countDocuments({ source: 'ikman.lk' });
    const riyasevanaCount = await Listing.countDocuments({ source: 'riyasevana.com' });
    const priceDropCount = await Listing.countDocuments({ hasPriceDrop: true });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayCount = await Listing.countDocuments({
      postedTimestamp: { $gte: startOfToday }
    });

    res.json({
      success: true,
      stats: { totalListings, ikmanCount, riyasevanaCount, todayCount, priceDropCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getListings, getLocations, getStats };
