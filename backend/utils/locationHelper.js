// Location utility for Sri Lankan Three-Wheeler App
// Extracts and formats exact "City, District" or "District"

const SRI_LANKA_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota', 'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya',
  'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee', 'Kurunegala', 'Puttalam',
  'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Moneragala', 'Ratnapura', 'Kegalle'
];

const TOWN_TO_DISTRICT = {
  // Colombo
  'colombo': 'Colombo', 'colombo 1': 'Colombo', 'colombo 2': 'Colombo', 'colombo 3': 'Colombo',
  'colombo 4': 'Colombo', 'colombo 5': 'Colombo', 'colombo 6': 'Colombo', 'colombo 7': 'Colombo',
  'colombo 8': 'Colombo', 'colombo 9': 'Colombo', 'colombo 10': 'Colombo', 'colombo 11': 'Colombo',
  'colombo 12': 'Colombo', 'colombo 13': 'Colombo', 'colombo 14': 'Colombo', 'colombo 15': 'Colombo',
  'dehiwala': 'Colombo', 'mount lavinia': 'Colombo', 'moratuwa': 'Colombo', 'piliyandala': 'Colombo',
  'maharagama': 'Colombo', 'kottawa': 'Colombo', 'homagama': 'Colombo', 'nugegoda': 'Colombo',
  'kaduwela': 'Colombo', 'malabe': 'Colombo', 'athurugiriya': 'Colombo', 'battaramulla': 'Colombo',
  'rajagiriya': 'Colombo', 'hanwella': 'Colombo', 'padukka': 'Colombo', 'kesbewa': 'Colombo',
  'boralesgamuwa': 'Colombo', 'pannipitiya': 'Colombo', 'kohuwala': 'Colombo', 'ratmalana': 'Colombo',
  'wellawatte': 'Colombo', 'angoda': 'Colombo', 'kolonnawa': 'Colombo', 'avissawella': 'Colombo',
  'kotte': 'Colombo', 'wellampitiya': 'Colombo', 'talawatugoda': 'Colombo', 'thalawathugoda': 'Colombo',
  'nawala': 'Colombo', 'godagama': 'Colombo', 'meegoda': 'Colombo', 'hokandara': 'Colombo',
  'kollupitiya': 'Colombo', 'bambalapitiya': 'Colombo', 'borella': 'Colombo', 'dematagoda': 'Colombo',
  'maradana': 'Colombo', 'pettah': 'Colombo', 'slave island': 'Colombo', 'fort': 'Colombo',
  'mattakkuliya': 'Colombo', 'modara': 'Colombo', 'kotahena': 'Colombo', 'grandpass': 'Colombo',
  'mulleriyawa': 'Colombo',

  // Gampaha
  'gampaha': 'Gampaha', 'negombo': 'Gampaha', 'ja-ela': 'Gampaha', 'ja ela': 'Gampaha',
  'wattala': 'Gampaha', 'kelaniya': 'Gampaha', 'kadawatha': 'Gampaha', 'kiribathgoda': 'Gampaha',
  'nittambuwa': 'Gampaha', 'minuwangoda': 'Gampaha', 'mirigama': 'Gampaha', 'divulapitiya': 'Gampaha',
  'veyangoda': 'Gampaha', 'ragama': 'Gampaha', 'kandana': 'Gampaha', 'katunayake': 'Gampaha',
  'delgoda': 'Gampaha', 'ganemulla': 'Gampaha', 'biyagama': 'Gampaha', 'yakkala': 'Gampaha',
  'seeduwa': 'Gampaha', 'kotadeniyawa': 'Gampaha', 'dompe': 'Gampaha', 'pugoda': 'Gampaha',
  'kirindiwela': 'Gampaha', 'bopitiya': 'Gampaha', 'hendala': 'Gampaha', 'pamunugama': 'Gampaha',

  // Kalutara
  'kalutara': 'Kalutara', 'panadura': 'Kalutara', 'horana': 'Kalutara', 'bandaragama': 'Kalutara',
  'matugama': 'Kalutara', 'wadduwa': 'Kalutara', 'beruwala': 'Kalutara', 'aluthgama': 'Kalutara',
  'ingiriya': 'Kalutara', 'bulathsinhala': 'Kalutara', 'dodangoda': 'Kalutara', 'agalawatta': 'Kalutara',
  'paiyagala': 'Kalutara', 'millaniya': 'Kalutara', 'meegahatena': 'Kalutara',

  // Kandy
  'kandy': 'Kandy', 'peradeniya': 'Kandy', 'katugastota': 'Kandy', 'gampola': 'Kandy',
  'nawalapitiya': 'Kandy', 'kundasale': 'Kandy', 'akurana': 'Kandy', 'digana': 'Kandy',
  'teldeniya': 'Kandy', 'gelioya': 'Kandy', 'pilimathalawa': 'Kandy', 'wattegama': 'Kandy',
  'pathahewaheta': 'Kandy', 'menikhinna': 'Kandy', 'kadugannawa': 'Kandy', 'madawala': 'Kandy',
  'ampitiya': 'Kandy', 'poojapitiya': 'Kandy', 'harispattuwa': 'Kandy', 'alawatugoda': 'Kandy',
  'galagedara': 'Kandy', 'daulagala': 'Kandy', 'ankumbura': 'Kandy', 'hasalaka': 'Kandy',

  // Kurunegala
  'kurunegala': 'Kurunegala', 'kuliyapitiya': 'Kurunegala', 'narammala': 'Kurunegala',
  'pannala': 'Kurunegala', 'wariyapola': 'Kurunegala', 'giriulla': 'Kurunegala',
  'polgahawela': 'Kurunegala', 'ibbagamuwa': 'Kurunegala', 'alawwa': 'Kurunegala',
  'mawathagama': 'Kurunegala', 'bingiriya': 'Kurunegala', 'hettipola': 'Kurunegala',
  'nikaweratiya': 'Kurunegala', 'maho': 'Kurunegala', 'dummalasuriya': 'Kurunegala',
  'galgamuwa': 'Kurunegala', 'panduwasnuwara': 'Kurunegala', 'rideegama': 'Kurunegala',
  'gallela': 'Kurunegala', 'pothuhera': 'Kurunegala',

  // Galle
  'galle': 'Galle', 'ambalangoda': 'Galle', 'hikkaduwa': 'Galle', 'karapitiya': 'Galle',
  'elpitiya': 'Galle', 'bentota': 'Galle', 'baddegama': 'Galle', 'ahangama': 'Galle',
  'batapola': 'Galle', 'habaraduwa': 'Galle', 'koggala': 'Galle', 'uragasmanhandiya': 'Galle',
  'balapitiya': 'Galle', 'nagoda': 'Galle', 'neluwa': 'Galle', 'yakkalamulla': 'Galle',
  'boossa': 'Galle', 'unawatuna': 'Galle',

  // Matara
  'matara': 'Matara', 'akuressa': 'Matara', 'weligama': 'Matara', 'dikwella': 'Matara',
  'hakmana': 'Matara', 'kamburupitiya': 'Matara', 'deniyaya': 'Matara', 'mirissa': 'Matara',
  'gandara': 'Matara', 'kekanadurra': 'Matara', 'kamburugamuwa': 'Matara', 'devinuwara': 'Matara',
  'dondra': 'Matara', 'morawaka': 'Matara', 'thihagoda': 'Matara', 'athuraliya': 'Matara',

  // Ratnapura
  'ratnapura': 'Ratnapura', 'embilipitiya': 'Ratnapura', 'balangoda': 'Ratnapura',
  'pelmadulla': 'Ratnapura', 'kuruwita': 'Ratnapura', 'eheliyagoda': 'Ratnapura',
  'kahawatta': 'Ratnapura', 'rakwana': 'Ratnapura', 'kalawana': 'Ratnapura',
  'godakawela': 'Ratnapura', 'kolonna': 'Ratnapura', 'nivithigala': 'Ratnapura',

  // Kegalle
  'kegalle': 'Kegalle', 'mawanella': 'Kegalle', 'warakapola': 'Kegalle', 'ruwanwella': 'Kegalle',
  'yatiyantota': 'Kegalle', 'rambukkana': 'Kegalle', 'dehiowita': 'Kegalle', 'deraniyagala': 'Kegalle',
  'galigamuwa': 'Kegalle', 'kitulgala': 'Kegalle', 'aranayaka': 'Kegalle', 'bulathkohupitiya': 'Kegalle',

  // Matale
  'matale': 'Matale', 'dambulla': 'Matale', 'galewela': 'Matale', 'sigiriya': 'Matale',
  'ukuwela': 'Matale', 'palapathwela': 'Matale', 'yatawatta': 'Matale', 'rattota': 'Matale',
  'pallepola': 'Matale', 'naula': 'Matale',

  // Nuwara Eliya
  'nuwara eliya': 'Nuwara Eliya', 'nuwara-eliya': 'Nuwara Eliya', 'hatton': 'Nuwara Eliya',
  'kotagala': 'Nuwara Eliya', 'talawakele': 'Nuwara Eliya', 'talawakelle': 'Nuwara Eliya',
  'walapane': 'Nuwara Eliya', 'ragala': 'Nuwara Eliya', 'norwood': 'Nuwara Eliya',
  'maskeliya': 'Nuwara Eliya', 'ginigathena': 'Nuwara Eliya', 'hanguranketha': 'Nuwara Eliya',
  'pundaluoya': 'Nuwara Eliya',

  // Badulla
  'badulla': 'Badulla', 'bandarawela': 'Badulla', 'welimada': 'Badulla', 'hali-ela': 'Badulla',
  'hali ela': 'Badulla', 'mahiyanganaya': 'Badulla', 'passara': 'Badulla', 'diyatalawa': 'Badulla',
  'ella': 'Badulla', 'haputale': 'Badulla', 'haliela': 'Badulla', 'demodara': 'Badulla',

  // Anuradhapura
  'anuradhapura': 'Anuradhapura', 'kekirawa': 'Anuradhapura', 'medawachchiya': 'Anuradhapura',
  'eppawala': 'Anuradhapura', 'tambuttegama': 'Anuradhapura', 'thambuttegama': 'Anuradhapura',
  'mihintale': 'Anuradhapura', 'galnewa': 'Anuradhapura', 'nochchiyagama': 'Anuradhapura',
  'galenbindunuwewa': 'Anuradhapura', 'habarana': 'Anuradhapura', 'talawa': 'Anuradhapura',

  // Polonnaruwa
  'polonnaruwa': 'Polonnaruwa', 'kaduruwela': 'Polonnaruwa', 'hingurakgoda': 'Polonnaruwa',
  'medirigiriya': 'Polonnaruwa', 'aralaganwila': 'Polonnaruwa',

  // Puttalam
  'puttalam': 'Puttalam', 'chilaw': 'Puttalam', 'wennappuwa': 'Puttalam', 'marawila': 'Puttalam',
  'dankotuwa': 'Puttalam', 'anamaduwa': 'Puttalam', 'nattandiya': 'Puttalam', 'madampe': 'Puttalam',
  'mahawewa': 'Puttalam', 'kalpitiya': 'Puttalam',

  // Hambantota
  'hambantota': 'Hambantota', 'tangalle': 'Hambantota', 'beliatta': 'Hambantota',
  'tissamaharama': 'Hambantota', 'ambalantota': 'Hambantota', 'walasmulla': 'Hambantota',
  'weeraketiya': 'Hambantota', 'suriyawewa': 'Hambantota', 'middeniya': 'Hambantota',

  // Batticaloa
  'batticaloa': 'Batticaloa', 'kattankudy': 'Batticaloa', 'eravur': 'Batticaloa',
  'valachchenai': 'Batticaloa', 'kaluwanchikudy': 'Batticaloa', 'chenkalady': 'Batticaloa',

  // Ampara
  'ampara': 'Ampara', 'kalmunai': 'Ampara', 'akkaraipattu': 'Ampara',
  'sammanthurai': 'Ampara', 'sainthamaruthu': 'Ampara', 'pottuvil': 'Ampara',

  // Trincomalee
  'trincomalee': 'Trincomalee', 'kinniya': 'Trincomalee', 'kantale': 'Trincomalee',
  'muttur': 'Trincomalee', 'china bay': 'Trincomalee',

  // Jaffna
  'jaffna': 'Jaffna', 'nallur': 'Jaffna', 'chavakachcheri': 'Jaffna', 'chunnakam': 'Jaffna',
  'point pedro': 'Jaffna', 'vaddukoddai': 'Jaffna', 'valvettithurai': 'Jaffna', 'kopay': 'Jaffna',
  'karainagar': 'Jaffna',

  // Northern / Uva / Sabaragamuwa
  'kilinochchi': 'Kilinochchi', 'mannar': 'Mannar', 'vavuniya': 'Vavuniya',
  'mullaitivu': 'Mullaitivu', 'moneragala': 'Moneragala', 'wellawaya': 'Moneragala',
  'buttala': 'Moneragala', 'bibile': 'Moneragala', 'kataragama': 'Moneragala',
};

