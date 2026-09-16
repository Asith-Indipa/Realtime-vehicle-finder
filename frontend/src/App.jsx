import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Flame, 
  Search, 
  ExternalLink, 
  Share2, 
  Clock, 
  MapPin, 
  RefreshCw,
  Calendar,
  Sparkles,
  Layers,
  MessageSquare,
  QrCode,
  CheckCircle2,
  X,
  Smartphone,
  User,
  Lock,
  Mail,
  Settings,
  LogOut,
  Bell,
  ShieldCheck,
  Filter,
  Tag,
  Phone
} from 'lucide-react';

import { DEFAULT_SRI_LANKA_HIERARCHY } from './utils/locationData';

const BACKEND_HOST = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  ? `http://${window.location.hostname}:5000`
  : 'http://localhost:5000';

const API_BASE_URL = `${BACKEND_HOST}/api/listings`;
const WHATSAPP_STATUS_URL = `${BACKEND_HOST}/api/whatsapp/status`;
const AUTH_API_URL = `${BACKEND_HOST}/api/auth`;

/**
 * Dynamically calculates human-readable relative time from a Date/timestamp.
 * This runs LIVE on every render, so it always shows the correct elapsed time
 * matching what ikman.lk / riyasewana.com display.
 */
const getRelativeTime = (timestamp) => {
  if (!timestamp) return 'Recently posted';
  const now = new Date();
  const posted = new Date(timestamp);
  const diffMs = now - posted;
  if (diffMs < 0) return 'Just now';

  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  const weeks = Math.floor(days / 7);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (weeks < 5) return `${weeks}w ago`;
  return posted.toLocaleDateString();
};

