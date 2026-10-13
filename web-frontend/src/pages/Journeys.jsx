import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchUserJourneys, deleteJourneyRecord } from '../utils/journeyService';
import { getUser } from '../utils/authService';

export default function Journeys() {
  const navigate = useNavigate();
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = getUser();

  const loadJourneys = async () => {
    setLoading(true);
    try {
      const records = await fetchUserJourneys();
      setJourneys(records);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJourneys();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this journey record?')) {
      await deleteJourneyRecord(id);
      setJourneys(prev => prev.filter(j => j.id !== id));
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button 
            type="button"
            className="back-btn" 
            onClick={() => navigate('/')} 
            style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#0F172A', fontWeight: '700' }}>My Journeys</h2>
          <div style={{ width: '60px' }}></div>
        </div>

        {currentUser && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid rgba(203, 213, 225, 0.7)',
            padding: '0.8rem 1.2rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '600' }}>Passenger: </span>
              <span style={{ fontWeight: '700', color: '#0F172A' }}>{currentUser.name}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '700' }}>☁️ Cloud Sync Active</span>
          </div>
        )}

        {loading ? (
          <div className="loader" style={{ margin: '3rem auto' }}></div>
        ) : journeys.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#475569' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚆</div>
            <h3 style={{ color: '#0F172A', fontWeight: '700' }}>No Journeys Recorded Yet</h3>
            <p style={{ margin: '0.5rem 0 1.5rem', fontSize: '0.95rem', color: '#475569', fontWeight: '500' }}>
              Search for any train and activate destination alerts to see your journeys listed here.
            </p>
            <button className="search-btn" onClick={() => navigate('/')}>
              Find Trains Now
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {journeys.map((j) => (
              <div 
                key={j.id} 
                className="glass-panel"
                style={{
                  padding: '1.2rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--glass-border)',
                  transition: 'transform 0.2s'
                }}
                onClick={() => navigate('/')}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: '700', color: '#0284c7', fontSize: '1.1rem' }}>
                      🚆 {j.trainNumber}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: '700',
                      background: j.status === 'completed' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                      color: j.status === 'completed' ? '#047857' : '#0369a1'
                    }}>
                      {j.status ? j.status.toUpperCase() : 'ACTIVE'}
                    </span>
                  </div>
                  
                  <div style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: '600', marginBottom: '0.4rem' }}>
                    {j.trainName || 'Express Train'}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: '500' }}>
                    <span>📍 {j.boardingStation}</span>
                    <span style={{ margin: '0 0.5rem' }}>→</span>
                    <span style={{ color: '#0284c7', fontWeight: '700' }}>🏁 {j.destinationStation}</span>
                  </div>

                  {j.alertDistance && (
                    <div style={{ fontSize: '0.75rem', color: '#475569', fontWeight: '500', marginTop: '0.3rem' }}>
                      🔔 Alert Threshold: {j.alertDistance} km
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(j.id, e)}
                    style={{
                      background: '#fff',
                      border: '1px solid #dc2626',
                      color: '#dc2626',
                      borderRadius: '6px',
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.8rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                    title="Delete Record"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