const formatWord = (str) => {
  if (!str) return '';
  return str
    .split(' ')
    .map(word =>
      word
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('-')
    )
    .join(' ');
};

/**
 * Extract location from Ikman detail page subtitle
 * e.g. "Posted on 05 Sep 11:28 pm, Pathahewaheta, Kandy" -> "Pathahewaheta, Kandy"
 * or "Posted on 01 Sep 10:00 am, Kandy" -> "Kandy"
 */
function extractIkmanLocation(subText) {
  if (!subText) return null;

  let cleaned = subText
    .replace(/\d+\s*views.*$/i, '')
    .replace(/MEMBER.*$/i, '')
    .replace(/Verified.*$/i, '')
    .trim();

  const postedMatch = cleaned.match(/Posted on\s+[^,]+,\s*(.+)$/i);
  if (postedMatch) {
    const locPart = postedMatch[1].trim();
    const parts = locPart.split(',').map(s => s.trim()).filter(Boolean);

    if (parts.length >= 2) {
      const city = formatWord(parts[0]);
      let districtRaw = parts[1].replace(/\d+.*$/, '').trim();
      const matchedDist = SRI_LANKA_DISTRICTS.find(d => districtRaw.toLowerCase() === d.toLowerCase());
      const district = matchedDist || formatWord(districtRaw);
      return `${city}, ${district}`;
    } else if (parts.length === 1) {
      let districtRaw = parts[0].replace(/\d+.*$/, '').trim();
      const matchedDist = SRI_LANKA_DISTRICTS.find(d => districtRaw.toLowerCase() === d.toLowerCase());
      return matchedDist || formatWord(districtRaw);
    }
  }

  return null;
}

