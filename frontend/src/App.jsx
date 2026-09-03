import React, { useState, useEffect } from 'react';
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
  Layers
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api/listings';

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
  const [stats, setStats] = useState({ totalListings: 0, ikmanCount: 0, riyasevanaCount: 0, todayCount: 0, priceDropCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [priceDropOnly, setPriceDropOnly] = useState(false);

  const fetchData = async () => {
    try {
      let url = `${API_BASE_URL}?limit=200`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (sourceFilter) url += `&source=${encodeURIComponent(sourceFilter)}`;
      if (maxPrice) url += `&maxPrice=${maxPrice}`;
      if (timeRange) url += `&timeRange=${timeRange}`;
      if (priceDropOnly) url += `&priceDropOnly=true`;

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
    } catch (err) {
      console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [search, sourceFilter, maxPrice, timeRange, priceDropOnly]);

  const displayedListings = priceDropOnly
    ? listings.filter((item) => item.hasPriceDrop === true)
    : listings;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
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
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse-slow shadow-sm shadow-emerald-500"></span>
          <span>LIVE MONITORED (5 MIN AUTO-REFRESH)</span>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
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
      </div>

      {/* Time Range Filter Bar (Today / Week / Month / All Time) */}
      <div className="bg-[#151c2c] border border-[#232f48] p-2.5 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold px-2">
          <Calendar className="w-4 h-4 text-blue-400" />
          <span>Post Date Filter:</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setTimeRange('today')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              timeRange === 'today'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#232f48]'
            }`}
          >
            📅 Today (අද)
          </button>
          <button
            onClick={() => setTimeRange('week')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              timeRange === 'week'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#232f48]'
            }`}
          >
            🗓️ This Week (මේ සතිය)
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              timeRange === 'month'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#232f48]'
            }`}
          >
            🗓️ This Month (මේ මාසය)
          </button>
          <button
            onClick={() => setTimeRange('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              timeRange === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#232f48]'
            }`}
          >
            🌐 All Time (සියල්ල)
          </button>
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

        <select
          className="bg-[#0b0f19] border border-[#232f48] text-sm text-slate-200 px-3.5 py-2.5 rounded-xl outline-none focus:border-blue-500"
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="ikman.lk">ikman.lk</option>
          <option value="riyasevana.com">riyasevana.com</option>
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
          <span>Showing <strong className="text-white">{displayedListings.length}</strong> of <strong className="text-white">{stats.totalListings}</strong> Total Three-Wheel Deals</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {displayedListings.map((item, index) => {
                  const imageSrc = (item.originalImages && item.originalImages.length > 0)
                    ? item.originalImages[0]
                    : null;
                  const isNewestTop = index === 0;

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
                    item.source === 'ikman.lk' 
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

                  <div className="flex flex-col gap-1.5 text-xs text-slate-400 border-t border-[#232f48] pt-3 mt-auto">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.location}</span>
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
                      <span>View Ad</span>
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
      )}
    </div>
  );
}
