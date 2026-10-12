import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../config/api';
import { filterClientTrains } from '../data/trainsData';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const navigate = useNavigate();

  const [recentJourneys, setRecentJourneys] = useState([]);

  useEffect(() => {
    const defaultDemoTrains = [
      { trainNumber: '12007', trainName: 'Chennai Mysore Shatabdi (SBC-BNC 4.2km)', route: 'MAS → MYS' },
      { trainNumber: '22436', trainName: 'Vande Bharat Express', route: 'NDLS → BSB' },
      { trainNumber: '12951', trainName: 'Mumbai Rajdhani (Alarm Ready)', route: 'MMCT → NDLS' },
      { trainNumber: '12004', trainName: 'Lucknow Shatabdi', route: 'NDLS → LJN' },
      { trainNumber: '12627', trainName: 'Karnataka Express (SBC-BNC 4.2km)', route: 'SBC → NDLS' },
      { trainNumber: '16360', trainName: 'Patna - Ernakulam Exp', route: 'PNBE → ERS' }
    ];

    const saved = localStorage.getItem('railSafe_recentJourneys');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure demo trains are present
      const combined = [...parsed];
      defaultDemoTrains.forEach(dt => {
        if (!combined.some(c => c.trainNumber === dt.trainNumber)) {
          combined.push(dt);
        }
      });
      setRecentJourneys(combined);
    } else {
      setRecentJourneys(defaultDemoTrains);
    }
  }, []);

  const handleRecentClick = (trainNum) => {
    setSearchQuery(trainNum);
    searchTrain(trainNum);
  };

  const searchTrain = async (query = searchQuery) => {
    // Normalize query: convert to string, remove quotes and trim whitespace
    const cleanQuery = String(query || '').replace(/^["']|["']$/g, '').trim();
    if (!cleanQuery) {
      setResults([]);
      setSearched(false);
      setSearchError(null);
      return;
    }
    setLoading(true);
    setSearched(true);
    setSearchError(null);

    // Required diagnostic console logs
    console.log("Train search query:", query);
    console.log("Train API URL:", API_URL);

    try {
      const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(cleanQuery)}`);
      console.log("Train API response:", response);

      if (!response.ok) {
        throw new Error(`API responded with HTTP status ${response.status}`);
      }

      const trains = await response.json();
      console.log("Train data:", trains);

      if (!Array.isArray(trains)) {
        throw new Error("Invalid API response format: expected array");
      }

      // Normalize comparison for frontend filtering
      const normalizedQuery = cleanQuery.toLowerCase();
      const filteredTrains = trains.filter(t => {
        const tNum = String(t.trainNumber || '').trim();
        const tNumLower = tNum.toLowerCase();
        const tNameLower = String(t.trainName || '').toLowerCase().trim();
        return (
          tNum === cleanQuery ||
          tNumLower === normalizedQuery ||
          tNumLower.includes(normalizedQuery) ||
          cleanQuery.includes(tNum) ||
          tNameLower.includes(normalizedQuery) ||
          (t.fromStation && t.fromStation.toLowerCase().includes(normalizedQuery)) ||
          (t.toStation && t.toStation.toLowerCase().includes(normalizedQuery))
        );
      });

      console.log("Filtered results:", filteredTrains);
      setResults(filteredTrains);
      setSearchError(null);
    } catch (error) {
      console.error("Search API error, utilizing local dataset fallback:", error);
      // Fallback: Check local bundled trains dataset (ensures 22436 and other trains always work)
      const offlineMatches = filterClientTrains(cleanQuery);
      if (offlineMatches && offlineMatches.length > 0) {
        console.log("Recovered matching trains from local dataset:", offlineMatches.length);
        console.log("Train data:", offlineMatches);
        console.log("Filtered results:", offlineMatches);
        setResults(offlineMatches);
        setSearchError(null);
      } else {
        // Distinguish API failure from no matching train
        setSearchError("Unable to fetch train data. Please try again.");
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        searchTrain(searchQuery);
      } else {
        setResults([]);
        setSearched(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  return (
    <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Live Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '1rem', gap: '0.5rem' }}>
          <div className="live-indicator"></div>
          <span style={{ color: 'var(--success)', fontWeight: '600', fontSize: '0.85rem', letterSpacing: '1.5px' }}>LIVE SYSTEM ACTIVE</span>
        </div>

        <div className="header" style={{ marginBottom: '2rem' }}>
          <h1>RailSafe Alert</h1>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Never miss your station again.</p>
          
          {/* Feature Cards */}
          <div className="feature-cards">
            <div className="feature-card">📡 Live Tracking</div>
            <div className="feature-card">🔔 Smart Alerts</div>
            <div className="feature-card">⏱️ ETA Prediction</div>
          </div>
        </div>

        <div className="search-container" style={{ marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Enter Train Number (e.g. 12951) or Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchTrain()}
          />
          <button onClick={() => searchTrain()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '120px' }}>
            {loading ? <span className="loader-small"></span> : 'Search'}
          </button>
        </div>

        {loading && results.length === 0 ? (
          <div className="loader"></div>
        ) : (
          <div className="results-list">
            {results.length > 0 ? (
              results.map((train) => (
                <div 
                  key={train.trainNumber} 
                  className="glass-panel train-card"
                  style={{ cursor: 'pointer', padding: '1.5rem' }}
                  onClick={() => {
                    const newRecent = { trainNumber: train.trainNumber, trainName: train.trainName, route: `${train.stations[0].name} → ${train.stations[train.stations.length - 1].name}` };
                    const updatedRecents = [newRecent, ...recentJourneys.filter(r => r.trainNumber !== train.trainNumber)].slice(0, 4);
                    setRecentJourneys(updatedRecents);
                    localStorage.setItem('railSafe_recentJourneys', JSON.stringify(updatedRecents));
                    navigate('/train', { state: { train } });
                  }}
                >
                  <div className="train-header">{train.trainNumber} - {train.trainName}</div>
                  <div className="train-route">
                    Route: {train.stations[0].name} → {train.stations[train.stations.length - 1].name}
                  </div>
                  <div className="train-platform" style={{ marginTop: '0.5rem', color: 'var(--secondary)', fontSize: '0.9rem', fontWeight: '500' }}>
                    Expected Platform: {train.expectedPlatform || 'TBD'}
                  </div>
                </div>
              ))
            ) : searchError ? (
              <p className="empty-state" style={{ color: '#ff6b6b' }}>{searchError}</p>
            ) : searched ? (
              <p className="empty-state">No trains found matching '{searchQuery}'</p>
            ) : (
              recentJourneys.length > 0 && (
                <div style={{ marginTop: '1rem', animation: 'fadeIn 0.5s ease' }}>
                  <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1rem' }}>⭐ Quick Demo Trains & Recent Searches</h3>
                  <div className="recent-journeys">
                    {recentJourneys.map((rj, idx) => (
                      <div key={rj.trainNumber || `recent-${idx}`} className="recent-card glass-panel" onClick={() => handleRecentClick(rj.trainNumber)}>
                        <div style={{ fontWeight: 'bold', color: 'var(--secondary)', marginBottom: '0.3rem' }}>🚆 {rj.trainNumber}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rj.trainName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{rj.route}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
        
        {/* Emergency Contact */}
        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <a href="tel:139" style={{ textDecoration: 'none' }}>
            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#d93025', color: 'white', padding: '1rem', cursor: 'pointer', border: 'none', transition: 'transform 0.2s', boxShadow: '0 4px 15px rgba(217, 48, 37, 0.4)' }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Railway Emergency (139)</h3>
                <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>Click here to call for security, medical, or complaints</p>
              </div>
              <div style={{ fontSize: '1.5rem', animation: 'pulse 2s infinite' }}>📞</div>
            </div>
          </a>
        </div>
      </div>
  );
}
