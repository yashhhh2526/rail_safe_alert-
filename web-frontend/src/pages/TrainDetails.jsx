import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { processStationDistances } from '../utils/railwayDistance';
import { demoTrainMap } from '../data/trainsData';
import { fetchLiveTrainData } from '../services/liveTrackingService';
import { formatTimeWithContext } from '../utils/timeUtils';
import { getSettings } from '../utils/settingsService';
import { createJourney } from '../utils/journeyService';
import AlternateOptionsCard from '../components/AlternateOptionsCard';

export default function TrainDetails() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { train } = state || {};

  const userSettings = getSettings();
  const [alarmType, setAlarmType] = useState('distance');
  const [alertDistance, setAlertDistance] = useState(userSettings.defaultAlertDistance || 10);
  const [alertTime, setAlertTime] = useState(15);
  
  const [liveData, setLiveData] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const isMountedRef = useRef(true);
  const isFetchingRef = useRef(false);

  // Look up demo fallback train if available
  const cleanTrainNum = String(train?.trainNumber || '').trim();
  const demoFallback = cleanTrainNum ? demoTrainMap[cleanTrainNum] : null;

  // Initial station list: use enriched stations if available, fallback to demoMap or basic stations
  const initialStationsRaw = (train?.stations && train.stations.length > 2 && train.stations.some(s => s.cumulativeDistanceKm > 0))
    ? train.stations
    : (demoFallback?.stations || train?.stations || []);

  const [displayStations, setDisplayStations] = useState(() => processStationDistances(initialStationsRaw));
  const displayStationsRef = useRef(displayStations);
  displayStationsRef.current = displayStations;

  const [isLoading, setIsLoading] = useState(!initialStationsRaw.length);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedDestinationIndex, setSelectedDestinationIndex] = useState(() => {
    return initialStationsRaw.length > 0 ? initialStationsRaw.length - 1 : 0;
  });

  const fetchLiveData = useCallback(async (isManual = false) => {
    if (!cleanTrainNum) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const hasExistingData = displayStationsRef.current.length > 0;
    if (hasExistingData) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLiveError(null);

    try {
      const liveResult = await fetchLiveTrainData(cleanTrainNum, displayStationsRef.current, isManual);
      if (!isMountedRef.current) return;

      if (liveResult) {
        setLiveData(liveResult);
        if (liveResult.stations && liveResult.stations.length > 0) {
          const processed = processStationDistances(liveResult.stations);
          setDisplayStations(processed);

          // Preserve currently selected destination station across live data refreshes
          setSelectedDestinationIndex(prevIdx => {
            const currentSelected = displayStationsRef.current[prevIdx];
            if (currentSelected) {
              const matchIdx = processed.findIndex(s => 
                (s.code && s.code === currentSelected.code) ||
                (s.name && s.name.toLowerCase() === (currentSelected.name || '').toLowerCase())
              );
              if (matchIdx !== -1) return matchIdx;
            }
            return processed.length - 1;
          });
        }
      }
    } catch (err) {
      console.warn('Live API request notice, preserving verified route kilometrage:', err.message);
      if (!isMountedRef.current) return;
      setLiveError(err.message);

      // Live data failure must NOT destroy verified station distances
      setDisplayStations(prev => {
        if (prev && prev.length > 2 && prev.some(s => s.cumulativeDistanceKm > 0)) {
          return prev;
        }
        const fallbackList = demoFallback?.stations || train?.stations || [];
        const processed = processStationDistances(fallbackList);
        if (processed.length > 0) {
          setSelectedDestinationIndex(processed.length - 1);
        }
        return processed;
      });
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [cleanTrainNum, demoFallback, train]);

  useEffect(() => {
    isMountedRef.current = true;
    if (cleanTrainNum) {
      fetchLiveData(false);
    }

    // Background polling every 60 seconds with proper cleanup
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        fetchLiveData(false);
      }
    }, 60000);

    return () => {
      isMountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [cleanTrainNum, fetchLiveData]);


  const formatTime = (isoString) => formatTimeWithContext(isoString);

  if (!state || !state.train) {
    return (
      <div className="glass-panel">
        <p>No train selected.</p>
        <button onClick={() => navigate('/')}>Go Back</button>
      </div>
    );
  }

  const selectedDestination = displayStations[selectedDestinationIndex] || displayStations[displayStations.length - 1];

  const handleSetAlarm = () => {
    // Automatically persist journey record
    const startStationName = train.userSelectedFrom || train.fromStation || (displayStations[0]?.name) || 'Origin';
    const destStationName = selectedDestination?.name || selectedDestination?.code || 'Destination';
    createJourney({
      trainNumber: train.trainNumber,
      trainName: train.trainName,
      boardingStation: startStationName,
      destinationStation: destStationName,
      alertDistance: alarmType === 'distance' ? alertDistance : Math.round(alertTime * 0.8),
      status: 'ongoing'
    }).catch(e => console.warn('Journey save notice:', e));

    navigate('/tracking', { 
      state: { 
        train, 
        alarmType, 
        alertValue: alarmType === 'distance' ? alertDistance : alertTime, 
        destination: selectedDestination, 
        liveData 
      } 
    });
  };

  // Determine current train location optimistically (preserving state across refreshes)
  let displayLocation = 'Live unavailable';
  let displayNextHalt = 'N/A';
  let isApproximateDistance = false;
  
  if (liveData && !liveError) {
    if (liveData.currentLocationName) {
      displayLocation = liveData.currentLocationName;
    } else if (liveData.currentStation?.name) {
      const isNonHalt = liveData.currentStation.isHalt === false || liveData.currentStation.locationType === 'non-halting';
      const code = !isNonHalt && liveData.currentStation.code ? ` (${liveData.currentStation.code})` : '';
      displayLocation = `${liveData.currentStation.name}${code}`;
    } else if (liveData.stations) {
      const curr = liveData.stations.find(s => s.status === 'CURRENT');
      if (curr) {
        const isNonHalt = curr.isHalt === false || curr.locationType === 'non-halting';
        const code = !isNonHalt && curr.code ? ` (${curr.code})` : '';
        displayLocation = `${curr.name}${code}`;
      } else {
        const passedStns = liveData.stations.filter(s => s.status === 'PASSED');
        const upcomingStns = liveData.stations.filter(s => s.status === 'UPCOMING' || s.status === 'NEXT');
        if (passedStns.length > 0 && upcomingStns.length > 0) {
          displayLocation = `Between ${passedStns[passedStns.length - 1].name} and ${upcomingStns[0].name}`;
        } else if (passedStns.length > 0) {
          displayLocation = `Departed ${passedStns[passedStns.length - 1].name}`;
        } else {
          displayLocation = 'Live unavailable';
        }
      }
    }
    
    // Determine next halt station (strictly isHalt !== false)
    if (liveData.stations) {
      const upcomingHalts = liveData.stations.filter(s => 
        (s.status === 'UPCOMING' || s.status === 'NEXT') && s.isHalt !== false && s.locationType !== 'non-halting'
      );
      if (upcomingHalts.length > 0) {
        const halt = upcomingHalts[0];
        displayNextHalt = `${halt.name}${halt.code ? ` (${halt.code})` : ''}`;
      } else if (liveData.nextStation?.name) {
        displayNextHalt = liveData.nextStation.name;
      }
    } else if (liveData.nextStation?.name) {
      displayNextHalt = liveData.nextStation.name;
    }
  } else if (displayStations.length > 0) {
    // Scheduled baseline route fallback
    const firstUpcoming = displayStations.find(s => s.isHalt !== false && s.locationType !== 'non-halting') || displayStations[1] || displayStations[0];
    displayLocation = displayStations[0]?.name ? `Departing ${displayStations[0].name}` : 'Scheduled Route';
    displayNextHalt = firstUpcoming ? `${firstUpcoming.name}${firstUpcoming.code ? ` (${firstUpcoming.code})` : ''}` : 'N/A';
  } else if (isLoading) {
    displayLocation = 'Loading...';
    displayNextHalt = 'Loading...';
  }

  const displayDelay = liveData?.delayMinutes ?? train.delayMinutes ?? 0;
  const lastUpdated = liveData?.lastUpdatedAt ? new Date(liveData.lastUpdatedAt).toLocaleTimeString() : 'N/A';

  // Calculate dynamic distance to the user-selected destination station (Part 8, 9, 10)
  const targetCumulative = selectedDestination?.cumulativeDistanceKm ?? selectedDestination?.distanceFromOrigin ?? 0;
  
  let currentTrainCumulative = 0;
  if (liveData && !liveError) {
    if (liveData.currentDistanceKm > 0) {
      currentTrainCumulative = liveData.currentDistanceKm;
    } else if (liveData.currentStation?.cumulativeDistanceKm > 0) {
      currentTrainCumulative = liveData.currentStation.cumulativeDistanceKm;
      isApproximateDistance = true;
    } else if (liveData.stations) {
      const currentStationNode = liveData.stations.find(s => s.status === 'CURRENT');
      if (currentStationNode && currentStationNode.cumulativeDistanceKm !== undefined) {
        currentTrainCumulative = currentStationNode.cumulativeDistanceKm;
      } else if (liveData.currentStation?.name) {
        const match = liveData.stations.find(s => s.name === liveData.currentStation.name || s.code === liveData.currentStation.code);
        if (match && match.cumulativeDistanceKm !== undefined) {
          currentTrainCumulative = match.cumulativeDistanceKm;
          isApproximateDistance = true;
        }
      }
    }
  } else {
    // Scheduled progress baseline from train start
    currentTrainCumulative = 0;
  }

  const distanceRemainingKm = Math.max(0, targetCumulative - currentTrainCumulative);
  const formattedDistanceRemaining = distanceRemainingKm % 1 === 0 ? distanceRemainingKm : Number(distanceRemainingKm.toFixed(1));

  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h2 style={{ fontSize: '1.8rem', color: '#0F172A', fontWeight: '700', letterSpacing: '-0.02em' }}>{train.trainNumber} - {train.trainName}</h2>
      </div>

      <div className="info-grid">
        <div className="info-item">
          <div className="label">Current Location</div>
          <div className="value">{(isLoading && !liveData && displayStations.length === 0) ? 'Loading...' : displayLocation}</div>
        </div>
        <div className="info-item">
          <div className="label">Status</div>
          <div className={`value ${displayDelay > 0 ? 'status-delayed' : 'status-on-time'}`}>
            {(isLoading && !liveData && displayStations.length === 0) ? 'Loading...' : displayDelay > 0 ? `${displayDelay} mins late` : 'On Time'}
          </div>
        </div>
        <div className="info-item">
          <div className="label">Next Halt</div>
          <div className="value">{(isLoading && !liveData && displayStations.length === 0) ? 'Loading...' : displayNextHalt}</div>
        </div>
        <div className="info-item">
          <div className="label">Distance To Destination</div>
          <div className="value" style={{ color: '#0f766e', fontWeight: '700' }}>
            {displayStations.length > 0 ? `${formattedDistanceRemaining} km remaining${isApproximateDistance ? ' (approx.)' : ''}` : 'Unavailable'}
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
        <button 
          className="refresh-live-btn bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium"
          onClick={() => fetchLiveData(true)}
          disabled={isLoading || isRefreshing}
          title="Refresh complete live route data including all halting and non-halting locations"
          style={{
            backgroundColor: '#1e293b',
            color: '#f1f5f9',
            fontWeight: '500',
            padding: '0.6rem 1.1rem',
            borderRadius: '10px',
            border: '1px solid #334155',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: (isLoading || isRefreshing) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || isRefreshing) ? 0.75 : 1,
            transition: 'background-color 0.2s ease, border-color 0.2s ease',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)'
          }}
        >
          <span style={{ display: 'inline-block', transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s' }}>🔄</span>
          {isRefreshing ? 'Refreshing Status...' : 'Refresh Live Status'}
        </button>

        {(!isLoading || isRefreshing) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.85rem', fontWeight: '500' }}>
            <div className={`live-indicator ${isRefreshing ? 'pulse-subtle' : ''}`}></div>
            <span>LIVE • {isRefreshing ? 'Updating...' : (lastUpdated !== 'N/A' ? `Last updated ${lastUpdated}` : 'Real-time')}</span>
          </div>
        )}
      </div>

      {/* Alternate Travel Options Component (Triggers banner when delay >= 45m) */}
      <AlternateOptionsCard
        fromStation={train.userSelectedFrom || train.fromStation || displayStations[0]?.name || 'Origin'}
        toStation={selectedDestination?.name || selectedDestination?.code || 'Destination'}
        distanceKm={formattedDistanceRemaining || targetCumulative}
        delayMinutes={displayDelay}
        currentTrainNumber={train.trainNumber}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h3 style={{ margin: 0, color: '#0F172A', fontWeight: '700', fontSize: '1.3rem' }}>Route Timeline</h3>
        <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: '500' }}>
          {displayStations.length} locations ({displayStations.filter(s => s.isHalt !== false && s.locationType !== 'non-halting').length} halts)
        </span>
      </div>

      <div className="timeline-container">
        {displayStations.length === 0 ? (
          <div style={{ color: '#888', fontStyle: 'italic', padding: '1rem', textAlign: 'center' }}>Station route unavailable</div>
        ) : (
          displayStations.map((station, index) => {
            const isSelected = index === selectedDestinationIndex;
            const isPast = station.status === 'PASSED';
            const isCurrent = station.status === 'CURRENT';
            const isLast = index === displayStations.length - 1;
            const isNonHalt = station.isHalt === false || station.locationType === 'non-halting';
            const isHaltStation = station.locationType === 'halt';

            // Distance calculation between consecutive entries
            const nextStation = displayStations[index + 1];
            const stepDistToNext = nextStation
              ? Math.max(0, (nextStation.cumulativeDistanceKm ?? 0) - (station.cumulativeDistanceKm ?? 0))
              : 0;

            const fromPrev = station.distanceFromPreviousKm !== undefined
              ? station.distanceFromPreviousKm
              : (index === 0 ? 0 : Math.max(0, (station.cumulativeDistanceKm || 0) - (displayStations[index - 1]?.cumulativeDistanceKm || 0)));

            const fromOrigin = station.cumulativeDistanceKm !== undefined
              ? station.cumulativeDistanceKm
              : (station.distanceFromOrigin !== undefined ? station.distanceFromOrigin : 0);

            const totalDist = displayStations[displayStations.length - 1]?.cumulativeDistanceKm ?? 0;
            const rem = index === displayStations.length - 1
              ? 0
              : Math.max(0, totalDist - fromOrigin);

            const fmtPrev = fromPrev % 1 === 0 ? fromPrev : Number(fromPrev.toFixed(1));
            const fmtOrigin = fromOrigin % 1 === 0 ? fromOrigin : Number(fromOrigin.toFixed(1));
            const fmtRem = rem % 1 === 0 ? rem : Number(rem.toFixed(1));
            const fmtStepToNext = stepDistToNext % 1 === 0 ? stepDistToNext : Number(stepDistToNext.toFixed(1));

            // Station presentation according to requirements:
            // Station: Name (Code)
            // Halt: Name (Code), if code exists
            // Non-halting location: Name
            const displayName = isNonHalt
              ? (station.name || station)
              : `${station.name || station}${station.code ? ` (${station.code})` : ''}`;

            const stableStationKey = station.stationCode || station.code || station.name || `stn-${station.sequence ?? index}`;

            return (
              <div 
                key={stableStationKey}
                className={`timeline-node ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedDestinationIndex(index)}
              >
                {!isLast && (
                  <div className="timeline-line-wrapper">
                    <div className={`timeline-line ${isPast ? 'past' : ''} ${isNonHalt ? 'non-halt' : ''}`}></div>
                    {fmtStepToNext > 0 && (
                      <span className="distance-badge">
                        +{fmtStepToNext} km
                      </span>
                    )}
                  </div>
                )}
                
                <div className="timeline-icon-container">
                  {isCurrent ? (
                    <div className="current-train-icon">🚂</div>
                  ) : (
                    <div className={`timeline-dot ${isPast ? 'past' : ''} ${isSelected ? 'selected' : ''} ${isNonHalt ? 'non-halt' : ''}`}></div>
                  )}
                </div>

                <div className="timeline-content">
                  <div className="station-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <div className={`station-name ${isCurrent ? 'current' : ''} ${isSelected ? 'selected' : ''} ${isNonHalt ? 'non-halt' : ''}`}>
                        {displayName}
                      </div>
                      {!isNonHalt && station.expectedPlatform && (
                        <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: '500', marginTop: '2px' }}>
                          Platform: {station.expectedPlatform}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                        <span className={`type-badge ${isNonHalt ? 'non-halt' : isHaltStation ? 'halt' : 'station'}`}>
                          {isNonHalt ? 'Non-halting location' : isHaltStation ? 'Halt' : 'Station'}
                        </span>
                        <div className="status-badge" style={{ 
                          fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                          backgroundColor: station.status === 'CURRENT' ? '#0284c7' : station.status === 'DESTINATION' ? '#0369a1' : 'rgba(100, 116, 139, 0.12)',
                          color: station.status === 'CURRENT' || station.status === 'DESTINATION' ? '#ffffff' : '#475569',
                          border: station.status === 'CURRENT' || station.status === 'DESTINATION' ? 'none' : '1px solid rgba(100, 116, 139, 0.25)'
                        }}>
                          {station.status || (isCurrent ? 'CURRENT' : '')}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#0f766e', fontWeight: '700' }}>
                        {fmtOrigin} km
                      </div>
                    </div>
                  </div>

                  {/* Real Railway Distance Details */}
                  <div className="station-distances" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem', color: '#475569', fontWeight: '500', marginTop: '4px', marginBottom: '4px', alignItems: 'center' }}>
                    <span>📍 {fmtPrev} km from previous</span>
                    <span>•</span>
                    <span>🚩 {fmtOrigin} km from origin</span>
                    <span>•</span>
                    <span style={{ color: '#0f766e', fontWeight: '700' }}>🏁 {fmtRem} km to destination</span>
                  </div>

                  {/* Timing Information */}
                  {isNonHalt ? (
                    (station.scheduledArrival || station.actualArrival || station.expectedArrival) && (
                      <div className="time-row non-halt-time" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', backgroundColor: 'rgba(241, 245, 249, 0.85)', border: '1px solid rgba(203, 213, 225, 0.7)', padding: '5px 8px', borderRadius: '6px', fontSize: '0.75rem' }}>
                        <div className="time-block">
                          <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '600' }}>
                            {station.status === 'PASSED' ? 'Passed At' : 'Expected Passage'}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0F172A' }}>
                            {formatTime(
                              station.status === 'PASSED'
                                ? (station.actualArrival || station.actualDeparture || station.expectedArrival || station.scheduledArrival)
                                : (station.expectedArrival || station.expectedDeparture || station.scheduledArrival)
                            )}
                          </div>
                        </div>
                        {station.delayMinutes !== undefined && station.delayMinutes !== null && (
                          <div className="time-block" style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '600' }}>Delay</div>
                            <div style={{ fontSize: '0.8rem', fontWeight: '700', color: station.delayMinutes > 0 ? '#dc2626' : '#059669' }}>
                              {station.delayMinutes > 0 ? `+${station.delayMinutes} min` : 'On time'}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    (station.scheduledArrival || station.scheduledDeparture) && (
                      <div className="time-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', backgroundColor: 'rgba(241, 245, 249, 0.85)', border: '1px solid rgba(203, 213, 225, 0.7)', padding: '6px 8px', borderRadius: '6px' }}>
                        <div className="time-block">
                          <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '600' }}>Scheduled</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0F172A' }}>
                            {formatTime(station.scheduledArrival || station.scheduledDeparture)}
                          </div>
                        </div>
                        <div className="time-block">
                          <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '600' }}>
                            {station.status === 'PASSED' ? 'Actual' : 'Expected'}
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0F172A' }}>
                            {formatTime(
                              station.status === 'PASSED'
                                ? (station.actualArrival || station.actualDeparture || station.expectedArrival || station.scheduledArrival)
                                : (station.expectedArrival || station.expectedDeparture || station.scheduledArrival)
                            )}
                          </div>
                        </div>
                        <div className="time-block">
                          <div style={{ fontSize: '0.65rem', color: '#475569', fontWeight: '600' }}>Delay</div>
                          <div style={{ fontSize: '0.8rem', fontWeight: '700', color: station.delayMinutes > 0 ? '#dc2626' : '#059669' }}>
                            {station.delayMinutes > 0 ? `+${station.delayMinutes} min` : 'On time'}
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <h3 style={{ marginBottom: '1rem', color: '#0F172A', fontWeight: '700' }}>Alert me based on:</h3>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <button className={`distance-btn ${alarmType === 'distance' ? 'active' : ''}`} onClick={() => setAlarmType('distance')}>Distance</button>
        <button className={`distance-btn ${alarmType === 'time' ? 'active' : ''}`} onClick={() => setAlarmType('time')}>Time</button>
      </div>

      {alarmType === 'distance' ? (
        <div className="alert-config-grid">
          {[30, 20, 10].map(dist => (
            <button key={dist} className={`alert-option-btn ${alertDistance === dist ? 'active' : ''}`} onClick={() => setAlertDistance(dist)}>{dist} km before</button>
          ))}
        </div>
      ) : (
        <div className="alert-config-grid">
          {[30, 15].map(time => (
            <button key={time} className={`alert-option-btn ${alertTime === time ? 'active' : ''}`} onClick={() => setAlertTime(time)}>{time} mins before</button>
          ))}
        </div>
      )}

      <button className="set-alarm-btn" onClick={handleSetAlarm}>
        🔔 START JOURNEY ALERT
      </button>
    </div>
  );
}