/**
 * Extract location for Riyasevana from URL slug or card meta text
 * e.g. URL has "-sale-nittambuwa-12266804" -> "Nittambuwa, Gampaha"
 */
function extractRiyasevanaLocation(url, metaText = '') {
  let rawCity = '';

  // 1. Try URL slug first
  if (url) {
    const match = url.match(/-sale-([a-z0-9-]+)-\d+/i);
    if (match) {
      rawCity = match[1].replace(/-/g, ' ').trim().toLowerCase();
    }
  }

  // 2. Fall back to metaText (e.g. from .v-card-meta)
  if (!rawCity && metaText) {
    const firstPart = metaText.split(/[·•|]/)[0].trim().toLowerCase();
    if (firstPart && firstPart.length > 2) {
      rawCity = firstPart;
    }
  }

  if (!rawCity) return null;

  const district = TOWN_TO_DISTRICT[rawCity];
  const formattedCity = formatWord(rawCity);

  if (district) {
    if (formattedCity.toLowerCase() === district.toLowerCase()) {
      return district;
    }
    return `${formattedCity}, ${district}`;
  }

  const matchedDist = SRI_LANKA_DISTRICTS.find(d => rawCity === d.toLowerCase());
  if (matchedDist) return matchedDist;

  return formattedCity;
}

