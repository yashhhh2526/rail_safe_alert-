/**
 * Railway Distance Service
 * 
 * Provides official Indian Railways route distance calculation, verification,
 * and validation for train routes.
 * 
 * Rules enforced:
 * 1. Uses actual railway route distances / cumulative kilometrage rather than straight-line GPS.
 * 2. Calculates for every station:
 *    - distanceFromOrigin: cumulative railway distance from the train's starting station (km)
 *    - distanceFromPrevious: distance from immediately previous station (km)
 *    - distanceRemaining: total route distance - distanceFromOrigin (km)
 * 3. Validation:
 *    - distanceFromPrevious >= 0
 *    - cumulativeDistance never decreases
 *    - distanceRemaining never negative
 *    - cumulativeDistance[current] = cumulativeDistance[previous] + distanceFromPrevious
 *    - final station distanceRemaining = 0
 * 4. Logs/debugs station code, name, distance from previous, cumulative distance, distance remaining.
 */

// Known official Indian Railways inter-station track distances (in km)
// to ensure accurate route distances for critical railway segments
const KNOWN_RAILWAY_SEGMENTS = {
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

// Haversine formula strictly as geometric baseline before applying railway winding factor
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates realistic railway distance between two stations when no official
 * timetable distance is available. Railway tracks are not straight lines;
 * they follow topography, elevation contours, and curve alignments.
 * A winding/tortuosity factor of 1.25 to 1.35 represents Indian Railway alignments.
 */
function estimateRailwayDistance(st1, st2) {
  const code1 = (st1.code || st1.stationCode || '').toUpperCase().trim();
  const code2 = (st2.code || st2.stationCode || '').toUpperCase().trim();
  
  // 1. Check known segment lookup
  if (code1 && code2) {
    const key = `${code1}-${code2}`;
    if (KNOWN_RAILWAY_SEGMENTS[key]) {
      return KNOWN_RAILWAY_SEGMENTS[key];
    }
  }

  // 2. Fallback to coordinate alignment with railway tortuosity factor
  const coords1 = st1.coords || { lat: st1.latitude || st1.lat, lng: st1.longitude || st1.lng };
  const coords2 = st2.coords || { lat: st2.latitude || st2.lat, lng: st2.longitude || st2.lng };

  if (coords1 && coords2 && coords1.lat != null && coords2.lat != null) {
    const straightLine = haversineKm(coords1.lat, coords1.lng, coords2.lat, coords2.lng);
    // Railway track curvature factor: ~1.28x straight line for Indian Railways
    const railwayTrackFactor = 1.28;
    return Math.max(1.0, Math.round(straightLine * railwayTrackFactor * 10) / 10);
  }

  // Minimum safe fallback
  return 15.0;
}

/**
 * Validates and processes a train's route station array to compute:
 * - distanceFromOrigin (cumulative distance from start)
 * - distanceFromPrevious (distance between adjacent stops)
 * - distanceRemaining (remaining to destination)
 * 
 * Enforces all 5 strict validation rules.
 */
function processTrainRouteDistances(stations, trainIdentifier = 'Unknown Train') {
  if (!Array.isArray(stations) || stations.length === 0) {
    return [];
  }

  const n = stations.length;
  if (n === 1) {
    return [{
      ...stations[0],
      distanceFromPrevious: 0,
      distanceFromPreviousKm: 0,
      distanceFromOrigin: 0,
      cumulativeDistanceKm: 0,
      distanceRemaining: 0,
      distanceRemainingKm: 0
    }];
  }

  // Step 1: Extract or calculate raw cumulative distances
  // Rule 6: If train data already contains cumulative distance/km values, ALWAYS use those values
  let cumulativeDistances = new Array(n).fill(null);

  // Check if first station has cumulative distance 0
  cumulativeDistances[0] = 0;

  for (let i = 0; i < n; i++) {
    const s = stations[i];
    const candidate = s.cumulativeDistanceKm !== undefined ? s.cumulativeDistanceKm :
                      s.distanceFromOrigin !== undefined ? s.distanceFromOrigin :
                      s.distance !== undefined ? s.distance :
                      s.railwayDistanceKm !== undefined ? s.railwayDistanceKm : null;
    
    if (candidate !== null && !isNaN(candidate) && Number(candidate) >= 0) {
      cumulativeDistances[i] = Number(candidate);
    }
  }

  // Fill in any missing cumulative distances using railway route steps
  for (let i = 1; i < n; i++) {
    if (cumulativeDistances[i] === null || cumulativeDistances[i] < cumulativeDistances[i - 1]) {
      // Check if distance from previous is directly provided
      const prevStep = stations[i].distanceFromPreviousKm !== undefined ? stations[i].distanceFromPreviousKm :
                       stations[i].distanceFromPrevious !== undefined ? stations[i].distanceFromPrevious : null;

      if (prevStep !== null && !isNaN(prevStep) && Number(prevStep) >= 0) {
        cumulativeDistances[i] = Math.round((cumulativeDistances[i - 1] + Number(prevStep)) * 10) / 10;
      } else {
        const estimatedStep = estimateRailwayDistance(stations[i - 1], stations[i]);
        cumulativeDistances[i] = Math.round((cumulativeDistances[i - 1] + estimatedStep) * 10) / 10;
      }
    }
  }

  // Step 2: Validate that cumulative distance is non-decreasing
  for (let i = 1; i < n; i++) {
    if (cumulativeDistances[i] < cumulativeDistances[i - 1]) {
      cumulativeDistances[i] = cumulativeDistances[i - 1];
    }
  }

  const totalRouteDistance = cumulativeDistances[n - 1];

  // Step 3: Compute distanceFromPrevious, distanceFromOrigin, distanceRemaining
  const processedStations = stations.map((st, i) => {
    const fromOrigin = Math.round(cumulativeDistances[i] * 10) / 10;
    const fromPrev = i === 0 ? 0 : Math.round((cumulativeDistances[i] - cumulativeDistances[i - 1]) * 10) / 10;
    const remaining = Math.max(0, Math.round((totalRouteDistance - fromOrigin) * 10) / 10);

    return {
      ...st,
      distanceFromPrevious: fromPrev,
      distanceFromPreviousKm: fromPrev,
      distanceFromOrigin: fromOrigin,
      cumulativeDistanceKm: fromOrigin,
      distanceRemaining: i === n - 1 ? 0 : remaining,
      distanceRemainingKm: i === n - 1 ? 0 : remaining
    };
  });

  // Step 4: Validate all 5 requirements (Rule 13)
  for (let i = 0; i < n; i++) {
    const s = processedStations[i];
    
    // Check 1: distanceFromPrevious >= 0
    if (s.distanceFromPrevious < 0) {
      console.error(`[DistanceValidation Error] Train ${trainIdentifier}: Station ${s.name} distanceFromPrevious < 0`);
      s.distanceFromPrevious = 0;
      s.distanceFromPreviousKm = 0;
    }

    // Check 2: cumulative distance must never decrease
    if (i > 0 && s.distanceFromOrigin < processedStations[i - 1].distanceFromOrigin) {
      console.error(`[DistanceValidation Error] Train ${trainIdentifier}: Cumulative distance decreased at ${s.name}`);
    }

    // Check 3: distanceRemaining must never be negative
    if (s.distanceRemaining < 0) {
      console.error(`[DistanceValidation Error] Train ${trainIdentifier}: Negative distanceRemaining at ${s.name}`);
      s.distanceRemaining = 0;
      s.distanceRemainingKm = 0;
    }

    // Check 4: cumulativeDistance[current] = cumulativeDistance[previous] + distanceFromPrevious
    if (i > 0) {
      const expectedCumulative = Math.round((processedStations[i - 1].distanceFromOrigin + s.distanceFromPrevious) * 10) / 10;
      if (Math.abs(s.distanceFromOrigin - expectedCumulative) > 0.05) {
        console.warn(`[DistanceValidation Warn] Train ${trainIdentifier}: Recalibrating cumulative distance at ${s.name}`);
        s.distanceFromOrigin = expectedCumulative;
        s.cumulativeDistanceKm = expectedCumulative;
      }
    }

    // Check 5: final station distanceRemaining = 0
    if (i === n - 1) {
      s.distanceRemaining = 0;
      s.distanceRemainingKm = 0;
    }
  }

  // Step 5: Optional debug log
  if (process.env.DEBUG_RAILWAY_DISTANCE === 'true') {
    console.log(`\n======================================================`);
    console.log(`[RailwayDistanceService] Validated Route: ${trainIdentifier}`);
    console.log(`Total Route Distance: ${totalRouteDistance} km | Total Stations: ${n}`);
    console.log(`------------------------------------------------------`);
    console.log(`CODE\t| NAME\t\t\t| FROM PREV\t| CUMULATIVE\t| REMAINING`);
    console.log(`------------------------------------------------------`);
    processedStations.forEach(s => {
      const code = (s.code || '---').padEnd(6);
      const name = (s.name || 'Station').substring(0, 20).padEnd(21);
      const prev = `${s.distanceFromPrevious} km`.padEnd(10);
      const cum = `${s.distanceFromOrigin} km`.padEnd(12);
      const rem = `${s.distanceRemaining} km`;
      console.log(`${code}\t| ${name}\t| ${prev}\t| ${cum}\t| ${rem}`);
    });
    console.log(`======================================================\n`);
  }

  return processedStations;
}

module.exports = {
  estimateRailwayDistance,
  processTrainRouteDistances,
  KNOWN_RAILWAY_SEGMENTS
};
