/**
 * Client-Side Alternative Travel Service
 * Handles fetching multi-modal transit options (Trains, Buses, Cabs, Flights)
 * with robust in-flight deduplication, response validation, and resilient offline fallbacks.
 */

import { API_URL } from '../config/api.js';

// Cache and in-flight request tracking
const inFlightRequests = new Map();
const cache = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache for alternative travel routes

/**
 * Generates reliable offline fallback travel options when API is unreachable
 */
function generateOfflineFallback({ from, to, distance = 150 }) {
  const dist = Math.max(20, Math.round(Number(distance) || 150));
  const busMinMins = Math.round((dist / 48) * 60) + 20;
  const cabMinMins = Math.round((dist / 65) * 60) + 15;
  const trainMinMins = Math.round((dist / 72) * 60) + 15;

  const formatDur = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const options = [
    {
      id: 'fallback-train',
      category: 'Train',
      type: 'Express Train',
      title: 'Parallel Express / Superfast Service',
      operator: 'Indian Railways',
      route: `${from} → ${to}`,
      distanceKm: dist,
      durationMinutes: trainMinMins,
      durationFormatted: formatDur(trainMinMins),
      cost: {
        min: Math.round(Math.max(120, dist * 1.3)),
        max: Math.round(Math.max(380, dist * 2.3)),
        display: `₹${Math.round(Math.max(120, dist * 1.3))} - ₹${Math.round(Math.max(380, dist * 2.3))}`
      },
      availability: 'Regular Express Departures',
      badge: 'Rail Route',
      badgeColor: 'emerald',
      icon: '🚆',
      features: ['Reserved Sleeper & AC', 'Direct Rail Track', 'Catering Available'],
      bookingUrl: 'https://www.irctc.co.in',
      bookingLabel: 'Check IRCTC'
    },
    {
      id: 'fallback-bus-rtc',
      category: 'Interstate Bus',
      type: 'State Transport (RTC)',
      title: 'State Roadways Express RTC Bus',
      operator: 'State Transport Undertaking',
      route: `${from} Bus Stand → ${to} Central Stand`,
      distanceKm: dist,
      durationMinutes: busMinMins,
      durationFormatted: formatDur(busMinMins),
      cost: {
        min: Math.round(Math.max(100, dist * 1.4)),
        max: Math.round(Math.max(160, dist * 1.7)),
        display: `₹${Math.round(Math.max(100, dist * 1.4))} - ₹${Math.round(Math.max(160, dist * 1.7))}`
      },
      availability: 'Buses every 25-35 mins',
      badge: 'Economical',
      badgeColor: 'blue',
      icon: '🚌',
      features: ['Frequent Departures', 'Direct Highway Route', 'Walk-in Booking'],
      bookingUrl: 'https://www.redbus.in',
      bookingLabel: 'Book Bus'
    },
    {
      id: 'fallback-cab-sedan',
      category: 'Intercity Cab',
      type: 'Outstation Sedan',
      title: 'One-Way Outstation Cab (Dzire / Etios)',
      operator: 'Intercity Cab Partner',
      route: `${from} → ${to} (Direct Highway)`,
      distanceKm: dist,
      durationMinutes: cabMinMins,
      durationFormatted: formatDur(cabMinMins),
      cost: {
        min: Math.round(Math.max(650, dist * 11.5)),
        max: Math.round(Math.max(850, dist * 13.5)),
        display: `₹${Math.round(Math.max(650, dist * 11.5))} - ₹${Math.round(Math.max(850, dist * 13.5))}`
      },
      availability: 'Instant pickup (~15 mins)',
      badge: 'Fastest Departure',
      badgeColor: 'amber',
      icon: '🚖',
      features: ['Door-to-Door Private Cab', 'Air Conditioned', 'Instant Availability'],
      bookingUrl: 'https://www.makemytrip.com/cabs',
      bookingLabel: 'Book Cab'
    }
  ];

  return {
    route: { fromStation: from, toStation: to, distanceKm: dist },
    summary: {
      totalOptions: options.length,
      fastest: options[2].title,
      fastestDuration: options[2].durationFormatted,
      cheapest: options[1].title,
      cheapestCost: options[1].cost.display,
      recommendedCategory: 'Interstate Bus / Cab'
    },
    options,
    isOfflineFallback: true,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Fetches alternative travel options from backend API with validation and fallback
 * @param {object} params
 * @param {string} params.from
 * @param {string} params.to
 * @param {number|null} [params.distance]
 * @param {string} [params.currentTrain]
 * @param {boolean} [params.forceRefresh]
 * @returns {Promise<object>}
 */
export async function fetchAlternateTravelOptions({
  from,
  to,
  distance = null,
  currentTrain = null,
  forceRefresh = false
}) {
  const cleanFrom = String(from || '').trim();
  const cleanTo = String(to || '').trim();

  if (!cleanFrom || !cleanTo) {
    throw new Error('Both origin and destination stations are required to find alternate transit.');
  }

  const cacheKey = `${cleanFrom.toLowerCase()}__${cleanTo.toLowerCase()}__${distance || 0}`;

  // Return cached result if valid and not forcing
  if (!forceRefresh) {
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL_MS)) {
      return cachedEntry.data;
    }
  }

  // Deduplicate redundant in-flight promises
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const requestPromise = (async () => {
    const queryParams = new URLSearchParams({
      from: cleanFrom,
      to: cleanTo
    });

    if (distance && !isNaN(Number(distance))) {
      queryParams.append('distance', String(distance));
    }
    if (currentTrain) {
      queryParams.append('currentTrain', String(currentTrain));
    }

    const requestUrl = `${API_URL}/alternatives?${queryParams.toString()}`;

    try {
      const response = await fetch(requestUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Invalid response format: expected JSON payload.');
      }

      const json = await response.json();

      // Validate payload structure
      if (json && json.success && json.data && Array.isArray(json.data.options)) {
        cache.set(cacheKey, { timestamp: Date.now(), data: json.data });
        return json.data;
      }

      if (json && json.data && Array.isArray(json.data.options)) {
        cache.set(cacheKey, { timestamp: Date.now(), data: json.data });
        return json.data;
      }

      throw new Error(json?.msg || 'Unexpected alternative travel data format.');
    } catch (error) {
      console.warn('[AlternativeTravelService] Network notice, using resilient fallback generator:', error.message);
      // Generate guaranteed robust fallback data so UI never breaks
      const fallbackData = generateOfflineFallback({
        from: cleanFrom,
        to: cleanTo,
        distance: distance || 150
      });
      cache.set(cacheKey, { timestamp: Date.now(), data: fallbackData });
      return fallbackData;
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}

export default {
  fetchAlternateTravelOptions
};
