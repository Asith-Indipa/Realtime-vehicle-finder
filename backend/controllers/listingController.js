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
        query.title = { $regex: '2[\\s-]*stroke', $options: 'i' };
      } else if (modelType === '4-stroke') {
        query.title = { $regex: '4[\\s-]*stroke', $options: 'i' };
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

const SRI_LANKA_HIERARCHY = {
  Colombo: ['All in Colombo', 'Colombo City', 'Maharagama', 'Nugegoda', 'Kaduwela', 'Piliyandala', 'Dehiwala', 'Homagama', 'Moratuwa', 'Malabe', 'Battaramulla', 'Kottawa', 'Avissawella', 'Kotte', 'Hanwella', 'Angoda', 'Wellampitiya'],
  Gampaha: ['All in Gampaha', 'Gampaha City', 'Negombo', 'Kadawatha', 'Kiribathgoda', 'Ja-Ela', 'Wattala', 'Minuwangoda', 'Nittambuwa', 'Veyangoda', 'Ragama', 'Kelaniya', 'Mirigama', 'Delgoda', 'Ganemulla'],
  Kandy: ['All in Kandy', 'Kandy City', 'Peradeniya', 'Katugastota', 'Gampola', 'Kundasale', 'Nawalapitiya', 'Akurana', 'Kadugannawa', 'Digana', 'Teldeniya', 'Wattegama', 'Pilimathalawa'],
  Galle: ['All in Galle', 'Galle City', 'Hikkaduwa', 'Ambalangoda', 'Elpitiya', 'Bentota', 'Baddegama', 'Karapitiya', 'Ahangama', 'Koggala', 'Batapola'],
  Matara: ['All in Matara', 'Matara City', 'Weligama', 'Akuressa', 'Dikwella', 'Deniyaya', 'Hakmana', 'Kamburupitiya', 'Kamburugamuwa', 'Gandara', 'Kekanadurra', 'Mirissa'],
  Kurunegala: ['All in Kurunegala', 'Kurunegala City', 'Kuliyapitiya', 'Pannala', 'Mawathagama', 'Giriulla', 'Narammala', 'Wariyapola', 'Ibbagamuwa', 'Alawwa', 'Nikaweratiya'],
  Kegalle: ['All in Kegalle', 'Kegalle City', 'Mawanella', 'Warakapola', 'Rambukkana', 'Dehiowita', 'Deraniyagala', 'Yatiyantota', 'Ruwanwella', 'Galigamuwa'],
  Ratnapura: ['All in Ratnapura', 'Ratnapura City', 'Embilipitiya', 'Balangoda', 'Eheliyagoda', 'Pelmadulla', 'Kuruwita', 'Kahawatta', 'Rakwana'],
  Kalutara: ['All in Kalutara', 'Kalutara City', 'Panadura', 'Horana', 'Matugama', 'Bandaragama', 'Beruwala', 'Aluthgama', 'Wadduwa', 'Ingiriya'],
  Hambantota: ['All in Hambantota', 'Hambantota City', 'Tangalle', 'Beliatta', 'Ambalantota', 'Tissamaharama', 'Middeniya', 'Walasmulla', 'Suriyawewa'],
  Badulla: ['All in Badulla', 'Badulla City', 'Bandarawela', 'Diyatalawa', 'Ella', 'Welimada', 'Mahiyanganaya', 'Hali-Ela', 'Passara'],
  'Nuwara Eliya': ['All in Nuwara Eliya', 'Nuwara Eliya City', 'Hatton', 'Maskeliya', 'Ginigathena', 'Talawakele', 'Walapane', 'Hanguranketha'],
  Anuradhapura: ['All in Anuradhapura', 'Anuradhapura City', 'Kekirawa', 'Eppawala', 'Medawachchiya', 'Galenbindunuwewa', 'Thambuttegama', 'Mihintale'],
  Polonnaruwa: ['All in Polonnaruwa', 'Polonnaruwa City', 'Hingurakgoda', 'Kaduruwela', 'Medirigiriya'],
  Ampara: ['All in Ampara', 'Ampara City', 'Kalmunai', 'Akkaraipattu', 'Sainthamaruthu', 'Sammanthurai'],
  Batticaloa: ['All in Batticaloa', 'Batticaloa City', 'Kattankudy', 'Chenkalady', 'Eravur', 'Valachchenai'],
  Trincomalee: ['All in Trincomalee', 'Trincomalee City', 'Kinniya', 'Kantale', 'China Bay'],
  Jaffna: ['All in Jaffna', 'Jaffna City', 'Chavakachcheri', 'Nallur', 'Point Pedro', 'Chunnakam', 'Karainagar'],
  Kilinochchi: ['All in Kilinochchi', 'Kilinochchi City', 'Pallai'],
  Mannar: ['All in Mannar', 'Mannar City'],
  Vavuniya: ['All in Vavuniya', 'Vavuniya City'],
  Mullaitivu: ['All in Mullaitivu', 'Mullaitivu City'],
  Moneragala: ['All in Moneragala', 'Moneragala City', 'Wellawaya', 'Bibile', 'Kataragama', 'Buttala'],
  Matale: ['All in Matale', 'Matale City', 'Dambulla', 'Galewela', 'Sigiriya', 'Ukuwela', 'Yatawatta'],
  Puttalam: ['All in Puttalam', 'Puttalam City', 'Chilaw', 'Wennappuwa', 'Marawila', 'Dankotuwa', 'Nattandiya', 'Anamaduwa']
};

const getLocationHierarchy = async (req, res) => {
  try {
    const rawLocations = await Listing.distinct('location');
    const hierarchy = JSON.parse(JSON.stringify(SRI_LANKA_HIERARCHY));

    rawLocations.forEach((loc) => {
      if (!loc || loc.trim() === '' || loc === 'Sri Lanka') return;
      const cleanLoc = loc.replace(/,\s*Three\s*Wheelers/gi, '').trim();
      const parts = cleanLoc.split(',').map(p => p.trim());
      
      const city = parts[0];
      const districtMatch = parts[1];

      let targetDistrict = districtMatch && hierarchy[districtMatch] ? districtMatch : null;
      if (!targetDistrict) {
        for (const distKey of Object.keys(hierarchy)) {
          if (cleanLoc.toLowerCase().includes(distKey.toLowerCase())) {
            targetDistrict = distKey;
            break;
          }
        }
      }

      if (targetDistrict && city) {
        if (!hierarchy[targetDistrict].includes(city)) {
          hierarchy[targetDistrict].push(city);
        }
      }
    });

    res.json({
      success: true,
      hierarchy,
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
      .map((loc) => loc.replace(/,\s*Three\s*Wheelers/gi, '').trim())
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

const { deleteCloudinaryImages } = require('../services/imageService');

const cleanupOldListings = async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldListings = await Listing.find({ postedTimestamp: { $lt: sevenDaysAgo } });

    if (oldListings.length === 0) {
      if (res) res.json({ success: true, message: 'No listings older than 7 days to clean up.' });
      return { success: true, count: 0 };
    }

    const allImages = [];
    oldListings.forEach((item) => {
      if (item.cloudinaryImages && Array.isArray(item.cloudinaryImages)) {
        allImages.push(...item.cloudinaryImages);
      }
    });

    if (allImages.length > 0) {
      await deleteCloudinaryImages(allImages);
    }

    const deleteResult = await Listing.deleteMany({ postedTimestamp: { $lt: sevenDaysAgo } });
    console.log(`🧹 [7-Day Auto-Cleanup] Purged ${deleteResult.deletedCount} listings and Cloudinary photos older than 7 days.`);

    if (res) {
      res.json({
        success: true,
        deletedCount: deleteResult.deletedCount,
        photosDeleted: allImages.length,
      });
    }

    return { success: true, count: deleteResult.deletedCount };
  } catch (error) {
    console.error('[Auto-Cleanup Error]', error.message);
    if (res) res.status(500).json({ success: false, error: error.message });
    return { success: false, error: error.message };
  }
};

module.exports = { getListings, getLocations, getLocationHierarchy, getStats, cleanupOldListings };