/**
 * Normalizes any existing location string, removing trailing garbage
 */
function normalizeLocation(loc) {
  if (!loc || loc === 'Sri Lanka') return 'Sri Lanka';

  let cleaned = loc
    .replace(/,\s*Three\s*Wheelers/gi, '')
    .replace(/Three\s*Wheelers/gi, '')
    .replace(/Rs\s*[\d,]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If already "City, District" format
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const city = formatWord(parts[0]);
      const distRaw = parts[1];
      const matchedDist = SRI_LANKA_DISTRICTS.find(d => distRaw.toLowerCase() === d.toLowerCase());
      const district = matchedDist || formatWord(distRaw);
      return `${city}, ${district}`;
    }
  }

  // Single word/town - check if it maps to district
  const lower = cleaned.toLowerCase();
  if (TOWN_TO_DISTRICT[lower]) {
    const district = TOWN_TO_DISTRICT[lower];
    const formattedCity = formatWord(cleaned);
    if (formattedCity.toLowerCase() === district.toLowerCase()) {
      return district;
    }
    return `${formattedCity}, ${district}`;
  }

  const matchedDist = SRI_LANKA_DISTRICTS.find(d => lower === d.toLowerCase());
  if (matchedDist) return matchedDist;

  return formatWord(cleaned);
}

module.exports = {
  SRI_LANKA_DISTRICTS,
  TOWN_TO_DISTRICT,
  extractIkmanLocation,
  extractRiyasevanaLocation,
  normalizeLocation
};
