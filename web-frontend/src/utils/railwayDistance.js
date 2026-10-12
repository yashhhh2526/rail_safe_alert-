/**
 * Railway Route Distance Utility (Frontend)
 *
 * Implements official Indian Railways route distance calculations:
 * 1. Uses actual railway track kilometrage rather than straight-line GPS.
 * 2. Populates for every station:
 *    - distanceFromPreviousKm (0 at origin, >= 0 along route)
 *    - cumulativeDistanceKm (monotonically increasing from origin)
 *    - distanceRemainingKm (totalRouteDistanceKm - cumulativeDistanceKm, exactly 0 at destination)
 * 3. Supports known railway track segments and curved track alignment tortuosity factor.
 * 4. Recalculates dynamic remaining distance for user-selected destination stations.
 */

// Known official Indian Railways track distances (in km)
export const KNOWN_RAILWAY_SEGMENTS = {
  // Bengaluru urban & regional corridor
  'SBC-BNC': 4.2,
  'BNC-SBC': 4.2,
  'BNC-KJM': 10.0,
  'KJM-BNC': 10.0,
  'SBC-YNK': 18.0,
  'YNK-SBC': 18.0,
  'BNC-YNK': 13.8,
  'YNK-BNC': 13.8,
  'KJM-WFD': 9.2,
  'WFD-KJM': 9.2,
  'WFD-BWT': 44.0,
  'BWT-WFD': 44.0,
  'BWT-JTJ': 75.0,
  'JTJ-BWT': 75.0,
  'JTJ-KPD': 84.0,
  'KPD-JTJ': 84.0,
  'KPD-AJJ': 61.0,
  'AJJ-KPD': 61.0,
  'AJJ-MAS': 69.0,
  'MAS-AJJ': 69.0,
  'SBC-KGI': 12.2,
  'KGI-SBC': 12.2,
  'KGI-BID': 17.6,
  'BID-KGI': 17.6,
  'BID-RMGM': 15.0,
  'RMGM-BID': 15.0,
  'RMGM-CPT': 11.0,
  'CPT-RMGM': 11.0,
  'CPT-MAD': 18.0,
  'MAD-CPT': 18.0,
  'MAD-MYA': 19.0,
  'MYA-MAD': 19.0,
  'MYA-PANP': 26.0,
  'PANP-MYA': 26.0,
  'PANP-MYS': 19.0,
  'MYS-PANP': 19.0,

  // Delhi - Kanpur - Prayagraj - Varanasi (Vande Bharat / Rajdhani route)
  'NDLS-GZB': 25.6,
  'GZB-NDLS': 25.6,
  'GZB-ALJN': 105.4,
  'ALJN-GZB': 105.4,
  'ALJN-TDL': 78.0,
  'TDL-ALJN': 78.0,
  'TDL-ETW': 92.0,
  'ETW-TDL': 92.0,
  'ETW-PHD': 56.0,
  'PHD-ETW': 56.0,
  'PHD-CNB': 83.0,
  'CNB-PHD': 83.0,
  'NDLS-CNB': 440.0,
  'CNB-NDLS': 440.0,
  'CNB-ON': 17.0,
  'ON-CNB': 17.0,
  'ON-LJN': 55.0,
  'LJN-ON': 55.0,
  'CNB-PRYJ': 195.0,
  'PRYJ-CNB': 195.0,
  'PRYJ-JNH': 67.0,
  'JNH-PRYJ': 67.0,
  'JNH-BSB': 57.0,
  'BSB-JNH': 57.0,
  'PRYJ-BSB': 124.0,
  'BSB-PRYJ': 124.0,

  // Mumbai - Vadodara - Kota - Delhi (Rajdhani corridor)
  'MMCT-BVI': 30.0,
  'BVI-MMCT': 30.0,
  'BVI-ST': 233.0,
  'ST-BVI': 233.0,
  'ST-BRC': 129.0,
  'BRC-ST': 129.0,
  'BRC-RTM': 261.0,
  'RTM-BRC': 261.0,
  'RTM-KOTA': 267.0,
  'KOTA-RTM': 267.0,
  'KOTA-SWM': 108.0,
  'SWM-KOTA': 108.0,
  'KOTA-MTJ': 324.0,
  'MTJ-KOTA': 324.0,
  'MTJ-NZM': 133.0,
  'NZM-MTJ': 133.0,
  'NZM-NDLS': 7.0,
  'NDLS-NZM': 7.0
};