export default function App() {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState({ totalListings: 0, ikmanCount: 0, riyasevanaCount: 0, facebookCount: 0, todayCount: 0, priceDropCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [priceDropOnly, setPriceDropOnly] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [locationsList, setLocationsList] = useState([]);
  const [locationHierarchy, setLocationHierarchy] = useState(DEFAULT_SRI_LANKA_HIERARCHY);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeDistrict, setActiveDistrict] = useState('Colombo');
  const [locationSearch, setLocationSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(24);
  const [whatsappInfo, setWhatsappInfo] = useState({ status: 'INITIALIZING', qrCodeImageUrl: null, ready: false });
  const [showQrModal, setShowQrModal] = useState(false);
  const [restartingWa, setRestartingWa] = useState(false);
  const [loggingOutWa, setLoggingOutWa] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sourceFilter, maxPrice, timeRange, priceDropOnly, selectedLocation, selectedModel, sortBy]);

  // Authentication & Profile States
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile Settings States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSubscribed, setProfileSubscribed] = useState(true);
  const [profileAlertLocation, setProfileAlertLocation] = useState('all');
  const [profileAlertModel, setProfileAlertModel] = useState('all');
  const [profileAlertMaxPrice, setProfileAlertMaxPrice] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const handleRestartWhatsApp = async () => {
    setRestartingWa(true);
    try {
      await fetch(`${BACKEND_HOST}/api/whatsapp/restart`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setRestartingWa(false), 3000);
    }
  };

  const handleLogoutWhatsApp = async () => {
    setLoggingOutWa(true);
    try {
      await fetch(`${BACKEND_HOST}/api/whatsapp/logout`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setLoggingOutWa(false), 3000);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const endpoint = authTab === 'login' ? `${AUTH_API_URL}/login` : `${AUTH_API_URL}/register`;
      const payload = authTab === 'login' 
        ? { email: authEmail, password: authPassword }
        : { name: authName, email: authEmail, password: authPassword, whatsappNumber: authPhone };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Authentication failed');
      }

      // Save user & token
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.token);
      setCurrentUser(data.user);
      setToken(data.token);

      // Close modal & reset form
      setShowAuthModal(false);
      setAuthPassword('');
      setAuthError('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogoutUser = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setCurrentUser(null);
    setToken('');
    setShowProfileModal(false);
  };

  const handleOpenProfile = () => {
    if (!currentUser) return;
    setProfileName(currentUser.name || '');
    setProfilePhone(currentUser.whatsappNumber || '');
    setProfileSubscribed(currentUser.isSubscribed !== false);
    setProfileAlertLocation(currentUser.alertLocation || 'all');
    setProfileAlertModel(currentUser.alertModel || 'all');
    setProfileAlertMaxPrice(currentUser.alertMaxPrice || '');
    setProfileSuccess('');
    setProfileError('');
    setShowProfileModal(true);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const res = await fetch(`${AUTH_API_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName,
          whatsappNumber: profilePhone,
          isSubscribed: profileSubscribed,
          alertLocation: profileAlertLocation,
          alertModel: profileAlertModel,
          alertMaxPrice: profileAlertMaxPrice ? Number(profileAlertMaxPrice) : null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to update profile');
      }

      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.token) localStorage.setItem('token', data.token);
      setCurrentUser(data.user);
      if (data.token) setToken(data.token);

      setProfileSuccess('✅ Profile & WhatsApp settings updated successfully!');
      setTimeout(() => setShowProfileModal(false), 1500);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/locations/hierarchy`);
      const data = await res.json();
      if (data.success && data.hierarchy) {
        setLocationHierarchy((prev) => ({
          ...DEFAULT_SRI_LANKA_HIERARCHY,
          ...data.hierarchy,
        }));
      }
    } catch (e) {
      console.error('Failed to fetch location hierarchy:', e);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const handleOpenLocationModal = () => {
    fetchLocations();
    setShowLocationModal(true);
  };

  const handleLocationSearchChange = (val) => {
    setLocationSearch(val);
    if (!val || !val.trim()) return;
    const cleanSearch = val.toLowerCase().trim();

    // 1. Check if search term matches any district directly (e.g. "matara" -> Matara)
    const directDistrictMatch = Object.keys(locationHierarchy).find(
      (d) => d.toLowerCase() === cleanSearch || d.toLowerCase().startsWith(cleanSearch)
    );
    if (directDistrictMatch) {
      setActiveDistrict(directDistrictMatch);
      return;
    }

    // 2. Check if search term matches a town inside any district (e.g. "weligama" -> Matara)
    for (const [dist, towns] of Object.entries(locationHierarchy)) {
      if (towns && towns.some((t) => t.toLowerCase().includes(cleanSearch))) {
        setActiveDistrict(dist);
        break;
      }
    }
  };

  const fetchData = async () => {
    try {
      let url = `${API_BASE_URL}?limit=all`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (sourceFilter) url += `&source=${encodeURIComponent(sourceFilter)}`;
      if (maxPrice) url += `&maxPrice=${maxPrice}`;
      if (timeRange) url += `&timeRange=${timeRange}`;
      if (priceDropOnly) url += `&priceDropOnly=true`;
      if (selectedLocation && selectedLocation !== 'all') url += `&location=${encodeURIComponent(selectedLocation)}`;
      if (selectedModel && selectedModel !== 'all') url += `&modelType=${encodeURIComponent(selectedModel)}`;
      if (sortBy) url += `&sortBy=${encodeURIComponent(sortBy)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setListings(data.data);
      }

      const statsRes = await fetch(`${API_BASE_URL}/stats`);
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      // Fetch WhatsApp Status
      const waRes = await fetch(WHATSAPP_STATUS_URL);
      const waData = await waRes.json();
      if (waData.success) {
        setWhatsappInfo(waData);
        if (waData.ready && showQrModal) {
          setShowQrModal(false);
        }
      }
    } catch (err) {
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 20000);
    return () => clearInterval(interval);
  }, [search, sourceFilter, maxPrice, timeRange, priceDropOnly, selectedLocation, selectedModel, sortBy]);

  // Silent Real-Time Updates via Socket.io (0 delay, NO popups, NO audio)
  useEffect(() => {
    const socket = io(BACKEND_HOST, {
      transports: ['websocket', 'polling'],
    });

    socket.on('new_listing', (newAd) => {
      if (!newAd || !newAd._id) return;
      setListings((prev) => {
        if (prev.some((item) => item._id === newAd._id || (item.sourceUrl && item.sourceUrl === newAd.sourceUrl))) {
          return prev;
        }
        return [newAd, ...prev];
      });

      setStats((prev) => ({
        ...prev,
        totalListings: (prev.totalListings || 0) + 1,
        todayCount: (prev.todayCount || 0) + 1,
        ...(newAd.source === 'ikman.lk' ? { ikmanCount: (prev.ikmanCount || 0) + 1 } : {}),
        ...(newAd.source === 'riyasevana.com' ? { riyasevanaCount: (prev.riyasevanaCount || 0) + 1 } : {}),
        ...(newAd.source === 'facebook.com' ? { facebookCount: (prev.facebookCount || 0) + 1 } : {}),
      }));
    });

    socket.on('price_drop', (updatedAd) => {
      if (!updatedAd || !updatedAd._id) return;
      setListings((prev) =>
        prev.map((item) => {
          if (item._id === updatedAd._id || (item.sourceUrl && item.sourceUrl === updatedAd.sourceUrl)) {
            return { ...item, ...updatedAd };
          }
          return item;
        })
      );
      setStats((prev) => ({
        ...prev,
        priceDropCount: (prev.priceDropCount || 0) + 1,
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fast 1-second interval dedicated for instant WhatsApp QR scan & connection detection
  useEffect(() => {
    const checkWaStatus = async () => {
      try {
        const waRes = await fetch(WHATSAPP_STATUS_URL);
        const waData = await waRes.json();
        if (waData.success) {
          setWhatsappInfo(waData);
          if (waData.ready && showQrModal) {
            setShowQrModal(false);
          }
        }
      } catch (e) {}
    };

    // If not connected yet, check every 1 second for instant detection upon scanning
    const fastPoll = setInterval(checkWaStatus, whatsappInfo.ready ? 5000 : 1000);
    return () => clearInterval(fastPoll);
  }, [whatsappInfo.ready, showQrModal]);

  const displayedListings = priceDropOnly
    ? listings.filter((item) => item.hasPriceDrop === true)
    : listings;

  const totalPages = Math.ceil(displayedListings.length / itemsPerPage) || 1;
  const paginatedListings = displayedListings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 relative">
      {/* WhatsApp QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#151c2c] border border-[#232f48] rounded-3xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">WhatsApp Alert Connection</h2>
              <p className="text-xs text-slate-400 mt-1">
                {whatsappInfo.ready
                  ? 'Your WhatsApp is currently connected and sending instant 3-Wheel alerts!'
                  : 'Scan the QR code below using your mobile WhatsApp to activate instant alerts.'}
              </p>
            </div>

            {whatsappInfo.ready ? (
              <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-2xl p-6 text-center my-4">
                <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-3 animate-bounce" />
                <h3 className="text-lg font-bold text-emerald-300">Connected & Active</h3>
                <p className="text-xs text-slate-300 mt-2 mb-4">
                  All new three-wheel deals and price drops will be sent automatically to your WhatsApp!
                </p>
                <button
                  onClick={handleLogoutWhatsApp}
                  disabled={loggingOutWa}
                  className="bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {loggingOutWa ? 'Disconnecting...' : '🔴 Disconnect WhatsApp'}
                </button>
              </div>
            ) : whatsappInfo.qrCodeImageUrl ? (
              <div className="bg-[#0b0f19] border border-[#232f48] rounded-2xl p-5 text-center my-4 flex flex-col items-center">
                <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200">
                  <img
                    src={whatsappInfo.qrCodeImageUrl}
                    alt="WhatsApp QR Code"
                    className="w-56 h-56 object-contain"
                  />
                </div>
                <div className="flex items-center gap-2 mt-4 text-xs text-amber-400 font-medium bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping"></span>
                  <span>Waiting for scan...</span>
                </div>
              </div>
            ) : (
              <div className="bg-[#0b0f19] border border-[#232f48] rounded-2xl p-6 text-center my-4">
                <RefreshCw className={`w-8 h-8 text-blue-400 mx-auto mb-3 ${restartingWa ? 'animate-spin' : ''}`} />
                <p className="text-sm font-medium text-slate-300">
                  {restartingWa ? 'Generating New WhatsApp QR Code...' : 'QR Code Not Ready'}
                </p>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  If the QR code hasn't appeared yet, click below to generate a fresh QR Code instantly.
                </p>
                <button
                  onClick={handleRestartWhatsApp}
                  disabled={restartingWa}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50"
                >
                  {restartingWa ? 'Generating...' : '🔄 Generate New QR Code'}
                </button>
              </div>
            )}

            <div className="bg-[#0b0f19]/60 border border-[#232f48] rounded-xl p-4 text-xs text-slate-300 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-blue-400" />
                <span>How to connect:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-slate-400">
                <li>Open <strong>WhatsApp</strong> on your phone</li>
                <li>Tap <strong>Settings</strong> or <strong>Menu (⋮)</strong></li>
                <li>Select <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong></li>
                <li>Point your camera at this screen QR Code</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-5 border-b border-[#232f48] mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-500 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
            <Flame className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">
              3-Wheel Instant Deals
            </h1>
            <p className="text-xs text-slate-400">
              Real-Time ikman & Riyasevana Scraper & WhatsApp Alerts
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* User Auth & Settings Badge */}
          {currentUser ? (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleOpenProfile}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>{currentUser.name}</span>
                <Settings className="w-3.5 h-3.5 ml-1 text-slate-400 hover:text-white" />
              </button>
              <button
                onClick={handleLogoutUser}
                title="Logout"
                className="p-2 rounded-full text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition-all cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthError('');
                setShowAuthModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 transition-all cursor-pointer shadow-md shadow-blue-500/20"
            >
              <User className="w-3.5 h-3.5" />
              <span>Login / Register</span>
            </button>
          )}

          {/* WhatsApp Status Button */}
          <button
            onClick={() => setShowQrModal(true)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-md ${
              whatsappInfo.ready
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : whatsappInfo.qrCodeImageUrl
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 animate-pulse hover:bg-amber-500/20 ring-2 ring-amber-500/30'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {whatsappInfo.ready
                ? '🟢 WhatsApp Connected'
                : whatsappInfo.qrCodeImageUrl
                  ? '📱 Scan WhatsApp QR'
                  : '⏳ WhatsApp Loading...'}
            </span>
          </button>

          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-slow shadow-sm shadow-emerald-500"></span>
            <span>LIVE (5 MIN AUTO)</span>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-[#151c2c] border border-[#232f48] p-4 rounded-2xl flex flex-col">
          <span className="text-2xl font-bold text-white">{stats.todayCount}</span>
          <span className="text-xs text-slate-400">Deals Today (අද)</span>
        </div>
        <div className="bg-[#151c2c] border border-rose-500/30 bg-rose-950/20 p-4 rounded-2xl flex flex-col relative overflow-hidden">
          <span className="text-2xl font-bold text-rose-400">{stats.priceDropCount || 0}</span>
          <span className="text-xs text-rose-300 font-medium">Price Drops (මිල අඩු වූ)</span>
        </div>
        <div className="bg-[#151c2c] border border-[#232f48] p-4 rounded-2xl flex flex-col">
          <span className="text-2xl font-bold text-white">{stats.totalListings}</span>
          <span className="text-xs text-slate-400">Total Scraped</span>
        </div>
        <div className="bg-[#151c2c] border border-[#232f48] p-4 rounded-2xl flex flex-col">
          <span className="text-2xl font-bold text-white">{stats.ikmanCount}</span>
          <span className="text-xs text-slate-400">ikman.lk Ads</span>
        </div>
        <div className="bg-[#151c2c] border border-[#232f48] p-4 rounded-2xl flex flex-col">
          <span className="text-2xl font-bold text-white">{stats.riyasevanaCount}</span>
          <span className="text-xs text-slate-400">riyasevana Ads</span>
        </div>
        <div className="bg-[#151c2c] border border-blue-600/30 bg-blue-950/20 p-4 rounded-2xl flex flex-col">
          <span className="text-2xl font-bold text-blue-400">{stats.facebookCount || 0}</span>
          <span className="text-xs text-blue-300 font-medium">Facebook Ads</span>
        </div>
      </div>

      {/* Time Range Filter Bar (Today / This Week) */}
      <div className="bg-[#151c2c] border border-[#232f48] p-2.5 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold px-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>Post Date Filter:</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              timeRange === 'today'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-300 hover:text-white border-[#232f48]'
            }`}
          >
            📅 Today (අද)
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              timeRange === 'all' || timeRange === 'week'
                ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-300 hover:text-white border-[#232f48]'
            }`}
          >
            🗓️ This Week (මේ සතියේ 3-Wheelers)
          </button>

          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-semibold ml-1">
            ⚡ Auto 7-Day Cleanup Active
          </span>
        </div>
      </div>

      {/* Main Filter Bar */}
      <div className="bg-[#151c2c] border border-[#232f48] p-4 rounded-2xl mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] bg-[#0b0f19] border border-[#232f48] px-3.5 py-2.5 rounded-xl focus-within:border-blue-500 transition-colors">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            className="bg-transparent border-none outline-none text-sm text-white placeholder-slate-500 w-full"
            placeholder="Search title or location (e.g. Bajaj, Kandy)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <button
          onClick={() => setPriceDropOnly(!priceDropOnly)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            priceDropOnly
              ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white border-rose-500 shadow-lg shadow-rose-500/30 animate-pulse'
              : 'bg-[#0b0f19] text-rose-400 border-rose-900/60 hover:bg-rose-950/40'
          }`}
        >
          <span>📉</span>
          <span>Price Drops Only</span>
        </button>

        {/* Location Selector Trigger Button */}
        <button
          onClick={handleOpenLocationModal}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
            selectedLocation !== 'all'
              ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md shadow-blue-500/20'
              : 'bg-[#0b0f19] border-[#232f48] text-slate-200 hover:border-slate-600'
          }`}
        >
          <MapPin className="w-4 h-4 text-blue-400" />
          <span>{selectedLocation === 'all' ? '📍 All Locations' : `📍 ${selectedLocation}`}</span>
          {selectedLocation !== 'all' && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLocation('all');
              }}
              className="ml-1 p-0.5 rounded-full hover:bg-blue-500/30 text-slate-400 hover:text-white"
            >
              ✕
            </span>
          )}
        </button>

        {/* Engine / Model Type Filter */}
        <select
          className="bg-[#0b0f19] border border-[#232f48] text-sm text-slate-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <option value="all">🛺 All Models (මාදිලි)</option>
          <option value="2-stroke">⚡ 2-Stroke</option>
          <option value="4-stroke">🔥 4-Stroke</option>
          <option value="tvs-king">👑 TVS King</option>
          <option value="piaggio-ape">🛺 Piaggio Ape</option>
          <option value="bajaj-205">💪 Bajaj RE 205</option>
        </select>

        <select
          className="bg-[#0b0f19] border border-[#232f48] text-sm text-slate-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="ikman.lk">ikman.lk</option>
          <option value="riyasevana.com">riyasevana.com</option>
          <option value="facebook.com">facebook.com (Marketplace)</option>
        </select>

        <select
          className="bg-[#0b0f19] border border-[#232f48] text-sm text-slate-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
        >
          <option value="">Any Price</option>
          <option value="500000">Under Rs 500,000</option>
          <option value="800000">Under Rs 800,000</option>
          <option value="1000000">Under Rs 1,000,000</option>
        </select>

        {/* Sorting Options */}
        <select
          className="bg-[#0b0f19] border border-[#232f48] text-sm text-blue-400 font-semibold px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="latest">⏱️ Sort: Latest Deals</option>
          <option value="price_asc">💰 Price: Low → High</option>
          <option value="price_desc">💎 Price: High → Low</option>
          <option value="year_desc">📅 Year: Newest First</option>
          <option value="year_asc">📆 Year: Oldest First</option>
        </select>

        <button 
          onClick={fetchData} 
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Showing Count Indicator */}
      <div className="flex items-center justify-between mb-5 text-xs text-slate-400 px-1">
        <div className="flex items-center gap-1.5 font-medium">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Showing <strong className="text-white font-bold">{displayedListings.length}</strong> Total Three-Wheel Deals (සෑම ත්‍රීවීල් Ad එකක්ම)</span>
        </div>
      </div>

            {/* Main Deals Feed */}
            {loading ? (
              <div className="text-center py-16 bg-[#151c2c] border border-[#232f48] rounded-2xl text-slate-400">
                <p className="animate-pulse">Loading 3-Wheel deals...</p>
              </div>
            ) : displayedListings.length === 0 ? (
              <div className="text-center py-16 bg-[#151c2c] border border-dashed border-[#232f48] rounded-2xl text-slate-400">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {priceDropOnly ? 'No Price Drop listings found at the moment' : 'No Three-Wheel listings found'}
                </h3>
                <p className="text-sm">
                  {priceDropOnly 
                    ? 'When a seller reduces their listing price on ikman or riyasevana, it will appear here automatically.' 
                    : 'The backend scraper is continuously monitoring every 5 minutes for newly posted ads...'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {paginatedListings.map((item, index) => {
                    const imageSrc = (item.cloudinaryImages && item.cloudinaryImages.length > 0)
                      ? item.cloudinaryImages[0]
                      : ((item.originalImages && item.originalImages.length > 0) ? item.originalImages[0] : null);
                    const isNewestTop = currentPage === 1 && index === 0;

            return (
              <div 
                key={item._id || item.sourceUrl} 
                className={`bg-[#151c2c] border rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 shadow-lg shadow-black/20 relative ${
                  item.hasPriceDrop
                    ? 'border-rose-500 ring-2 ring-rose-500/40 bg-gradient-to-b from-[#1c1320] to-[#151c2c]'
                    : isNewestTop 
                      ? 'border-blue-500 ring-2 ring-blue-500/30' 
                      : 'border-[#232f48] hover:border-blue-500/40 hover:bg-[#1c263c]'
                }`}
              >
                {item.hasPriceDrop ? (
                  <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-rose-600 to-red-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-rose-600/40 animate-bounce">
                    <Flame className="w-3.5 h-3.5" />
                    <span>PRICE DROP - SAVE RS. {item.priceDropAmount ? item.priceDropAmount.toLocaleString() : ''}</span>
                  </div>
                ) : isNewestTop && (
                  <div className="absolute top-3 left-3 z-10 bg-gradient-to-r from-amber-500 to-red-500 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md shadow-amber-500/30 animate-pulse">
                    <Sparkles className="w-3 h-3" />
                    <span>LATEST DEAL</span>
                  </div>
                )}

                <div className="relative w-full h-48 bg-[#0d121d] overflow-hidden">
                  {imageSrc ? (
                    <img src={imageSrc} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                      <span>No Photo Available</span>
                    </div>
                  )}
                  <span className={`absolute top-3 right-3 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold border ${
                    item.source === 'facebook.com'
                      ? 'bg-blue-950/90 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/20'
                      : item.source === 'ikman.lk' 
                        ? 'bg-sky-950/80 text-sky-400 border-sky-600/40' 
                        : 'bg-rose-950/80 text-rose-400 border-rose-600/40'
                  }`}>
                    {item.source}
                  </span>
                </div>

                <div className="p-4 flex flex-col flex-1 gap-2.5">
                  <h3 className="text-base font-semibold text-white line-clamp-2 leading-snug">
                    {item.title}
                  </h3>
                  
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <div className="text-xl font-bold text-emerald-400">
                      {item.price ? item.price.replace(/(Rs\s?[\d,]+)\1/g, '$1') : 'Negotiable'}
                    </div>
                    {item.previousPrice && (
                      <span className="text-xs text-slate-500 line-through font-medium">
                        {item.previousPrice}
                      </span>
                    )}
                  </div>

                  {/* Seller Phone Badge if available */}
                  {item.phone && item.phone !== 'N/A' ? (
                    <div className="flex items-center justify-between bg-[#0b0f19] px-3 py-1.5 rounded-xl border border-[#232f48] text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <Phone className="w-3.5 h-3.5" />
                        <span>{item.phone}</span>
                      </div>
                      <a
                        href={`tel:${item.phone.replace(/[^0-9+]/g, '')}`}
                        className="text-[11px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded-lg transition-colors"
                      >
                        Call
                      </a>
                    </div>
                  ) : item.source === 'facebook.com' && (
                    <div className="flex items-center justify-between bg-blue-950/30 px-3 py-1.5 rounded-xl border border-blue-500/30 text-xs">
                      <div className="flex items-center gap-1.5 text-blue-400 font-semibold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat on Facebook</span>
                      </div>
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 font-bold px-2 py-0.5 rounded-lg transition-colors"
                      >
                        Chat
                      </a>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 text-xs text-slate-400 border-t border-[#232f48] pt-3 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-medium text-slate-300">
                        {item.location && item.location !== 'Sri Lanka'
                          ? item.location.replace(/,\s*Three\s*Wheelers/gi, '').trim()
                          : 'Sri Lanka'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sky-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{getRelativeTime(item.postedTimestamp)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2.5 mt-2">
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{item.source === 'facebook.com' ? 'View on FB' : 'View Ad'}</span>
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Check out this 3-Wheel deal: ${item.title} - ${item.price}\n${item.sourceUrl}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Controls Bar */}
        {displayedListings.length > 0 && (
          <div className="bg-[#151c2c] border border-[#232f48] rounded-2xl p-4 mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            {/* Status info */}
            <div className="text-xs text-slate-400 font-medium">
              Page <strong className="text-white font-bold">{currentPage}</strong> of <strong className="text-white font-bold">{totalPages}</strong>
              <span className="mx-2 text-slate-600">•</span>
              Showing <strong className="text-blue-400 font-semibold">{Math.min((currentPage - 1) * itemsPerPage + 1, displayedListings.length)} - {Math.min(currentPage * itemsPerPage, displayedListings.length)}</strong> of <strong className="text-white font-bold">{displayedListings.length}</strong> deals
            </div>

            {/* Page Number Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* First Page */}
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage(1);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0b0f19] border border-[#232f48] text-slate-300 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                « First
              </button>

              {/* Prev Page */}
              <button
                disabled={currentPage === 1}
                onClick={() => {
                  setCurrentPage((prev) => Math.max(prev - 1, 1));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0b0f19] border border-[#232f48] text-slate-300 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                ‹ Prev
              </button>

              {/* Dynamic Page Numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2)
                .map((page, index, arr) => {
                  const prevPage = arr[index - 1];
                  const showDots = prevPage && page - prevPage > 1;
                  return (
                    <React.Fragment key={page}>
                      {showDots && <span className="text-xs text-slate-500 px-1">...</span>}
                      <button
                        onClick={() => {
                          setCurrentPage(page);
                          window.scrollTo({ top: 300, behavior: 'smooth' });
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === page
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 border border-blue-500'
                            : 'bg-[#0b0f19] border border-[#232f48] text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              {/* Next Page */}
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0b0f19] border border-[#232f48] text-slate-300 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Next ›
              </button>

              {/* Last Page */}
              <button
                disabled={currentPage === totalPages}
                onClick={() => {
                  setCurrentPage(totalPages);
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0b0f19] border border-[#232f48] text-slate-300 hover:bg-blue-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Last »
              </button>
            </div>

            {/* Items Per Page Select */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Per Page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#0b0f19] border border-[#232f48] text-slate-200 text-xs px-2.5 py-1.5 rounded-lg outline-none cursor-pointer focus:border-blue-500"
              >
                <option value={12}>12 Ads</option>
                <option value={24}>24 Ads</option>
                <option value={48}>48 Ads</option>
                <option value={96}>96 Ads</option>
              </select>
            </div>
          </div>
        )}
      </>
      )}

      {/* Auth Modal (Login / Register) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131b2e] border border-[#232f48] rounded-3xl p-5 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-400 mb-3">
                <User className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-white">
                {authTab === 'login' ? 'Welcome Back!' : 'Create Account'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {authTab === 'login'
                  ? 'Log in to manage your instant WhatsApp 3-Wheel alert settings.'
                  : 'Register to receive instant WhatsApp deal notifications directly to your phone.'}
              </p>
            </div>

            {/* Auth Tabs */}
            <div className="flex bg-[#0b0f19] p-1 rounded-xl mb-5 border border-[#232f48]">
              <button
                onClick={() => { setAuthTab('login'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authTab === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Log In
              </button>
              <button
                onClick={() => { setAuthTab('register'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authTab === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs mb-4 text-center font-medium">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authTab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {authTab === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp Phone Number (Optional)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="94771234567"
                      className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Include country code without + (e.g. 94771234567)</p>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl text-xs transition-all shadow-lg shadow-blue-500/20 cursor-pointer disabled:opacity-50 mt-2"
              >
                {authLoading ? 'Processing...' : authTab === 'login' ? 'Log In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Profile & WhatsApp Settings Modal */}
      {showProfileModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#131b2e] border border-[#232f48] rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            
            {/* Fixed Header */}
            <div className="p-4 sm:p-5 border-b border-[#232f48] bg-[#0d121d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Profile & Alert Settings</h2>
                  <p className="text-[11px] text-slate-400">Configure instant WhatsApp 3-Wheel notifications</p>
                </div>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                {profileSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl text-xs text-center font-medium">
                    {profileSuccess}
                  </div>
                )}

                {profileError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs text-center font-medium">
                    {profileError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email Address (Account ID)</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                    <input
                      type="email"
                      disabled
                      value={currentUser.email}
                      className="w-full bg-[#0b0f19]/50 border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    WhatsApp Alert Number
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="94771234567"
                      className="w-full bg-[#0b0f19] border border-[#232f48] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Format: Country code + Number without + (e.g. <strong className="text-emerald-400">94771234567</strong>)
                  </p>
                </div>

                {/* WhatsApp Custom Alert Filters Section */}
                <div className="bg-[#0b0f19] border border-blue-500/30 rounded-2xl p-4 space-y-3.5 mt-3">
                  <div className="flex items-center gap-2 border-b border-[#232f48] pb-2">
                    <Filter className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">🎯 Custom WhatsApp Alert Filters</h4>
                  </div>

                  {/* Target Location Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>Target District / City for Alerts</span>
                    </label>
                    <div className="relative">
                      <select
                        value={profileAlertLocation}
                        onChange={(e) => setProfileAlertLocation(e.target.value)}
                        className="w-full bg-[#151c2c] border border-[#232f48] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-blue-500"
                      >
                        <option value="all">🌐 All Sri Lanka (ලංකාව පුරාම)</option>
                        <option value="Matara">📍 Matara (මාතර)</option>
                        <option value="Colombo">📍 Colombo (කොළඹ)</option>
                        <option value="Gampaha">📍 Gampaha (ගම්පහ)</option>
                        <option value="Kandy">📍 Kandy (මහනුවර)</option>
                        <option value="Kurunegala">📍 Kurunegala (කුරුණෑගල)</option>
                        <option value="Galle">📍 Galle (ගාල්ල)</option>
                        <option value="Kalutara">📍 Kalutara (කළුතර)</option>
                        <option value="Anuradhapura">📍 Anuradhapura (අනුරාධපුරය)</option>
                        <option value="Ratnapura">📍 Ratnapura (රත්නපුරය)</option>
                        <option value="Badulla">📍 Badulla (බදුල්ල)</option>
                        <option value="Kamburupitiya">🏙️ Kamburupitiya (කඹුරුපිටිය)</option>
                      </select>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Only receive WhatsApp messages for deals matching this location.
                    </p>
                  </div>

                  {/* Target Model Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      <span>Target Three-Wheel Model</span>
                    </label>
                    <select
                      value={profileAlertModel}
                      onChange={(e) => setProfileAlertModel(e.target.value)}
                      className="w-full bg-[#151c2c] border border-[#232f48] rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-amber-500"
                    >
                      <option value="all">🌐 All Models (සියලුම Models)</option>
                      <option value="4-stroke">🛺 4-Stroke (4-ස්ට්‍රෝක්)</option>
                      <option value="2-stroke">🛺 2-Stroke (2-ස්ට්‍රෝක්)</option>
                      <option value="tvs-king">🛺 TVS King</option>
                      <option value="piaggio-ape">🛺 Piaggio Ape</option>
                      <option value="bajaj-205">🛺 Bajaj RE 205</option>
                    </select>
                  </div>

                  {/* Target Max Price Filter */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Max Price Limit (Optional)</span>
                    </label>
                    <input
                      type="number"
                      value={profileAlertMaxPrice}
                      onChange={(e) => setProfileAlertMaxPrice(e.target.value)}
                      placeholder="e.g. 2000000 (Rs. 20 Lakhs)"
                      className="w-full bg-[#151c2c] border border-[#232f48] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Leave empty to receive alerts regardless of price.
                    </p>
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-[#232f48] rounded-xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-semibold text-white">Instant Deal Alerts</div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        Status: <strong className="text-emerald-400">ACTIVE ({profileAlertLocation === 'all' ? 'All Locations' : profileAlertLocation} • {profileAlertModel === 'all' ? 'All Models' : profileAlertModel})</strong>
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileSubscribed}
                    onChange={(e) => setProfileSubscribed(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                  />
                </div>
              </div>

              {/* Fixed Footer with Save Button */}
              <div className="p-4 border-t border-[#232f48] bg-[#0d121d]">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {profileLoading ? 'Saving...' : '💾 Save Profile Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Selector Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-[#151c2c] border border-[#232f48] rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#232f48] flex items-center justify-between bg-[#0b0f19]">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold text-white">Select Location (දිස්ත්‍රික්කය සහ නගරය)</h2>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Quick Search Input */}
            <div className="p-3 bg-[#111726] border-b border-[#232f48]">
              <div className="flex items-center gap-2 bg-[#0b0f19] border border-[#232f48] px-3.5 py-2 rounded-xl focus-within:border-blue-500">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="bg-transparent border-none outline-none text-xs text-white placeholder-slate-500 w-full"
                  placeholder="Search district or town (e.g. Matara, Weligama, Kandy, Maharagama)..."
                  value={locationSearch}
                  onChange={(e) => handleLocationSearchChange(e.target.value)}
                />
                {locationSearch && (
                  <button onClick={() => setLocationSearch('')} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Split View: Left Districts, Right Cities */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#232f48] overflow-hidden flex-1 min-h-[350px]">
              {/* Left Column: Main Districts */}
              <div className="overflow-y-auto max-h-[350px] md:max-h-[450px] p-2.5 space-y-1 bg-[#0d121f]">
                <button
                  onClick={() => {
                    setSelectedLocation('all');
                    setShowLocationModal(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    selectedLocation === 'all'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-[#151c2c] hover:text-white'
                  }`}
                >
                  <span>🌐 All of Sri Lanka (සියලුම දිස්ත්‍රික්ක)</span>
                </button>

                {Object.keys(locationHierarchy)
                  .filter((dist) =>
                    !locationSearch
                      ? true
                      : dist.toLowerCase().includes(locationSearch.toLowerCase()) ||
                        (locationHierarchy[dist] &&
                          locationHierarchy[dist].some((city) =>
                            city.toLowerCase().includes(locationSearch.toLowerCase())
                          ))
                  )
                  .map((dist) => {
                    const isActive = activeDistrict === dist;
                    return (
                      <button
                        key={dist}
                        onClick={() => setActiveDistrict(dist)}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                            : 'text-slate-300 hover:bg-[#151c2c] hover:text-white border border-transparent'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>📍 {dist}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">›</span>
                      </button>
                    );
                  })}
              </div>

              {/* Right Column: Sub-Locations / Cities for Active District */}
              <div className="overflow-y-auto max-h-[350px] md:max-h-[450px] p-3 bg-[#151c2c]">
                <div className="text-xs font-bold text-blue-400 mb-2 border-b border-[#232f48] pb-1.5 flex items-center justify-between">
                  <span>{activeDistrict} Sub-Locations (නගර)</span>
                </div>

                <div className="space-y-1">
                  <button
                    onClick={() => {
                      setSelectedLocation(activeDistrict);
                      setShowLocationModal(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedLocation === activeDistrict
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                    }`}
                  >
                    📍 All Ads in {activeDistrict} (මුළු දිස්ත්‍රික්කයම)
                  </button>

                  {(locationHierarchy[activeDistrict] || [])
                    .filter((c) => !c.startsWith('All in '))
                    .filter((c) => {
                      if (!locationSearch) return true;
                      const q = locationSearch.toLowerCase();
                      return c.toLowerCase().includes(q) || activeDistrict.toLowerCase().includes(q);
                    })
                    .map((city) => {
                      const isSelected = selectedLocation === city || selectedLocation === `${city}, ${activeDistrict}`;
                      return (
                        <button
                          key={city}
                          onClick={() => {
                            setSelectedLocation(city);
                            setShowLocationModal(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-blue-600 text-white font-bold border-blue-500'
                              : 'bg-[#0b0f19]/60 text-slate-300 hover:bg-blue-900/30 hover:text-white border-[#232f48]'
                          }`}
                        >
                          🏙️ {city}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
