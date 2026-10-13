import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { processStationDistances } from '../utils/railwayDistance';
import { demoTrainMap } from '../data/trainsData';
import { fetchLiveTrainData } from '../services/liveTrackingService';
import { formatTimeWithContext } from '../utils/timeUtils';
import { getSettings } from '../utils/settingsService';
import { createJourney } from '../utils/journeyService';
import { 
  getUser, 
  isAuthenticated, 
  getWalletBalance, 
  deductWalletBalance, 
  updateWalletBalance, 
  formatWalletBalance 
} from '../utils/authService';
import AlternateOptionsCard from '../components/AlternateOptionsCard';
import AuthModal from '../components/AuthModal';

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

  // Auth and Wallet State
  const [currentUser, setCurrentUser] = useState(getUser);
  const [walletBalance, setWalletBalance] = useState(getWalletBalance);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingBookingAfterLogin, setPendingBookingAfterLogin] = useState(false);

  // Booking Modals State
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookedTicketData, setBookedTicketData] = useState(null);
  const [pnrCopied, setPnrCopied] = useState(false);

  // In-modal quick top-up state
  const [showInModalTopUp, setShowInModalTopUp] = useState(false);
  const [quickTopUpInput, setQuickTopUpInput] = useState('');
  const [quickTopUpMsg, setQuickTopUpMsg] = useState(null);

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

  // Listen for auth and wallet changes across components
  useEffect(() => {
    const handleAuthChange = (e) => {
      const newUser = e.detail?.user || null;
      setCurrentUser(newUser);
      setWalletBalance(getWalletBalance());
      if (newUser && pendingBookingAfterLogin) {
        setPendingBookingAfterLogin(false);
        setIsBookingModalOpen(true);
      }
    };

    const handleWalletChange = (e) => {
      if (typeof e.detail?.balance === 'number') {
        setWalletBalance(e.detail.balance);
      } else {
        setWalletBalance(getWalletBalance());
      }
    };

    window.addEventListener('railsafe:auth-changed', handleAuthChange);
    window.addEventListener('railsafe:wallet-changed', handleWalletChange);

    return () => {
      window.removeEventListener('railsafe:auth-changed', handleAuthChange);
      window.removeEventListener('railsafe:wallet-changed', handleWalletChange);
    };
  }, [pendingBookingAfterLogin]);

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

  // Route & Distance calculations for Ticket Booking
  const startStationName = train.userSelectedFrom || train.fromStation || (displayStations[0]?.name) || 'Origin';
  const boardingStation = displayStations.find(s => 
    (s.name && s.name.toLowerCase() === startStationName.toLowerCase()) ||
    (s.code && s.code.toLowerCase() === startStationName.toLowerCase())
  ) || displayStations[0];

  const destinationStation = selectedDestination;
  const boardingKm = boardingStation?.cumulativeDistanceKm ?? boardingStation?.distanceFromOrigin ?? 0;
  const destKm = destinationStation?.cumulativeDistanceKm ?? destinationStation?.distanceFromOrigin ?? 0;

  let ticketDistanceKm = Math.round(Math.abs(destKm - boardingKm) * 10) / 10;
  if (ticketDistanceKm <= 0) {
    ticketDistanceKm = Math.max(10, destinationStation?.distanceFromPreviousKm || 25);
  }

  // Ticket fare calculation (Official Indian Railways rate ₹1.5 / km, minimum fare ₹30)
  const ticketFare = Math.max(30, Math.round(ticketDistanceKm * 1.5 * 100) / 100);
  const remainingWalletAfterBooking = Math.round((walletBalance - ticketFare) * 100) / 100;
  const isInsufficientBalance = walletBalance < ticketFare;
  const balanceDeficit = isInsufficientBalance ? Math.round((ticketFare - walletBalance) * 100) / 100 : 0;

  const handleSetAlarm = () => {
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

  const handleInitiateBooking = () => {
    if (!isAuthenticated()) {
      setPendingBookingAfterLogin(true);
      setIsAuthModalOpen(true);
      return;
    }
    setBookingError(null);
    setShowInModalTopUp(false);
    setIsBookingModalOpen(true);
  };

  const handleInModalQuickAdd = (amt) => {
    try {
      const newBal = updateWalletBalance(amt);
      setWalletBalance(newBal);
      setQuickTopUpMsg(`Added ₹${amt} successfully!`);
      setTimeout(() => setQuickTopUpMsg(null), 2000);
    } catch (e) {
      setBookingError(e.message);
    }
  };

  const handleInModalCustomAdd = (e) => {
    e.preventDefault();
    const val = parseFloat(quickTopUpInput);
    if (isNaN(val) || val <= 0) return;
    try {
      const newBal = updateWalletBalance(val);
      setWalletBalance(newBal);
      setQuickTopUpInput('');
      setShowInModalTopUp(false);
      setQuickTopUpMsg(`Added ₹${val.toFixed(2)} successfully!`);
      setTimeout(() => setQuickTopUpMsg(null), 2000);
    } catch (err) {
      setBookingError(err.message);
    }
  };

  const handleConfirmBooking = async () => {
    try {
      setBookingLoading(true);
      setBookingError(null);

      // 1. Deduct ticket fare from wallet
      const newBal = deductWalletBalance(ticketFare);
      setWalletBalance(newBal);

      // 2. Generate 10-digit mock PNR in Indian Railway format
      const pnrPart1 = Math.floor(100 + Math.random() * 900);
      const pnrPart2 = Math.floor(1000000 + Math.random() * 9000000);
      const mockPnr = `${pnrPart1}-${pnrPart2}`;

      const newTicket = {
        pnr: mockPnr,
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        source: boardingStation?.name || startStationName,
        destination: destinationStation?.name || destinationStation?.code || 'Destination',
        distanceKm: ticketDistanceKm,
        fare: ticketFare,
        remainingBalance: newBal,
        passengerName: currentUser?.name || 'Passenger',
        passengerEmail: currentUser?.email || '',
        bookedAt: new Date().toISOString()
      };

      // 3. Persist journey record to local storage / backend
      await createJourney({
        trainNumber: train.trainNumber,
        trainName: train.trainName,
        boardingStation: newTicket.source,
        destinationStation: newTicket.destination,
        alertDistance: alarmType === 'distance' ? alertDistance : Math.round(alertTime * 0.8),
        status: 'booked',
        pnr: mockPnr,
        fare: ticketFare,
        distanceKm: ticketDistanceKm
      }).catch(e => console.warn('Journey save notice:', e));

      setBookedTicketData(newTicket);
      setIsBookingModalOpen(false);
      setIsSuccessModalOpen(true);
    } catch (err) {
      setBookingError(err.message || 'Booking transaction failed. Please check wallet balance.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCopyPnr = () => {
    if (bookedTicketData?.pnr && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(bookedTicketData.pnr);
      setPnrCopied(true);
      setTimeout(() => setPnrCopied(false), 2500);
    }
  };

  // Determine current train location optimistically
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
    
    // Determine next halt station
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
    const firstUpcoming = displayStations.find(s => s.isHalt !== false && s.locationType !== 'non-halting') || displayStations[1] || displayStations[0];
    displayLocation = displayStations[0]?.name ? `Departing ${displayStations[0].name}` : 'Scheduled Route';
    displayNextHalt = firstUpcoming ? `${firstUpcoming.name}${firstUpcoming.code ? ` (${firstUpcoming.code})` : ''}` : 'N/A';
  } else if (isLoading) {
    displayLocation = 'Loading...';
    displayNextHalt = 'Loading...';
  }

  const displayDelay = liveData?.delayMinutes ?? train.delayMinutes ?? 0;
  const lastUpdated = liveData?.lastUpdatedAt ? new Date(liveData.lastUpdatedAt).toLocaleTimeString() : 'N/A';

  // Calculate dynamic distance to the user-selected destination station
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
    currentTrainCumulative = 0;
  }

  const distanceRemainingKm = Math.max(0, targetCumulative - currentTrainCumulative);
  const formattedDistanceRemaining = distanceRemainingKm % 1 === 0 ? distanceRemainingKm : Number(distanceRemainingKm.toFixed(1));

  return (
    <div className="glass-panel" style={{ flex: 1 }}>
      <div className="details-header">
        <button className="back-btn" onClick={() => navigate('/')}>←</button>
        <h2 style={{ fontSize: '1.8rem', color: 'var(--text-primary, #0F172A)', fontWeight: '700', letterSpacing: '-0.02em' }}>
          {train.trainNumber} - {train.trainName}
        </h2>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted, #475569)', fontSize: '0.85rem', fontWeight: '500' }}>
            <div className={`live-indicator ${isRefreshing ? 'pulse-subtle' : ''}`}></div>
            <span>LIVE • {isRefreshing ? 'Updating...' : (lastUpdated !== 'N/A' ? `Last updated ${lastUpdated}` : 'Real-time')}</span>
          </div>
        )}
      </div>

      {/* Alternate Travel Options Component */}
      <AlternateOptionsCard
        fromStation={train.userSelectedFrom || train.fromStation || displayStations[0]?.name || 'Origin'}
        toStation={selectedDestination?.name || selectedDestination?.code || 'Destination'}
        distanceKm={formattedDistanceRemaining || targetCumulative}
        delayMinutes={displayDelay}
        currentTrainNumber={train.trainNumber}
      />

      {/* TICKET BOOKING WITH WALLET CALLOUT CARD */}
      <div style={{
        background: 'rgba(2, 132, 199, 0.08)',
        border: '1px solid rgba(2, 132, 199, 0.3)',
        borderRadius: '16px',
        padding: '1.2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
        boxShadow: '0 4px 20px rgba(2, 132, 199, 0.08)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🎫</span>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary, #0F172A)' }}>
                Instant Ticket Booking
              </h4>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #475569)' }}>
                Indian Railways rate: ₹1.50 / km • Pay via RailSafe Wallet
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0284c7' }}>
              ₹{ticketFare.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: '700' }}>
              {ticketDistanceKm} km railway distance
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.7)',
          padding: '0.6rem 0.9rem',
          borderRadius: '10px',
          border: '1px solid rgba(203, 213, 225, 0.6)'
        }}>
          <div style={{ fontSize: '0.86rem', color: 'var(--text-primary, #0F172A)' }}>
            <span style={{ fontWeight: '600' }}>📍 {boardingStation?.name || startStationName}</span>
            <span style={{ color: '#94a3b8', margin: '0 6px' }}>→</span>
            <span style={{ fontWeight: '700', color: '#0284c7' }}>
              🏁 {destinationStation?.name || 'Destination'}{destinationStation?.code ? ` (${destinationStation.code})` : ''}
            </span>
          </div>

          {currentUser ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #475569)' }}>
              Wallet: <span style={{ fontWeight: '700', color: isInsufficientBalance ? '#dc2626' : '#059669' }}>{formatWalletBalance(walletBalance)}</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: '600' }}>
              Complimentary ₹1,000 on Sign In
            </div>
          )}
        </div>

        <button
          type="button"
          id="book-ticket-wallet-btn"
          onClick={handleInitiateBooking}
          style={{
            padding: '0.85rem 1.4rem',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #0284c7, #0369a1)',
            color: '#ffffff',
            fontSize: '0.95rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          <span>👛</span>
          <span>Book Ticket with Wallet • ₹{ticketFare.toFixed(2)}</span>
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary, #0F172A)', fontWeight: '700', fontSize: '1.3rem' }}>Route Timeline</h3>
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted, #475569)', fontWeight: '500' }}>
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
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #475569)', fontWeight: '500', marginTop: '2px' }}>
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
                  <div className="station-distances" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted, #475569)', fontWeight: '500', marginTop: '4px', marginBottom: '4px', alignItems: 'center' }}>
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

      <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary, #0F172A)', fontWeight: '700' }}>Alert me based on:</h3>
      
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

      {/* CONFIRM TICKET BOOKING MODAL */}
      {isBookingModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            position: 'relative',
            background: 'var(--glass-bg, rgba(15, 23, 42, 0.94))',
            color: 'var(--text-primary, #0F172A)',
            border: '1px solid var(--glass-border, rgba(56, 189, 248, 0.25))',
            borderRadius: '20px',
            padding: '1.8rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <button
              type="button"
              onClick={() => setIsBookingModalOpen(false)}
              style={{
                position: 'absolute',
                top: '1.2rem',
                right: '1.2rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: '1.4rem',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>🎫</div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                Confirm Ticket Booking
              </h3>
              <p style={{ color: 'var(--text-muted, #475569)', fontSize: '0.85rem', marginTop: '4px' }}>
                Review journey details and payment via RailSafe Wallet
              </p>
            </div>

            {/* Train and Station Details */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--glass-border, rgba(203, 213, 225, 0.4))',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <div style={{ fontWeight: '700', color: '#0284c7', fontSize: '1rem', marginBottom: '0.5rem' }}>
                🚆 {train.trainNumber} - {train.trainName}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #475569)', fontWeight: '600' }}>BOARDING</div>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary, #0F172A)' }}>
                    {boardingStation?.name || startStationName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #475569)', fontWeight: '600' }}>DESTINATION</div>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary, #0F172A)' }}>
                    {destinationStation?.name || 'Destination'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(203, 213, 225, 0.4)', marginTop: '0.6rem', paddingTop: '0.6rem', fontSize: '0.82rem' }}>
                <span>Railway Distance: <strong>{ticketDistanceKm} km</strong></span>
                <span>Fare Rate: <strong>₹1.50/km</strong></span>
              </div>
            </div>

            {/* Wallet Balance & Payment Summary */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Ticket Fare:</span>
                <span style={{ fontWeight: '700', color: '#0284c7' }}>₹{ticketFare.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.88rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Current Wallet Balance:</span>
                <span style={{ fontWeight: '700' }}>{formatWalletBalance(walletBalance)}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                borderTop: '1px dashed rgba(2, 132, 199, 0.3)', 
                paddingTop: '0.4rem',
                fontSize: '0.92rem',
                fontWeight: '700'
              }}>
                <span>Remaining Balance:</span>
                <span style={{ color: isInsufficientBalance ? '#dc2626' : '#059669' }}>
                  {formatWalletBalance(Math.max(0, remainingWalletAfterBooking))}
                </span>
              </div>
            </div>

            {/* Insufficient Balance Prompt & Quick Add Drawer */}
            {isInsufficientBalance && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '12px',
                padding: '0.9rem',
                marginBottom: '1.2rem'
              }}>
                <div style={{ color: '#dc2626', fontWeight: '700', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span>
                  <span>Insufficient Wallet Balance!</span>
                </div>
                <p style={{ margin: '4px 0 8px', fontSize: '0.82rem', color: 'var(--text-secondary, #475569)' }}>
                  You need <strong>₹{balanceDeficit.toFixed(2)}</strong> more to book this ticket.
                </p>

                {quickTopUpMsg && (
                  <div style={{ color: '#059669', fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px' }}>
                    🎉 {quickTopUpMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {[200, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleInModalQuickAdd(amt)}
                      style={{
                        padding: '0.4rem 0.7rem',
                        borderRadius: '6px',
                        border: '1px solid #0284c7',
                        background: '#0284c7',
                        color: '#fff',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      +₹{amt}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowInModalTopUp(!showInModalTopUp)}
                    style={{
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      border: '1px solid var(--glass-border, #cbd5e1)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      color: 'var(--text-primary, #0F172A)',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Custom Amount
                  </button>
                </div>

                {showInModalTopUp && (
                  <form onSubmit={handleInModalCustomAdd} style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      placeholder="Amount (₹)"
                      value={quickTopUpInput}
                      onChange={(e) => setQuickTopUpInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.4rem 0.7rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem'
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        padding: '0.4rem 0.9rem',
                        borderRadius: '6px',
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                    >
                      Add
                    </button>
                  </form>
                )}
              </div>
            )}

            {bookingError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#dc2626',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                ⚠️ {bookingError}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text-secondary, #475569)',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                id="confirm-booking-btn"
                disabled={isInsufficientBalance || bookingLoading}
                onClick={handleConfirmBooking}
                style={{
                  flex: 2,
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: isInsufficientBalance ? 'rgba(100, 116, 139, 0.3)' : 'var(--success, #059669)',
                  color: '#ffffff',
                  fontWeight: '700',
                  cursor: isInsufficientBalance || bookingLoading ? 'not-allowed' : 'pointer',
                  boxShadow: isInsufficientBalance ? 'none' : '0 4px 15px rgba(5, 150, 105, 0.35)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {bookingLoading ? (
                  <span className="loader-small"></span>
                ) : isInsufficientBalance ? (
                  'Insufficient Balance'
                ) : (
                  `Confirm & Pay ₹${ticketFare.toFixed(2)}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING SUCCESS MODAL WITH MOCK PNR */}
      {isSuccessModalOpen && bookedTicketData && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 7, 18, 0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '460px',
            position: 'relative',
            background: 'var(--glass-bg, rgba(15, 23, 42, 0.94))',
            color: 'var(--text-primary, #0F172A)',
            border: '1px solid rgba(5, 150, 105, 0.4)',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(5, 150, 105, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.8rem',
              fontSize: '2rem',
              boxShadow: '0 8px 25px rgba(5, 150, 105, 0.25)'
            }}>
              🎉
            </div>

            <h3 style={{ fontSize: '1.45rem', fontWeight: '800', color: '#059669', margin: '0 0 4px' }}>
              Ticket Booked Successfully!
            </h3>
            <p style={{ color: 'var(--text-muted, #475569)', fontSize: '0.85rem', marginBottom: '1.2rem' }}>
              Your electronic reservation slip has been confirmed via RailSafe Alert
            </p>

            {/* PNR Box */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.1)',
              border: '2px dashed #0284c7',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.2rem'
            }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted, #475569)', fontWeight: '700' }}>
                INDIAN RAILWAYS PNR NUMBER
              </div>
              <div style={{ fontSize: '1.7rem', fontWeight: '800', color: '#0284c7', letterSpacing: '1px', margin: '4px 0' }}>
                {bookedTicketData.pnr}
              </div>
              <button
                type="button"
                id="copy-pnr-btn"
                onClick={handleCopyPnr}
                style={{
                  background: pnrCopied ? '#059669' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {pnrCopied ? '✅ PNR Copied!' : '📋 Copy PNR'}
              </button>
            </div>

            {/* Ticket Summary Details */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--glass-border, rgba(203, 213, 225, 0.4))',
              borderRadius: '12px',
              padding: '0.9rem',
              marginBottom: '1.5rem',
              textAlign: 'left',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Train:</span>
                <span style={{ fontWeight: '700', color: 'var(--text-primary, #0F172A)' }}>
                  {bookedTicketData.trainNumber} - {bookedTicketData.trainName}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Route:</span>
                <span style={{ fontWeight: '600' }}>
                  {bookedTicketData.source} → {bookedTicketData.destination}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Distance:</span>
                <span style={{ fontWeight: '600' }}>{bookedTicketData.distanceKm} km</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Fare Paid:</span>
                <span style={{ fontWeight: '700', color: '#0284c7' }}>₹{bookedTicketData.fare.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(203, 213, 225, 0.3)', paddingTop: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted, #475569)' }}>Remaining Wallet:</span>
                <span style={{ fontWeight: '700', color: '#059669' }}>
                  {formatWalletBalance(bookedTicketData.remainingBalance)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                type="button"
                id="success-view-journeys-btn"
                onClick={() => navigate('/journeys')}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
                }}
              >
                🎒 View in My Journeys
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSuccessModalOpen(false);
                  handleSetAlarm();
                }}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: '1px solid var(--glass-border, #cbd5e1)',
                  background: 'transparent',
                  color: 'var(--text-primary, #0F172A)',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                🔔 Start Destination Alert & Track
              </button>

              <button
                type="button"
                onClick={() => setIsSuccessModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted, #475569)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auth Modal Trigger */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setWalletBalance(getWalletBalance());
          if (user && pendingBookingAfterLogin) {
            setPendingBookingAfterLogin(false);
            setIsBookingModalOpen(true);
          }
        }}
      />
    </div>
  );
}
