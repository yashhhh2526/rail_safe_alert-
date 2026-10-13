import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchAlternateTravelOptions } from '../services/alternativeTravelService';

/**
 * AlternateOptionsCard Component
 * Displays alternative travel options (Trains, Interstate Buses, Cabs, Flights)
 * Features an automatic delay warning banner when train delay exceeds 45 minutes,
 * robust 4-state async handling (idle, loading, error, success), and modal booking links.
 */
export default function AlternateOptionsCard({
  fromStation = '',
  toStation = '',
  distanceKm = null,
  delayMinutes = 0,
  currentTrainNumber = '',
  initiallyOpen = false
}) {
  const isHeavyDelay = Number(delayMinutes || 0) >= 45;
  const [isExpanded, setIsExpanded] = useState(() => isHeavyDelay || initiallyOpen);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'success'
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Automatically expand if a heavy delay is detected
  useEffect(() => {
    if (isHeavyDelay) {
      setIsExpanded(true);
    }
  }, [isHeavyDelay]);

  // Fetch alternate travel options when expanded and valid parameters exist
  const loadOptions = useCallback(async (forceRefresh = false) => {
    const cleanFrom = String(fromStation || '').trim();
    const cleanTo = String(toStation || '').trim();

    if (!cleanFrom || !cleanTo) {
      setStatus('idle');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const result = await fetchAlternateTravelOptions({
        from: cleanFrom,
        to: cleanTo,
        distance: distanceKm,
        currentTrain: currentTrainNumber,
        forceRefresh
      });

      if (result && Array.isArray(result.options)) {
        setData(result);
        setStatus('success');
      } else {
        throw new Error('No valid transit options were returned.');
      }
    } catch (err) {
      console.error('[AlternateOptionsCard] Error loading travel options:', err);
      setErrorMessage(err.message || 'Unable to retrieve alternative transit routes.');
      setStatus('error');
    }
  }, [fromStation, toStation, distanceKm, currentTrainNumber]);

  // Trigger load when expanded or when stations change
  useEffect(() => {
    if (isExpanded) {
      loadOptions(false);
    }
  }, [isExpanded, loadOptions]);

  // Filter available options
  const filteredOptions = useMemo(() => {
    if (!data?.options) return [];
    if (activeFilter === 'ALL') return data.options;
    return data.options.filter(opt => opt.category === activeFilter);
  }, [data, activeFilter]);

  // Counts for category badges
  const categoryCounts = useMemo(() => {
    const counts = { ALL: data?.options?.length || 0 };
    if (data?.options) {
      data.options.forEach(opt => {
        counts[opt.category] = (counts[opt.category] || 0) + 1;
      });
    }
    return counts;
  }, [data]);

  return (
    <div 
      className={`alternate-options-container ${isHeavyDelay ? 'heavy-delay-border' : ''} bg-slate-900/80 backdrop-blur-md border border-amber-500/30 rounded-2xl p-5 shadow-2xl transition-all duration-300`}
      style={{
        margin: '1.25rem 0',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: isHeavyDelay ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: '18px',
        boxShadow: isHeavyDelay ? '0 10px 30px rgba(245, 158, 11, 0.18)' : '0 8px 25px rgba(0, 0, 0, 0.35)',
        color: '#f8fafc',
        overflow: 'hidden'
      }}
    >
      {/* 1. HEAVY DELAY BANNER (Triggered when delay >= 45m) */}
      {isHeavyDelay && (
        <div 
          className="heavy-delay-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            marginBottom: '1rem',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.6rem', animation: 'pulse 1.5s infinite' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.98rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>HEAVY DELAY DETECTED: +{delayMinutes} MINS LATE</span>
                <span style={{ background: '#d97706', color: '#fff', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px' }}>URGENT</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '2px' }}>
                This train is heavily delayed. Recommended alternate buses, cabs & connecting trains to reach {toStation || 'destination'} on time:
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>{isExpanded ? 'Hide Options ▲' : 'View Alternatives ▼'}</span>
          </button>
        </div>
      )}

      {/* 2. CARD HEADER & COLLAPSIBLE TOGGLE (When delay < 45m) */}
      {!isHeavyDelay && (
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: '4px 0'
          }}
          onClick={() => setIsExpanded(prev => !prev)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🧭</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FFFFFF', fontWeight: '700' }}>
                Alternate Travel Options
              </h4>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#CBD5E1', fontWeight: '400' }}>
                Interstate Buses, Outstation Cabs & Parallel Trains to {toStation || 'Destination'}
              </p>
            </div>
          </div>
          <button
            type="button"
            style={{
              background: '#1e293b',
              border: '1px solid #475569',
              color: '#f8fafc',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>{isExpanded ? 'Collapse ▲' : 'Explore Alternatives ▼'}</span>
          </button>
        </div>
      )}

      {/* 3. EXPANDED CONTENT AREA */}
      {isExpanded && (
        <div style={{ marginTop: isHeavyDelay ? '0.5rem' : '1rem', animation: 'fadeIn 0.3s ease' }}>
          
          {/* Summary Route Strip */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px 12px',
            borderRadius: '10px',
            marginBottom: '1rem',
            fontSize: '0.82rem',
            color: '#cbd5e1'
          }}>
            <div>
              <span>Route: </span>
              <strong style={{ color: '#fff' }}>{fromStation || 'Origin'}</strong>
              <span style={{ margin: '0 4px', color: '#50E3C2' }}>➔</span>
              <strong style={{ color: '#fff' }}>{toStation || 'Destination'}</strong>
              {distanceKm && (
                <span style={{ marginLeft: '6px', color: '#50E3C2' }}>
                  ({Math.round(distanceKm)} km)
                </span>
              )}
            </div>

            {data?.summary && (
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
                {data.summary.fastest && (
                  <span title={data.summary.fastest}>
                    ⚡ Fastest: <strong style={{ color: '#50E3C2' }}>{data.summary.fastestDuration}</strong>
                  </span>
                )}
                {data.summary.cheapest && (
                  <span title={data.summary.cheapest}>
                    💰 From: <strong style={{ color: '#fbbf24' }}>{data.summary.cheapestCost}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Category Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', marginBottom: '1rem' }}>
            {['ALL', 'Train', 'Interstate Bus', 'Intercity Cab', 'Domestic Flight'].map((cat) => {
              const count = categoryCounts[cat] || 0;
              if (cat !== 'ALL' && count === 0) return null;

              const labelMap = {
                'ALL': 'All Options',
                'Train': '🚆 Trains',
                'Interstate Bus': '🚌 Buses',
                'Intercity Cab': '🚖 Cabs',
                'Domestic Flight': '✈️ Flights'
              };

              const isActive = activeFilter === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFilter(cat)}
                  style={{
                    background: isActive ? 'var(--primary, #3b82f6)' : 'rgba(255, 255, 255, 0.06)',
                    color: isActive ? '#fff' : '#cbd5e1',
                    border: isActive ? '1px solid #60a5fa' : '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '0.78rem',
                    fontWeight: isActive ? '600' : '400',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {labelMap[cat]} ({count})
                </button>
              );
            })}
          </div>

          {/* 4. ASYNC STATE 1: LOADING (Skeleton Screen to prevent layout shift) */}
          {status === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ width: '40%', height: '14px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px' }}></div>
                    <div style={{ width: '20%', height: '14px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px' }}></div>
                  </div>
                  <div style={{ width: '70%', height: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}></div>
                  <div style={{ width: '50%', height: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }}></div>
                </div>
              ))}
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8', padding: '4px' }}>
                Analyzing multi-modal transit options for {toStation || 'destination'}...
              </div>
            </div>
          )}

          {/* 4. ASYNC STATE 2: ERROR (User-friendly fallback card) */}
          {status === 'error' && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '12px',
                padding: '1.25rem',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>⚠️</div>
              <h5 style={{ margin: '0 0 6px', color: '#fca5a5', fontSize: '0.95rem' }}>
                Unable to Load Alternative Travel Options
              </h5>
              <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: '0.8rem' }}>
                {errorMessage || 'The transit alternatives service could not be reached.'}
              </p>
              <button
                type="button"
                onClick={() => loadOptions(true)}
                style={{
                  background: 'rgba(239, 68, 68, 0.25)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fff',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 Retry Calculation
              </button>
            </div>
          )}

          {/* 4. ASYNC STATE 3: IDLE */}
          {status === 'idle' && (
            <div style={{ textAlign: 'center', padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              Please select origin and destination stations to compute alternative transit routes.
            </div>
          )}

          {/* 4. ASYNC STATE 4: SUCCESS (Rendered List of Options) */}
          {status === 'success' && filteredOptions.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>
              No alternative transit options match the selected filter.
            </div>
          )}

          {status === 'success' && filteredOptions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredOptions.map((opt) => (
                <div
                  key={opt.id}
                  className="transit-option-card"
                  style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    transition: 'transform 0.2s ease, border-color 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  {/* Option Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.3rem' }}>{opt.icon || '🚗'}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.92rem' }}>
                            {opt.title}
                          </span>
                          {opt.badge && (
                            <span 
                              style={{ 
                                fontSize: '0.68rem', 
                                padding: '1px 6px', 
                                borderRadius: '4px', 
                                fontWeight: '600',
                                background: opt.badgeColor === 'emerald' ? 'rgba(16, 185, 129, 0.2)' 
                                          : opt.badgeColor === 'amber' ? 'rgba(245, 158, 11, 0.2)' 
                                          : opt.badgeColor === 'purple' ? 'rgba(168, 85, 247, 0.2)' 
                                          : 'rgba(59, 130, 246, 0.2)',
                                color: opt.badgeColor === 'emerald' ? '#34d399' 
                                     : opt.badgeColor === 'amber' ? '#fbbf24' 
                                     : opt.badgeColor === 'purple' ? '#c084fc' 
                                     : '#60a5fa',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {opt.operator} • {opt.type}
                        </div>
                      </div>
                    </div>

                    {/* Cost Badge */}
                    <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: '700', color: '#50E3C2', fontSize: '1rem' }}>
                        {opt.cost?.display || 'Estimate'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Est. Fare</div>
                    </div>
                  </div>

                  {/* Route & Timing Metrics */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: 'rgba(0, 0, 0, 0.2)', 
                      padding: '8px 12px', 
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: '#cbd5e1',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <span>⏱️ Duration: </span>
                      <strong style={{ color: '#fff' }}>{opt.durationFormatted}</strong>
                      <span style={{ color: '#64748b', margin: '0 4px' }}>|</span>
                      <span>📍 Distance: </span>
                      <strong style={{ color: '#fff' }}>{opt.distanceKm} km</strong>
                    </div>

                    <div>
                      <span>📅 </span>
                      <span style={{ color: '#38bdf8' }}>{opt.availability}</span>
                    </div>
                  </div>

                  {/* Features & Action Link */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {opt.features?.map((feat, i) => (
                        <span key={i} style={{ fontSize: '0.7rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                          ✓ {feat}
                        </span>
                      ))}
                    </div>

                    <a
                      href={opt.bookingUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.35)',
                        color: '#60a5fa',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.76rem',
                        fontWeight: '600',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
                    >
                      <span>{opt.bookingLabel || 'View Booking'}</span>
                      <span>↗</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Refresh Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => loadOptions(true)}
              disabled={status === 'loading'}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.74rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px'
              }}
            >
              <span>🔄</span>
              <span>{status === 'loading' ? 'Updating options...' : 'Refresh Alternatives'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