// Geometric base helper for railway curvature estimation
function haversineDistKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimates railway track distance between two stations when no official
 * timetable distance is provided. Applies Indian Railways track curvature factor (~1.28x).
 */
export function estimateRailwayStepDistance(st1, st2) {
  const code1 = (st1.code || st1.stationCode || '').toUpperCase().trim();
  const code2 = (st2.code || st2.stationCode || '').toUpperCase().trim();

  // 1. Check known track segment table
  if (code1 && code2) {
    const key = `${code1}-${code2}`;
    if (KNOWN_RAILWAY_SEGMENTS[key]) {
      return KNOWN_RAILWAY_SEGMENTS[key];
    }
  }

  // 2. Track curvature applied to station coordinates
  const coords1 = st1.coords || { lat: st1.latitude ?? st1.lat, lng: st1.longitude ?? st1.lng };
  const coords2 = st2.coords || { lat: st2.latitude ?? st2.lat, lng: st2.longitude ?? st2.lng };

  if (coords1 && coords2 && coords1.lat != null && coords2.lat != null) {
    const straightLine = haversineDistKm(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
    // Real Indian Railways track alignment curvature factor
    const trackFactor = 1.28;
    return Math.max(1.0, Math.round(straightLine * trackFactor * 10) / 10);
  }

  // Safe fallback minimum inter-station spacing
  return 25.0;
}

/**
 * Extracts candidate cumulative distance from any standard railway data field
 */
function extractCumulativeCandidate(s) {
  if (!s || typeof s !== 'object') return null;
  const keys = [
    'cumulativeDistanceKm',
    'distanceFromOrigin',
    'distanceKm',
    'railwayDistanceKm',
    'distance_km',
    'routeDistance',
    'stationDistance',
    'distance',
    'km',
    'kilometer',
    'kilometre'
  ];

  for (const k of keys) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== '') {
      const val = Number(s[k]);
      if (!isNaN(val) && val >= 0) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Extracts candidate distance from previous station
 */
function extractStepCandidate(s) {
  if (!s || typeof s !== 'object') return null;
  const keys = [
    'distanceFromPreviousKm',
    'distanceFromPrevious',
    'intervalKm'
  ];

  for (const k of keys) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== '') {
      const val = Number(s[k]);
      if (!isNaN(val) && val > 0) {
        return val;
      }
    }
  }

  return null;
}

/**
 * Validates, normalizes, and populates complete railway route kilometrage for all stations:
 * - distanceFromPreviousKm (0 at origin, >= 0 along route)
 * - cumulativeDistanceKm (strictly non-decreasing, increasing along route)
 * - distanceRemainingKm (totalRouteDistanceKm - cumulativeDistanceKm, 0 at destination)
 */
