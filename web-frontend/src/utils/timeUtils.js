/**
 * Centralized Railway Time & ETA Utilities
 * Handles timezone conversion (IST - Asia/Kolkata), full datetime comparison,
 * live ETA calculation, and date-aware UI time formatting.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns the current date in IST formatted as YYYY-MM-DD.
 */
export function getTodayISTString(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Parses any time format (ISO string, HH:mm, HH:mm AM/PM) into a full ISO string with IST timezone.
 * Preserves the full datetime if already present.
 */
export function normalizeToIsoIST(timeValue, referenceDate = null) {
  if (!timeValue) return null;
  const str = String(timeValue).trim();

  // If already an ISO string with date component (e.g. 2026-10-12T10:43:00+05:30)
  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }

  // Parse plain time strings (e.g. "10:38 AM", "10:38", "22:45")
  const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let [_, hours, mins, secs, ampm] = match;
  hours = parseInt(hours, 10);
  mins = parseInt(mins, 10);
  secs = secs ? parseInt(secs, 10) : 0;

  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }

  const baseDate = referenceDate || getTodayISTString();
  const pad = (n) => String(n).padStart(2, '0');
  
  // Construct explicit IST ISO-8601 string (+05:30)
  const istIso = `${baseDate}T${pad(hours)}:${pad(mins)}:${pad(secs)}+05:30`;
  const d = new Date(istIso);
  return !isNaN(d.getTime()) ? d.toISOString() : null;
}

/**
 * Computes live expected arrival/departure for a route station:
 * 1. If station has actual arrival/departure (train has arrived/passed), returns actual.
 * 2. If station already has a valid live expected timestamp from API, returns it.
 * 3. Fallback: calculates scheduled datetime + delayMinutes.
 */
export function calculateLiveETA(station, overallTrainDelay = 0) {
  if (!station) return null;

  // 1. If train has actual recorded arrival, that is the exact arrival time
  if (station.actualArrival) return station.actualArrival;
  if (station.actualDeparture && station.isHalt === false) return station.actualDeparture;

  // 2. If live expected arrival already exists from API
  if (station.expectedArrival && station.expectedArrival !== station.scheduledArrival) {
    return station.expectedArrival;
  }

  // 3. Fallback: scheduledArrival + delay
  const schedTime = station.scheduledArrival || station.scheduledDeparture;
  if (!schedTime) return null;

  const schedDate = new Date(schedTime);
  if (isNaN(schedDate.getTime())) {
    // Attempt parsing plain time
    const normalized = normalizeToIsoIST(schedTime);
    if (normalized) {
      const d = new Date(normalized);
      const delay = typeof station.delayMinutes === 'number' 
        ? station.delayMinutes 
        : (typeof station.delayArrival === 'number' ? station.delayArrival : (overallTrainDelay || 0));
      return new Date(d.getTime() + delay * 60 * 1000).toISOString();
    }
    return schedTime;
  }

  const delay = typeof station.delayMinutes === 'number' 
    ? station.delayMinutes 
    : (typeof station.delayArrival === 'number' ? station.delayArrival : (overallTrainDelay || 0));

  if (delay > 0) {
    return new Date(schedDate.getTime() + delay * 60 * 1000).toISOString();
  }
  return schedDate.toISOString();
}

/**
 * Formats a full ISO timestamp into a user-friendly IST string.
 * If the date is tomorrow or yesterday, prepends "Tomorrow, " or "Yesterday, ".
 */
export function formatTimeWithContext(isoString, now = new Date()) {
  if (!isoString) return '—';
  
  const targetDate = new Date(isoString);
  if (isNaN(targetDate.getTime())) {
    return isoString;
  }

  const timePart = targetDate.toLocaleTimeString('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const targetDateIST = targetDate.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
  const nowDateIST = now.toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });

  if (targetDateIST === nowDateIST) {
    return timePart;
  }

  const targetDay = new Date(targetDateIST);
  const nowDay = new Date(nowDateIST);
  const diffDays = Math.round((targetDay - nowDay) / (24 * 60 * 60 * 1000));

  if (diffDays === 1) return `Tomorrow, ${timePart}`;
  if (diffDays === -1) return `Yesterday, ${timePart}`;
  if (diffDays > 1) return `+${diffDays}d ${timePart}`;
  if (diffDays < -1) return `${diffDays}d ${timePart}`;

  return timePart;
}

/**
 * Determines whether a route station has already been passed:
 * Evaluates API status, sequence, cumulative distance, actual arrival/departure,
 * and live train progress.
 */
export function isRouteStationPassed(station, currentLoc = null, currentDistKm = 0) {
  if (!station) return false;

  // 1. API explicit status
  if (station.status === 'PASSED' || station.status === 'departed') return true;

  // 2. Actual arrival or departure recorded
  if (station.actualArrival || station.actualDeparture) return true;

  // 3. Sequence comparison if current location is known
  if (currentLoc?.sequence && station.sequence) {
    if (station.sequence < currentLoc.sequence) return true;
    if (station.sequence === currentLoc.sequence && currentLoc.status === 'departed') return true;
  }

  // 4. Railway kilometrage comparison
  const stDist = station.cumulativeDistanceKm !== undefined ? station.cumulativeDistanceKm : (station.distanceFromOrigin || 0);
  if (currentDistKm > 0 && stDist < currentDistKm) {
    return true;
  }

  return false;
}
