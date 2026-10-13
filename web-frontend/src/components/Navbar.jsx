import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getUser, fetchUserProfile } from '../utils/authService';
import AuthModal from './AuthModal';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getUser);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    fetchUserProfile().then(user => {
      if (user) setCurrentUser(user);
    });

    const handleAuthChange = (e) => {
      setCurrentUser(e.detail?.user || null);
    };

    window.addEventListener('railsafe:auth-changed', handleAuthChange);
    return () => {
      window.removeEventListener('railsafe:auth-changed', handleAuthChange);
    };
  }, []);

  return (
    <>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.8rem 1.2rem',
        marginBottom: '1rem',
        borderRadius: '16px',
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(203, 213, 225, 0.7)',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)'
      }}>
        {/* Brand */}
        <div 
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
        >
          <span style={{ fontSize: '1.6rem' }}>🚆</span>
          <div>
            <span style={{ 
              fontWeight: '700', 
              fontSize: '1.2rem', 
              color: '#0F172A',
              letterSpacing: '-0.02em'
            }}>
              RailSafe Alert
            </span>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            type="button"
            onClick={() => navigate('/journeys')}
            style={{
              background: location.pathname === '/journeys' ? 'rgba(2, 132, 199, 0.15)' : '#ffffff',
              border: location.pathname === '/journeys' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              color: '#0F172A',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
            title="My Saved Journeys"
          >
            <span>🎒</span>
            <span className="nav-label">Journeys</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            style={{
              background: location.pathname === '/settings' ? 'rgba(2, 132, 199, 0.15)' : '#ffffff',
              border: location.pathname === '/settings' ? '1px solid #0284c7' : '1px solid #cbd5e1',
              color: '#0F172A',
              padding: '0.5rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
            title="Settings & Preferences"
          >
            <span>⚙️</span>
            <span className="nav-label">Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              background: currentUser ? 'rgba(5, 150, 105, 0.15)' : '#2563eb',
              border: currentUser ? '1px solid #059669' : 'none',
              color: currentUser ? '#047857' : '#ffffff',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: currentUser ? 'none' : '0 2px 8px rgba(37, 99, 235, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <span>👤</span>
            <span className="nav-label">{currentUser ? currentUser.name.split(' ')[0] : 'Sign In'}</span>
          </button>
        </div>
      </nav>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        currentUser={currentUser}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      <style>{`
        @media (max-width: 480px) {
          .nav-label {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
