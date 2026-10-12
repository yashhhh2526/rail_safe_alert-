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
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)'
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
              fontSize: '1.1rem', 
              background: 'linear-gradient(to right, #fff, var(--secondary))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
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
              background: location.pathname === '/journeys' ? 'rgba(74, 144, 226, 0.25)' : 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-light)',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
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
              background: location.pathname === '/settings' ? 'rgba(80, 227, 194, 0.25)' : 'transparent',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-light)',
              padding: '0.45rem 0.8rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
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
              background: currentUser ? 'rgba(32, 201, 151, 0.2)' : 'var(--primary)',
              border: currentUser ? '1px solid var(--success)' : 'none',
              color: '#fff',
              padding: '0.45rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem'
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
