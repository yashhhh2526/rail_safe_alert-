import { API_BASE_URL } from '../config/api';
import { getToken } from './authService';

const LOCAL_JOURNEYS_KEY = 'railSafe_localJourneys';

export function getLocalJourneys() {
  try {
    const raw = localStorage.getItem(LOCAL_JOURNEYS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalJourney(journey) {
  try {
    const existing = getLocalJourneys();
    const newRecord = {
      id: journey.id || Date.now(),
      trainNumber: journey.trainNumber,
      trainName: journey.trainName,
      boardingStation: journey.boardingStation,
      destinationStation: journey.destinationStation,
      alertDistance: journey.alertDistance || 5,
      status: journey.status || 'ongoing',
      createdAt: new Date().toISOString()
    };
    const updated = [newRecord, ...existing.filter(j => j.trainNumber !== journey.trainNumber)].slice(0, 15);
    localStorage.setItem(LOCAL_JOURNEYS_KEY, JSON.stringify(updated));
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
  if (!token) {
    return getLocalJourneys();
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
        return data.journeys;
      }
    }
    return getLocalJourneys();
  } catch (err) {
    console.warn('Error fetching journeys from backend:', err);
    return getLocalJourneys();
  }
}

export async function deleteJourneyRecord(id) {
  // Delete from local
  try {
    const local = getLocalJourneys().filter(j => j.id !== id);
    localStorage.setItem(LOCAL_JOURNEYS_KEY, JSON.stringify(local));
  } catch (e) {
    console.warn('Local delete notice:', e);
  }

  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/journey/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (err) {
      console.warn('Backend delete notice:', err);
    }
  }
}