export function processStationDistances(stations) {
  if (!Array.isArray(stations) || stations.length === 0) {
    return [];
  }

  const n = stations.length;
  if (n === 1) {
    return [
      {
        ...stations[0],
        distanceFromPreviousKm: 0,
        distanceFromPrevious: 0,
        cumulativeDistanceKm: 0,
        distanceFromOrigin: 0,
        distanceRemainingKm: 0,
        distanceRemaining: 0
      }
    ];
  }

  // Step 1: Detect whether stations provide cumulative distances or step/inter-station distances
  const rawCandidates = stations.map(extractCumulativeCandidate);
  rawCandidates[0] = 0; // Origin is always 0 km

  // Check if non-null candidate values are strictly cumulative (never drop)
  let appearsCumulative = true;
  let lastVal = 0;
  let nonNullCount = 0;

  for (let i = 1; i < n; i++) {
    const val = rawCandidates[i];
    if (val !== null) {
      nonNullCount++;
      if (val < lastVal) {
        appearsCumulative = false;
        break;
      }
      lastVal = val;
    }
  }

  const cumulativeDistances = new Array(n).fill(null);
  cumulativeDistances[0] = 0;

  if (appearsCumulative && nonNullCount >= 1) {
    // We have at least some cumulative kilometrage
    for (let i = 0; i < n; i++) {
      if (rawCandidates[i] !== null) {
        cumulativeDistances[i] = rawCandidates[i];
      }
    }

    // Fill in any gaps
    for (let i = 1; i < n; i++) {
      if (cumulativeDistances[i] === null || cumulativeDistances[i] < cumulativeDistances[i - 1]) {
        const step = extractStepCandidate(stations[i]);
        if (step !== null) {
          cumulativeDistances[i] = Math.round((cumulativeDistances[i - 1] + step) * 10) / 10;
        } else {
          const estimated = estimateRailwayStepDistance(stations[i - 1], stations[i]);
          cumulativeDistances[i] = Math.round((cumulativeDistances[i - 1] + estimated) * 10) / 10;
        }
      }
    }
  } else {
    // Values provided are inter-station / step distances, accumulate them
    let running = 0;
    for (let i = 1; i < n; i++) {
      let step = extractStepCandidate(stations[i]);
      if (step === null) {
        step = rawCandidates[i];
      }
      if (step === null || step <= 0) {
        step = estimateRailwayStepDistance(stations[i - 1], stations[i]);
      }
      running += step;
      cumulativeDistances[i] = Math.round(running * 10) / 10;
    }
  }

  // Enforce validation: cumulative distance must be non-decreasing
  for (let i = 1; i < n; i++) {
    if (cumulativeDistances[i] < cumulativeDistances[i - 1]) {
      cumulativeDistances[i] = cumulativeDistances[i - 1];
    }
  }

  const totalRouteDistance = Math.round(cumulativeDistances[n - 1] * 10) / 10;

  // Step 2: Build final station array with all fields populated
  return stations.map((st, i) => {
    const fromOrigin = Math.round(cumulativeDistances[i] * 10) / 10;
    const fromPrev = i === 0 ? 0 : Math.round((cumulativeDistances[i] - cumulativeDistances[i - 1]) * 10) / 10;
    const remaining = i === n - 1 ? 0 : Math.max(0, Math.round((totalRouteDistance - fromOrigin) * 10) / 10);

    return {
      ...st,
      distanceFromPreviousKm: fromPrev,
      distanceFromPrevious: fromPrev,
      cumulativeDistanceKm: fromOrigin,
      distanceFromOrigin: fromOrigin,
      distanceRemainingKm: remaining,
      distanceRemaining: remaining
    };
  });
}

/**
 * Dynamically recalculates remaining distance based on current train position
 * and the user's selected destination station (Part 9).
 */
export function calculateRemainingDistance(stations, selectedIndex, currentPositionOrStation) {
  if (!Array.isArray(stations) || stations.length === 0) return 0;
  
  const targetIndex = selectedIndex >= 0 && selectedIndex < stations.length ? selectedIndex : stations.length - 1;
  const targetStation = stations[targetIndex];
  const targetCumulative = targetStation?.cumulativeDistanceKm ?? targetStation?.distanceFromOrigin ?? 0;

  let currentCumulative = 0;
  if (currentPositionOrStation) {
    if (typeof currentPositionOrStation === 'number') {
      currentCumulative = currentPositionOrStation;
    } else if (typeof currentPositionOrStation === 'object') {
      currentCumulative = currentPositionOrStation.cumulativeDistanceKm ?? currentPositionOrStation.distanceFromOrigin ?? 0;
    }
  }

  return Math.max(0, Math.round((targetCumulative - currentCumulative) * 10) / 10);
}

export default {
  KNOWN_RAILWAY_SEGMENTS,
  estimateRailwayStepDistance,
  processStationDistances,
  calculateRemainingDistance
};
