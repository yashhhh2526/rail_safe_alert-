import { API_URL } from '../config/api.js';
import { isRouteStationPassed, normalizeToIsoIST } from '../utils/timeUtils.js';

// Client-side fallback API key (optional; live tracking is securely proxied via backend)
const RAILRADAR_API_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_RAILRADAR_API_KEY) || '';
const DIRECT_LIVE_API_BASE = 'https://api.railradar.in/v1/trains';

/**
 * Normalizes a raw RailRadar or backend live tracking payload into the unified data model.
 */

export function normalizeLiveTrackingResponse(payload, trainNumber, existingStations = []) {
  if (!payload) return null;
  const d = payload.data || payload;

  const trainNum = d.trainNumber || d.train?.number || String(trainNumber);
  const trainName = d.trainName || d.train?.name || 'Express';
  const isLive = d.isLive !== false && (d.status === 'running' || d.isLive === true);
  const delayMinutes = d.currentLocation?.delayMinutes ?? d.delayMinutes ?? 0;
  const lastUpdatedAt = d.lastUpdatedAt || new Date().toISOString();

  const prevHalt = d.previousHalt;
  const nextHalt = d.nextHalt;
  const currLoc = d.currentLocation;

  // Determine current location string
  let currentStationName = 'Live unavailable';
  let currentStationCode = '';
  let statusMode = 'running';
  let currentDistanceKm = 0;

  if (currLoc) {
    const locName = currLoc.stationName || currLoc.stationCode || '';
    const locCode = currLoc.stationCode || '';
    currentStationCode = locCode;
    currentDistanceKm = currLoc.distanceFromOriginKm || 0;

    if (currLoc.status === 'at-station') {
      currentStationName = locCode ? `${locName} (${locCode})` : locName;
      statusMode = 'at-station';
    } else {
      // Train is departed / between halts
      const fromName = prevHalt?.stationName || locName;
      const toName = nextHalt?.stationName || 'Next Station';
      currentStationName = `Between ${fromName} and ${toName}`;
      statusMode = 'departed';
    }
  } else if (prevHalt && nextHalt) {
    currentStationName = `Between ${prevHalt.stationName} and ${nextHalt.stationName}`;
    currentDistanceKm = prevHalt.distance || 0;
    statusMode = 'departed';
  } else if (d.currentStation?.name) {
    currentStationName = d.currentStation.name;
    currentStationCode = d.currentStation.code || '';
    currentDistanceKm = d.currentStation.cumulativeDistanceKm || 0;
  }

  // Determine next halt string
  let nextStationName = 'N/A';
  let nextStationCode = '';
  if (nextHalt) {
    nextStationName = nextHalt.stationCode ? `${nextHalt.stationName} (${nextHalt.stationCode})` : nextHalt.stationName;
    nextStationCode = nextHalt.stationCode || '';
  } else if (d.nextStation?.name) {
    nextStationName = d.nextStation.name;
    nextStationCode = d.nextStation.code || '';
  }

  const speedKmh = currLoc?.speedKmh || d.speedKmh || d.train?.avgSpeed || (isLive ? 80 : 0);

  // Extract complete route: prioritize d.stations (from backend), then d.route (from RailRadar), then existingStations fallback
  let rawRouteList = [];
  if (Array.isArray(d.stations) && d.stations.length > 0) {
    rawRouteList = d.stations.map((st) => {
      // Ensure each station has full ISO dates and computed live ETA
      const schedArr = st.scheduledArrival || null;
      const schedDep = st.scheduledDeparture || null;
      const actArr = st.actualArrival || null;
      const actDep = st.actualDeparture || null;
      const delayMin = typeof st.delayMinutes === 'number' 
        ? st.delayMinutes 
        : (typeof st.delayArrival === 'number' ? st.delayArrival : (delayMinutes || 0));

      let expArr = actArr || st.expectedArrival || null;
      let expDep = actDep || st.expectedDeparture || null;

      if (!expArr && schedArr) {
        const schedDate = new Date(schedArr);
        if (!isNaN(schedDate.getTime())) {
          expArr = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }
      if (!expDep && schedDep) {
        const schedDate = new Date(schedDep);
        if (!isNaN(schedDate.getTime())) {
          expDep = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }

      return {
        ...st,
        scheduledArrival: schedArr,
        scheduledDeparture: schedDep,
        actualArrival: actArr,
        actualDeparture: actDep,
        expectedArrival: expArr,
        expectedDeparture: expDep,
        delayMinutes: delayMin
      };
    });
  } else if (Array.isArray(d.route) && d.route.length > 0) {
    let prevDistance = 0;
    const totalRouteDist = d.route[d.route.length - 1]?.distance || 0;

    rawRouteList = d.route.map((r, idx) => {
      const dist = typeof r.distance === 'number' ? r.distance : (parseFloat(r.distance) || 0);
      const distFromPrev = idx === 0 ? 0 : Math.max(0, Math.round((dist - prevDistance) * 10) / 10);
      prevDistance = dist;
      const remDist = Math.max(0, Math.round((totalRouteDist - dist) * 10) / 10);

      const isHalt = r.isHalt !== false;
      let locationType = 'station';
      if (!isHalt) {
        locationType = 'non-halting';
      } else if (r.stationName && /halt/i.test(r.stationName)) {
        locationType = 'halt';
      }

      const schedArr = r.scheduledArrival || null;
      const schedDep = r.scheduledDeparture || null;
      const actArr = r.actualArrival || null;
      const actDep = r.actualDeparture || null;
      const delayMin = typeof r.delayArrival === 'number' 
        ? r.delayArrival 
        : (typeof r.delayDeparture === 'number' ? r.delayDeparture : (delayMinutes || 0));

      let expArr = actArr || r.expectedArrival || null;
      let expDep = actDep || r.expectedDeparture || null;

      if (!expArr && schedArr) {
        const schedDate = new Date(schedArr);
        if (!isNaN(schedDate.getTime())) {
          expArr = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }
      if (!expDep && schedDep) {
        const schedDate = new Date(schedDep);
        if (!isNaN(schedDate.getTime())) {
          expDep = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }

      let stStatus = 'UPCOMING';
      if (r.status === 'departed' || actArr || actDep) {
        stStatus = 'PASSED';
      } else if (r.status === 'at-station') {
        stStatus = 'CURRENT';
      } else if (currLoc?.sequence && r.sequence && r.sequence < currLoc.sequence) {
        stStatus = 'PASSED';
      } else if (currentDistanceKm > 0 && dist < currentDistanceKm) {
        stStatus = 'PASSED';
      }

      return {
        sequence: r.sequence !== undefined ? r.sequence : (idx + 1),
        name: r.stationName || r.stationCode,
        code: r.stationCode || '',
        isHalt: isHalt,
        locationType: locationType,
        scheduledArrival: schedArr,
        scheduledDeparture: schedDep,
        expectedArrival: expArr,
        expectedDeparture: expDep,
        actualArrival: actArr,
        actualDeparture: actDep,
        delayArrival: r.delayArrival !== undefined ? r.delayArrival : null,
        delayDeparture: r.delayDeparture !== undefined ? r.delayDeparture : null,
        delayMinutes: delayMin,
        cumulativeDistanceKm: dist,
        distanceFromOrigin: dist,
        distanceFromPrevious: distFromPrev,
        distanceFromPreviousKm: distFromPrev,
        distanceRemaining: idx === d.route.length - 1 ? 0 : remDist,
        distanceRemainingKm: idx === d.route.length - 1 ? 0 : remDist,
        platform: isHalt ? (r.platform || null) : null,
        expectedPlatform: isHalt ? (r.platform || null) : null,
        status: stStatus,
        coords: (r.lat && r.lng) ? { lat: Number(r.lat), lng: Number(r.lng) } : null,
        latitude: r.lat || null,
        longitude: r.lng || null,
        speedToNextStationKmph: r.speedToNextStationKmph || null
      };
    });
  } else if (Array.isArray(existingStations) && existingStations.length > 0) {
    rawRouteList = existingStations.map(st => {
      const schedArr = normalizeToIsoIST(st.scheduledArrival);
      const schedDep = normalizeToIsoIST(st.scheduledDeparture);
      const actArr = normalizeToIsoIST(st.actualArrival);
      const actDep = normalizeToIsoIST(st.actualDeparture);
      const delayMin = typeof st.delayMinutes === 'number' ? st.delayMinutes : (delayMinutes || 0);

      let expArr = actArr || normalizeToIsoIST(st.expectedArrival);
      let expDep = actDep || normalizeToIsoIST(st.expectedDeparture);

      if (!expArr && schedArr) {
        const schedDate = new Date(schedArr);
        if (!isNaN(schedDate.getTime())) {
          expArr = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }
      if (!expDep && schedDep) {
        const schedDate = new Date(schedDep);
        if (!isNaN(schedDate.getTime())) {
          expDep = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
        }
      }

      return {
        ...st,
        scheduledArrival: schedArr,
        scheduledDeparture: schedDep,
        expectedArrival: expArr,
        expectedDeparture: expDep,
        actualArrival: actArr,
        actualDeparture: actDep,
        delayMinutes: delayMin
      };
    });
  }

  // Update statuses along the complete route based on live train progress
  let updatedStations = rawRouteList.map((st, idx) => {
    let newStatus = st.status || 'UPCOMING';

    if (idx === rawRouteList.length - 1) {
      newStatus = 'DESTINATION';
    } else if (isRouteStationPassed(st, currLoc, currentDistanceKm)) {
      newStatus = 'PASSED';
    } else if (currLoc?.sequence && st.sequence && st.sequence === currLoc.sequence) {
      newStatus = currLoc.status === 'at-station' ? 'CURRENT' : 'PASSED';
    } else if (nextHalt && (st.code === nextHalt.stationCode || (st.name && nextHalt.stationName && st.name.toLowerCase().includes(nextHalt.stationName.toLowerCase())))) {
      newStatus = 'NEXT';
    } else if (idx > 0 && rawRouteList[idx - 1]?.status === 'PASSED' && newStatus === 'UPCOMING') {
      newStatus = 'NEXT';
    }

    return {
      ...st,
      status: newStatus
    };
  });

  // If train is stopped at a station, mark that exact station CURRENT
  if (statusMode === 'at-station' && currentStationCode) {
    const matchIdx = updatedStations.findIndex(s => s.code === currentStationCode);
    if (matchIdx !== -1) {
      updatedStations[matchIdx].status = 'CURRENT';
    }
  }

  return {
    trainNumber: trainNum,
    trainName: trainName,
    isLive: isLive,
    currentLocationName: currentStationName,
    currentStation: {
      name: currentStationName,
      code: currentStationCode,
      status: statusMode,
      cumulativeDistanceKm: currentDistanceKm
    },
    nextStation: {
      name: nextStationName,
      code: nextStationCode
    },
    previousStation: prevHalt ? {
      name: prevHalt.stationName,
      code: prevHalt.stationCode,
      distance: prevHalt.distance
    } : null,
    delayMinutes: delayMinutes,
    speedKmh: speedKmh,
    lastUpdatedAt: lastUpdatedAt,
    currentDistanceKm: currentDistanceKm,
    stations: updatedStations.length > 0 ? updatedStations : (d.stations || [])
  };
}

/**
 * Fetches live train tracking data using multi-tier strategy:
 * 1. Primary: Deployed API endpoint (/api/trains/:trainNumber/live)
 * 2. Fallback: Direct RailRadar API request with CORS support
 */
export async function fetchLiveTrainData(trainNumber, existingStations = []) {
  const cleanTrainNumber = String(trainNumber || '').trim();
  if (!cleanTrainNumber) {
    throw new Error('No train number specified');
  }

  let backendError = null;
  let backendResponse = null;
  const backendUrl = `${API_URL}/${encodeURIComponent(cleanTrainNumber)}/live`;

  // Tier 1: Try backend / serverless endpoint
  try {
    const res = await fetch(backendUrl, {
      headers: {
        'Accept': 'application/json'
      }
    });
    backendResponse = res;

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json && (json.success || json.data)) {
          return normalizeLiveTrackingResponse(json, cleanTrainNumber, existingStations);
        }
      }
    }
  } catch (err) {
    backendError = err;
    console.warn('Backend live endpoint fetch notice:', err.message);
  }

  // Tier 2: Direct client-side RailRadar fetch (only if client API key is provided)
  if (!RAILRADAR_API_KEY) {
    if (backendError) {
      throw new Error(`Unable to fetch live telemetry: ${backendError.message}`);
    }
    throw new Error('Live telemetry is currently unavailable from serverless backend');
  }

  const directUrl = `${DIRECT_LIVE_API_BASE}/${encodeURIComponent(cleanTrainNumber)}/live`;
  try {
    const directRes = await fetch(directUrl, {
      headers: {
        'Authorization': `Bearer ${RAILRADAR_API_KEY}`
      }
    });

    if (directRes.ok) {
      const json = await directRes.json();
      if (json && json.success && json.data) {
        return normalizeLiveTrackingResponse(json, cleanTrainNumber, existingStations);
      } else {
        throw new Error(json?.msg || 'Live telemetry currently unavailable for this train');
      }
    } else if (directRes.status === 404) {
      throw new Error(`Train ${cleanTrainNumber} is currently not running or not active in live tracking`);
    } else if (directRes.status === 429) {
      throw new Error('Live railway tracking rate limit reached. Retrying shortly...');
    } else {
      throw new Error(`External railway API returned HTTP status ${directRes.status}`);
    }
  } catch (directErr) {
    // Diagnostic logging per Requirement 16
    console.error('LIVE TRACKING ERROR:', directErr);
    console.error('LIVE TRACKING URL:', directUrl);
    console.error('LIVE TRACKING RESPONSE:', backendResponse || backendError);
    throw directErr;
  }
}

export default {
  fetchLiveTrainData,
  normalizeLiveTrackingResponse
};
