import { memo } from 'react';
import { formatTimeWithContext, calculateLiveETA } from '../utils/timeUtils';

function StationTimelineNode({
  station,
  index,
  totalStations,
  nextStation,
  destination,
  displayDelay
}) {
  const isCurrent = station.status === 'CURRENT';
  const isPast = station.status === 'PASSED';
  const isSelected = (station.code && station.code === destination?.code) || 
                     ((station.name || station).toLowerCase() === (destination?.name || destination || '').toLowerCase());
  const isLast = index === totalStations - 1;
  const isNonHalt = station.isHalt === false || station.locationType === 'non-halting';
  const isHaltStation = station.locationType === 'halt';

  const stepDistToNext = nextStation
    ? Math.max(0, (nextStation.cumulativeDistanceKm ?? nextStation.distanceFromOrigin ?? 0) - (station.cumulativeDistanceKm ?? station.distanceFromOrigin ?? 0))
    : 0;

  const fromPrev = station.distanceFromPreviousKm !== undefined
    ? station.distanceFromPreviousKm
    : (station.distanceFromPrevious !== undefined ? station.distanceFromPrevious : 0);

  const fromOrigin = station.cumulativeDistanceKm !== undefined
    ? station.cumulativeDistanceKm
    : (station.distanceFromOrigin !== undefined ? station.distanceFromOrigin : 0);

  const rem = station.distanceRemainingKm !== undefined ? station.distanceRemainingKm : (station.distanceRemaining || 0);

  const fmtPrev = fromPrev % 1 === 0 ? fromPrev : Number(fromPrev.toFixed(1));
  const fmtOrigin = fromOrigin % 1 === 0 ? fromOrigin : Number(fromOrigin.toFixed(1));
  const fmtRem = rem % 1 === 0 ? rem : Number(rem.toFixed(1));
  const fmtStepToNext = stepDistToNext % 1 === 0 ? stepDistToNext : Number(stepDistToNext.toFixed(1));

  const displayName = isNonHalt
    ? (station.name || station)
    : `${station.name || station}${station.code ? ` (${station.code})` : ''}`;

  return (
    <div 
      className={`timeline-node ${isSelected ? 'selected' : ''}`}
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
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              <span className={`type-badge ${isNonHalt ? 'non-halt' : isHaltStation ? 'halt' : 'station'}`}>
                {isNonHalt ? 'Non-halting location' : isHaltStation ? 'Halt' : 'Station'}
              </span>
              <div className="status-badge" style={{ 
                fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold',
                backgroundColor: station.status === 'CURRENT' ? '#0284c7' : station.status === 'PASSED' ? '#0369a1' : 'rgba(100, 116, 139, 0.12)',
                color: station.status === 'CURRENT' || station.status === 'PASSED' ? '#ffffff' : '#475569',
                border: station.status === 'CURRENT' || station.status === 'PASSED' ? 'none' : '1px solid rgba(100, 116, 139, 0.25)',
                display: 'inline-block'
              }}>
                {station.status || (isCurrent ? 'CURRENT' : (isPast ? 'PASSED' : 'UPCOMING'))}
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

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', paddingRight: '10px' }}>
          <div>
            {station.scheduledArrival && (
              <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '600' }}>
                {isNonHalt ? 'Passage: ' : 'Sch Arr: '}{formatTimeWithContext(station.scheduledArrival)}
              </div>
            )}
            {(station.status === 'PASSED' || isPast) ? (
              (station.actualArrival || station.actualDeparture || station.expectedArrival) && (
                <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: '700' }}>
                  Act Arr: {formatTimeWithContext(station.actualArrival || station.actualDeparture || station.expectedArrival)}
                </div>
              )
            ) : (
              (station.expectedArrival || station.scheduledArrival) && (
                <div style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: '600' }}>
                  Exp Arr: {formatTimeWithContext(station.expectedArrival || calculateLiveETA(station, displayDelay))}
                </div>
              )
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            {isCurrent && (
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 'bold' }}>Train is here!</div>
            )}
            {station.delayMinutes > 0 && (
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#dc2626' }}>
                +{station.delayMinutes}m
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(StationTimelineNode);
