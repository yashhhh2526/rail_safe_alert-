import { API_BASE_URL } from '../config/api.js';
import { getToken } from './authService.js';

const LOCAL_JOURNEYS_KEY = 'railSafe_localJourneys';

function getStorage() {
  if (typeof localStorage !== 'undefined') return localStorage;
  if (!globalThis._mockStorage) {
    globalThis._mockStorage = {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; }
    };
  }
  return globalThis._mockStorage;
}

export function getLocalJourneys() {
  try {
    const raw = getStorage().getItem(LOCAL_JOURNEYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalJourney(journey) {
  try {
    const storage = getStorage();
    const existing = getLocalJourneys();
    const newRecord = {
      id: journey.id || Date.now(),
      trainNumber: journey.trainNumber,
      trainName: journey.trainName,
      boardingStation: journey.boardingStation,
      destinationStation: journey.destinationStation,
      alertDistance: journey.alertDistance || 5,
      status: journey.status || 'ongoing',
      pnr: journey.pnr || null,
      fare: journey.fare !== undefined ? journey.fare : null,
      distanceKm: journey.distanceKm !== undefined ? journey.distanceKm : null,
      createdAt: new Date().toISOString()
    };
    const updated = [newRecord, ...existing.filter(j => j.id !== newRecord.id && j.trainNumber !== journey.trainNumber)].slice(0, 15);
    storage.setItem(LOCAL_JOURNEYS_KEY, JSON.stringify(updated));
    return newRecord;
  } catch (err) {
    console.warn('Error saving local journey:', err);
    return journey;
  }
}

export async function createJourney(journeyData) {
  // Always save locally first for offline resilience
  const localRecord = saveLocalJourney(journeyData);

  const token = getToken();
  if (!token) return localRecord;

  try {
    const response = await fetch(`${API_BASE_URL}/api/journey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(journeyData)
    });

    if (response.ok) {
      const data = await response.json();
      return data.journey || localRecord;
    }
    return localRecord;
  } catch (err) {
    console.warn('Backend journey save notice (using offline local record):', err.message);
    return localRecord;
  }
}

export async function fetchUserJourneys() {
  const token = getToken();
  const localList = getLocalJourneys();

  if (!token) {
    return localList;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/journey`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.journeys)) {
        // Merge with local records
        const combined = [...data.journeys];
        localList.forEach(local => {
          if (!combined.some(c => c.trainNumber === local.trainNumber && c.id === local.id)) {
            combined.push(local);
          }
        });
        return combined;
      }
    }
    return localList;
  } catch (err) {
    console.warn('Backend journey fetch notice (falling back to local list):', err.message);
    return localList;
  }
}

export async function deleteJourneyRecord(id) {
  try {
    const storage = getStorage();
    const existing = getLocalJourneys();
    const filtered = existing.filter(j => j.id !== id);
    storage.setItem(LOCAL_JOURNEYS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('Error deleting local journey:', err);
  }

  const token = getToken();
  if (!token) return;

  try {
    await fetch(`${API_BASE_URL}/api/journey/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (err) {
    console.warn('Backend journey delete notice:', err.message);
  }
}

export default {
  getLocalJourneys,
  saveLocalJourney,
  createJourney,
  fetchUserJourneys,
  deleteJourneyRecord
};
