const Listing = require('../models/Listing');

const getListings = async (req, res) => {
  try {
    const { source, maxPrice, search, timeRange, page = 1, limit = 50 } = req.query;
    const query = {};

    if (source) query.source = source;
    if (maxPrice && !isNaN(maxPrice)) query.priceNumeric = { $gt: 0, $lte: Number(maxPrice) };
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

    const skip = (Number(page) - 1) * Number(limit);

    // Strict reverse-chronological sorting: Newest posted vehicle ALWAYS rendered first
    const listings = await Listing.find(query)
      .sort({ postedTimestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Listing.countDocuments(query);

    res.json({
      success: true,
      count: listings.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      data: listings,
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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayCount = await Listing.countDocuments({
      postedTimestamp: { $gte: startOfToday }
    });

    res.json({
      success: true,
      stats: { totalListings, ikmanCount, riyasevanaCount, todayCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = { getListings, getStats };
