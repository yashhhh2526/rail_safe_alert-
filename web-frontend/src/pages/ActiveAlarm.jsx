import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchLiveTrainData } from '../services/liveTrackingService';
import { formatTimeWithContext, calculateLiveETA } from '../utils/timeUtils';
import { getSettings } from '../utils/settingsService';
import { 
  startAlarmTone, 
  stopAlarmTone, 
  triggerVibration, 
  stopVibration, 
  speakAnnouncement, 
  stopAnnouncement, 
  showAlarmNotification 
} from '../utils/alarmAudioService';
import StationTimelineNode from '../components/StationTimelineNode';

// Haversine formula to calculate straight-line fallback distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ActiveAlarm() {
  const { state } = useLocation();
  const navigate = useNavigate();
  
  const [currentDist, setCurrentDist] = useState(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isAlarmRingingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const pollingIntervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const [_networkError, setNetworkError] = useState(null);
  const [userSettings, setUserSettings] = useState(getSettings);

  const { train, alarmType, alertValue, destination, liveData } = state || {};
  const [liveDataState, setLiveDataState] = useState(liveData);
  const liveDataRef = useRef(liveData);
  liveDataRef.current = liveDataState;
  
  let initialIndex = train?.stations?.findIndex(
    s => (s.name || s) === train.currentLocation?.station
  ) || 0;
  
  const liveStationTarget = liveData?.currentStation?.name || liveData?.currentLocation?.stationName || liveData?.currentStation?.code;
  if (liveStationTarget) {
    const liveIndex = train?.stations?.findIndex(
      s => (s.name || s.code || s).toLowerCase().includes(liveStationTarget.toLowerCase()) ||
           liveStationTarget.toLowerCase().includes((s.name || s.code || s).toLowerCase())
    );
    if (liveIndex !== -1) initialIndex = liveIndex;
  }

  const [activeStationIndex, setActiveStationIndex] = useState(Math.max(0, initialIndex));
  const activeStationIndexRef = useRef(activeStationIndex);
  activeStationIndexRef.current = activeStationIndex;

  // Sync settings when loaded
  useEffect(() => {
    setUserSettings(getSettings());
  }, []);

  const triggerAlarm = useCallback(() => {
    if (isAlarmRingingRef.current) return;
    isAlarmRingingRef.current = true;
    setIsAlarmRinging(true);
    
    // 1. Resilient offline Web Audio Tone (singleton, instantiated once)
    startAlarmTone(userSettings.alarmSound || 'digital');

    // 2. Device Vibration
    triggerVibration(userSettings.vibrationIntensity || 3);

    // 3. Text-To-Speech announcement
    if (userSettings.voiceAnnouncements !== false) {
      const destName = destination?.name || destination || 'your destination';
      speakAnnouncement(`Wake up! Your train is approaching ${destName}. Target distance threshold reached.`);
    }

    // 4. Desktop Notification
    if (userSettings.notificationsEnabled !== false) {
      const unit = alarmType === 'distance' ? 'km' : 'mins';
      showAlarmNotification(
        'RailSafe Destination Alert!',
        `Wake up! You are within ${alertValue} ${unit} of ${destination?.name || destination}.`
      );
    }
  }, [userSettings, destination, alertValue, alarmType]);

  const calculateCurrentStatus = useCallback((targetLiveData) => {
    const currentLiveData = targetLiveData || liveDataRef.current;
    let destNode = null;
    let currentNode = null;
    let remainingDistance = null;
    
    if (currentLiveData?.stations) {
      const targetCode = destination?.code || destination;
      const targetName = destination?.name || destination;
      
      destNode = currentLiveData.stations.find(s => 
        (s.code && s.code === targetCode) || 
        (s.name && s.name.toLowerCase() === (targetName || '').toLowerCase())
      );
      
      if (destNode && destNode.cumulativeDistanceKm !== undefined) {
        if (currentLiveData.currentDistanceKm > 0) {
          remainingDistance = Math.max(0, destNode.cumulativeDistanceKm - currentLiveData.currentDistanceKm);
        } else {
          currentNode = currentLiveData.stations.find(s => s.status === 'CURRENT' || s.status === 'NEXT');
          if (currentNode && currentNode.cumulativeDistanceKm !== undefined) {
            remainingDistance = Math.max(0, destNode.cumulativeDistanceKm - currentNode.cumulativeDistanceKm);
          }
        }
      }
    }

    if (remainingDistance === null && train?.stations) {
      const targetCode = destination?.code || destination;
      const targetName = destination?.name || destination;
      const destStn = train.stations.find(s => s.code === targetCode || s.name === targetName);
      if (destStn && destStn.cumulativeDistanceKm !== undefined) {
        const curStn = train.stations[activeStationIndexRef.current] || train.stations[0];
        const curDist = curStn?.cumulativeDistanceKm || 0;
        remainingDistance = Math.max(0, destStn.cumulativeDistanceKm - curDist);
      }
    }
    
    if (remainingDistance === null && destination?.coords) {
      const destCoords = destination.coords;
      let currentIndex = activeStationIndexRef.current;
      if (currentLiveData?.currentStation?.name) {
        const liveIndex = (currentLiveData.stations || train?.stations || []).findIndex(
          s => (s.name || s).toLowerCase() === currentLiveData.currentStation.name.toLowerCase()
        );
        if (liveIndex !== -1) {
          currentIndex = liveIndex;
          setActiveStationIndex(liveIndex);
        }
      }
      const startStation = (currentLiveData?.stations || train?.stations || [])[currentIndex];
      if (startStation && startStation.coords) {
        remainingDistance = calculateDistance(startStation.coords.lat, startStation.coords.lng, destCoords.lat, destCoords.lng);
      }
    }
    
    if (remainingDistance === null) {
      return;
    }
    
    let effectiveValue = remainingDistance;
    
    if (alarmType === 'time') {
      const speed = currentLiveData?.speedKmh || 60;
      const timeInHours = remainingDistance / (speed > 0 ? speed : 60);
      effectiveValue = timeInHours * 60; // in minutes
      setCurrentDist(effectiveValue.toFixed(0));
    } else {
      setCurrentDist(remainingDistance.toFixed(1));
    }
    
    if (effectiveValue <= alertValue && remainingDistance > 0) {
      triggerAlarm();
    }
  }, [destination, train, alarmType, alertValue, triggerAlarm]);

  const fetchLiveStatus = useCallback(async (isManual = false) => {
    if (!train?.trainNumber) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);

    if (!navigator.onLine) {
      setNetworkError('You are offline. Waiting for network connection...');
      isFetchingRef.current = false;
      setIsRefreshing(false);
      return;
    }
    
    try {
      const liveNormalized = await fetchLiveTrainData(train.trainNumber, train.stations || [], isManual);
      if (liveNormalized) {
        setLiveDataState(liveNormalized);
        liveDataRef.current = liveNormalized;
        calculateCurrentStatus(liveNormalized);
        setNetworkError(null);
        retryCountRef.current = 0;
      }
    } catch (err) {
      console.warn("Polling notice:", err.message);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setNetworkError(`Connection notice. Retrying (${retryCountRef.current}/${MAX_RETRIES})...`);
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = setTimeout(() => fetchLiveStatus(false), 5000 * retryCountRef.current);
      } else {
        setNetworkError('Live serverless telemetry paused. Using verified route position.');
      }
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, [train, calculateCurrentStatus]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().catch(() => {});
    }
    
    // Initial sync
    if (liveData) {
      calculateCurrentStatus(liveData);
    }
    fetchLiveStatus(false);

    // Setup stable background polling every 60 seconds
    pollingIntervalRef.current = setInterval(() => {
      if (!isAlarmRingingRef.current) {
        fetchLiveStatus(false);
      }
    }, 60000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      stopAlarmTone();
      stopVibration();
      stopAnnouncement();
    };
  }, [train?.trainNumber, calculateCurrentStatus, fetchLiveStatus, liveData]);

  if (!state || !state.train) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>No active train journey selected.</p>
        <button className="search-btn" onClick={() => navigate('/')}>Return to Train Search</button>
      </div>
    );
  }

  const stopAlarm = () => {
    setIsAlarmRinging(false);
    stopAlarmTone();
    stopVibration();
    stopAnnouncement();
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    alert('Alarm Stopped. You have arrived safely at your destination!');
    navigate('/');
  };

  const displayStartStation = train.userSelectedFrom || train.fromStation || (train.stations && (typeof train.stations[0] === 'string' ? train.stations[0] : train.stations[0]?.name)) || "Origin Station";
  const displayEndStation = typeof destination === 'string' ? destination : (destination?.name || destination?.code || "Destination Station");

  let displayETA = "ETA unavailable";
  let displayDelay = 0;
  let currentStationDisplay = "In Transit";
  let nextStationDisplay = "Upcoming Station";
  
  if (liveDataState?.currentStation?.name) {
    currentStationDisplay = liveDataState.currentStation.name;
  } else if (train.currentLocation?.station) {
    currentStationDisplay = train.currentLocation.station;
  }
  
  if (liveDataState?.nextStation?.name) {
    nextStationDisplay = liveDataState.nextStation.name;
  }
  
  displayDelay = liveDataState?.delayMinutes !== undefined ? liveDataState.delayMinutes : (train.delayMinutes || 0);
  
  const destIndexInLive = liveDataState?.stations?.findIndex(s => s.code === (destination?.code || destination) || s.name === (destination?.name || destination));
  if (destIndexInLive !== undefined && destIndexInLive !== -1) {
    const destStationLive = liveDataState.stations[destIndexInLive];
    if (destStationLive.status === 'PASSED') {
      displayETA = "Station Passed";
    } else if (destStationLive.expectedArrival) {
      displayETA = formatTimeWithContext(destStationLive.expectedArrival);
    } else if (destStationLive.scheduledArrival) {
      const liveEta = calculateLiveETA(destStationLive, displayDelay);
      displayETA = formatTimeWithContext(liveEta);
    }
  } else {
    if (alarmType === 'time' && currentDist !== null) {
      displayETA = `In ~${currentDist} mins (Est)`;
    } else if (alarmType === 'distance' && currentDist !== null) {
      const mins = (parseFloat(currentDist) / 60) * 60;
      displayETA = `In ~${Math.round(mins)} mins (Est)`;
    }
  }

  const stationsArray = liveDataState?.stations || train.stations || [];

  return (
    <div className={`glass-panel ${isAlarmRinging ? 'ringing' : ''}`} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
      
      {isAlarmRinging ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', padding: '2rem 0' }}>
          <div className="alarm-flasher"></div>
          <div style={{ fontSize: '4.5rem', marginBottom: '1rem', animation: 'pulse 1s infinite' }}>🔔</div>
          <h1 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '0.5rem', zIndex: 2 }}>DESTINATION ALERT</h1>
          <h2 style={{ color: 'var(--text-light)', fontWeight: '400', marginBottom: '2rem', zIndex: 2 }}>Your destination is approaching!</h2>
          
          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '2rem', borderRadius: '15px', marginBottom: '3rem', border: '1px solid rgba(255,255,255,0.3)', zIndex: 2, backdropFilter: 'blur(10px)' }}>
            <div style={{ fontSize: '2.5rem', color: '#fff', fontWeight: 'bold', marginBottom: '0.5rem' }}>{displayEndStation}</div>
            <div style={{ fontSize: '1.2rem', color: 'var(--text-light)' }}>
              Approximately {currentDist} {alarmType === 'distance' ? 'km' : 'minutes'} away.
            </div>
          </div>
          
          <button 
            type="button"
            onClick={stopAlarm} 
            style={{ 
              background: 'var(--danger)', 
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              width: '100%', 
              padding: '1.5rem', 
              fontSize: '1.5rem', 
              borderRadius: '50px', 
              fontWeight: 'bold', 
              boxShadow: '0 10px 25px rgba(255, 107, 107, 0.5)', 
              zIndex: 10 
            }}
          >
            DISMISS ALARM
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '1.5rem', color: 'var(--success)' }}>
            <div className="live-indicator"></div>
            <h2 style={{ color: 'inherit', margin: 0, fontSize: '1.5rem' }}>Active Alarm Monitoring</h2>
          </div>

          <h3 style={{ color: '#0F172A', fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {train.trainNumber} - {train.trainName}
          </h3>
          <p style={{ fontSize: '1rem', color: '#0f766e', fontWeight: '700' }}>
            Target Station: {displayEndStation}
          </p>

          <div style={{ margin: '1rem 0', background: 'rgba(255, 255, 255, 0.85)', padding: '1.5rem', borderRadius: '15px', border: '1px solid rgba(203, 213, 225, 0.7)', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Origin</div>
                <div style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '700' }}>{displayStartStation}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Destination</div>
                <div style={{ fontSize: '1.1rem', color: '#0284c7', fontWeight: '700' }}>{displayEndStation}</div>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Current Position</div>
                <div style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '700' }}>{currentStationDisplay}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Next Station</div>
                <div style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '700' }}>{nextStationDisplay}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Running Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: displayDelay > 0 ? '#dc2626' : '#059669' }}>
                  {displayDelay > 0 ? `Delayed by ${displayDelay}m` : 'Running On Time'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Estimated Arrival</div>
                <div style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: '700' }}>{displayETA}</div>
              </div>
            </div>
          </div>

          <div style={{ margin: '1.5rem 0', display: 'flex', justifyContent: 'space-around', background: 'rgba(255, 255, 255, 0.85)', padding: '1.5rem', borderRadius: '15px', border: '1px solid rgba(203, 213, 225, 0.7)', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>Alert Distance Threshold</div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0F172A' }}>{alertValue} {alarmType === 'distance' ? 'km' : 'mins'}</div>
            </div>
            <div style={{ width: '1px', background: 'rgba(203, 213, 225, 0.7)' }}></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600', textTransform: 'uppercase' }}>
                {alarmType === 'distance' ? 'Remaining Distance' : 'Estimated Time'}
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#0284c7' }}>
                {currentDist !== null ? `${currentDist} ${alarmType === 'distance' ? 'km' : 'mins'}` : 'Calculating...'}
              </div>
            </div>
          </div>

          {/* Interactive Route Stations Timeline */}
          <div className="timeline-container" style={{ textAlign: 'left', marginBottom: '2rem', maxHeight: '350px', overflowY: 'auto' }}>
            {stationsArray.map((station, index) => {
              const stableStationKey = station.stationCode || station.code || station.name || `stn-${station.sequence ?? index}`;
              return (
                <StationTimelineNode 
                  key={stableStationKey}
                  station={station}
                  index={index}
                  totalStations={stationsArray.length}
                  nextStation={stationsArray[index + 1]}
                  destination={destination}
                  displayDelay={displayDelay}
                />
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1rem' }}>
            <button 
              type="button"
              className="refresh-live-btn bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium"
              onClick={() => fetchLiveStatus(true)} 
              disabled={isRefreshing}
              style={{
                backgroundColor: '#1e293b',
                color: '#f1f5f9',
                fontWeight: '500',
                flex: 1,
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid #334155',
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                opacity: isRefreshing ? 0.75 : 1,
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
              }}
            >
              <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>🔄</span>
              {isRefreshing ? 'Refreshing Status...' : 'Refresh Live Status'}
            </button>
            <button 
              type="button"
              onClick={triggerAlarm} 
              style={{ background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', flex: 1, padding: '1rem', fontWeight: 'bold', boxShadow: '0 4px 15px rgba(255, 107, 107, 0.4)' }}
            >
              🔔 Test Alarm Now
            </button>
          </div>
          
          <button 
            type="button"
            className="back-btn" 
            style={{ width: '100%', marginTop: '1rem' }} 
            onClick={() => navigate('/')}
          >
            Cancel & Return Home
          </button>

          {/* Emergency Helpline Button */}
          <a 
            href={`tel:${userSettings.emergencyNumber || '139'}`} 
            style={{ display: 'block', textDecoration: 'none', marginTop: '1rem' }}
          >
            <div style={{ 
              background: '#d93025', 
              width: '100%', 
              padding: '1.1rem', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: 'white', 
              borderRadius: '8px', 
              fontSize: '1rem', 
              cursor: 'pointer', 
              fontWeight: 'bold',
              boxShadow: '0 4px 15px rgba(217, 48, 37, 0.4)'
            }}>
              📞 Railway Emergency Helpline ({userSettings.emergencyNumber || '139'})
            </div>
          </a>
        </>
      )}

      {/* Embedded CSS for the alarm ringing animation */}
      <style>{`
        .ringing {
          background: rgba(255, 75, 75, 0.2) !important;
          border-color: rgba(255, 75, 75, 0.5) !important;
          animation: shake 0.5s infinite;
        }
        
        .alarm-flasher {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(255, 0, 0, 0.3);
          animation: flash 1s infinite;
          border-radius: 20px;
          pointer-events: none;
          z-index: 1;
        }

        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }

        @keyframes flash {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
