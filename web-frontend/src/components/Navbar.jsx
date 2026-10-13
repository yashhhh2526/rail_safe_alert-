import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getUser, 
  fetchUserProfile, 
  getWalletBalance, 
  updateWalletBalance, 
  formatWalletBalance 
} from '../utils/authService';
import AuthModal from './AuthModal';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(getUser);
  const [walletBalance, setWalletBalance] = useState(() => getWalletBalance());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

  // Top-Up modal state
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpError, setTopUpError] = useState(null);
  const [topUpSuccess, setTopUpSuccess] = useState(null);
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  useEffect(() => {
    fetchUserProfile().then(user => {
      if (user) {
        setCurrentUser(user);
        setWalletBalance(getWalletBalance());
      }
    });

    const handleAuthChange = (e) => {
      const newUser = e.detail?.user || null;
      setCurrentUser(newUser);
      setWalletBalance(getWalletBalance());
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
  }, []);

  const handleOpenTopUp = () => {
    setTopUpAmount('');
    setTopUpError(null);
    setTopUpSuccess(null);
    setIsTopUpModalOpen(true);
  };

  const handleQuickAdd = (amount) => {
    setTopUpAmount(String(amount));
    setTopUpError(null);
  };

  const handleTopUpSubmit = (e) => {
    e.preventDefault();
    setTopUpError(null);
    const amountNum = parseFloat(topUpAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      setTopUpError('Please enter a valid amount greater than ₹0.');
      return;
    }

    if (amountNum > 50000) {
      setTopUpError('Maximum single top-up limit is ₹50,000.');
      return;
    }

    try {
      setIsSubmittingTopUp(true);
      const newBal = updateWalletBalance(amountNum);
      setWalletBalance(newBal);
      setTopUpSuccess(`Successfully added ₹${amountNum.toFixed(2)} to your wallet!`);
      setTimeout(() => {
        setIsTopUpModalOpen(false);
        setTopUpSuccess(null);
        setTopUpAmount('');
      }, 1200);
    } catch (err) {
      setTopUpError(err.message || 'Failed to top up wallet balance.');
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  return (
    <>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.8rem 1.2rem',
        marginBottom: '1rem',
        borderRadius: '16px',
        background: 'var(--glass-bg, rgba(255, 255, 255, 0.88))',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border, rgba(203, 213, 225, 0.7))',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)'
      }}>
        {/* Brand */}
        <div 
          id="navbar-brand-logo"
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}
          title="RailSafe Alert – Smart Destination Alarm System"
        >
          <div style={{
            position: 'relative',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.18), rgba(15, 118, 110, 0.18))',
            border: '1px solid rgba(2, 132, 199, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.35rem',
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.15)'
          }}>
            <span>🚆</span>
            <span style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-3px',
              fontSize: '0.75rem',
              lineHeight: 1
            }}>🔔</span>
          </div>
          <div>
            <span style={{ 
              fontWeight: '800', 
              fontSize: '1.25rem', 
              color: 'var(--text-primary, #0F172A)',
              letterSpacing: '-0.02em'
            }}>
              RailSafe Alert
            </span>
          </div>
        </div>

        {/* Navigation Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => navigate('/journeys')}
            style={{
              background: location.pathname === '/journeys' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255, 255, 255, 0.8)',
              border: location.pathname === '/journeys' ? '1px solid #0284c7' : '1px solid var(--glass-border, #cbd5e1)',
              color: 'var(--text-primary, #0F172A)',
              padding: '0.5rem 0.85rem',
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
              background: location.pathname === '/settings' ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255, 255, 255, 0.8)',
              border: location.pathname === '/settings' ? '1px solid #0284c7' : '1px solid var(--glass-border, #cbd5e1)',
              color: 'var(--text-primary, #0F172A)',
              padding: '0.5rem 0.85rem',
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

          {/* User Wallet Badge (Displayed when Authenticated) */}
          {currentUser && (
            <button
              type="button"
              id="navbar-wallet-btn"
              onClick={handleOpenTopUp}
              title="RailSafe Wallet: Click to view or add money"
              style={{
                background: 'rgba(2, 132, 199, 0.12)',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                color: '#0284c7',
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.12)',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{ fontSize: '1.05rem' }}>👛</span>
              <span style={{ fontWeight: '800' }}>{formatWalletBalance(walletBalance)}</span>
              <span style={{
                background: 'var(--primary, #0284c7)',
                color: '#fff',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                marginLeft: '2px',
                lineHeight: 1
              }}>+</span>
            </button>
          )}

          {/* Profile / Auth Button */}
          <button
            type="button"
            id="navbar-auth-btn"
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              background: currentUser ? 'rgba(5, 150, 105, 0.15)' : 'var(--primary, #2563eb)',
              border: currentUser ? '1px solid #059669' : 'none',
              color: currentUser ? '#047857' : '#ffffff',
              padding: '0.5rem 0.95rem',
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

      {/* Quick Add Money / Top-up Wallet Modal */}
      {isTopUpModalOpen && (
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
            maxWidth: '420px',
            position: 'relative',
            background: 'var(--glass-bg, rgba(15, 23, 42, 0.92))',
            color: 'var(--text-primary, #0F172A)',
            border: '1px solid var(--glass-border, rgba(56, 189, 248, 0.25))',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)'
          }}>
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsTopUpModalOpen(false)}
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

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(2, 132, 199, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.6rem',
                fontSize: '1.8rem'
              }}>
                👛
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-primary, #0F172A)', margin: 0 }}>
                RailSafe Wallet Top-Up
              </h3>
              <p style={{ color: 'var(--text-muted, #475569)', fontSize: '0.85rem', marginTop: '4px' }}>
                Instant mock balance for seamless railway ticket booking
              </p>
            </div>

            {/* Current Balance Card */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.2rem',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #475569)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>
                Current Balance
              </span>
              <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                {formatWalletBalance(walletBalance)}
              </div>
            </div>

            {topUpSuccess && (
              <div style={{
                background: 'rgba(5, 150, 105, 0.15)',
                border: '1px solid #059669',
                color: '#047857',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '1rem',
                textAlign: 'center'
              }}>
                🎉 {topUpSuccess}
              </div>
            )}

            {topUpError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#dc2626',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                ⚠️ {topUpError}
              </div>
            )}

            <form onSubmit={handleTopUpSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Quick Amount Select
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {[200, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickAdd(amt)}
                      style={{
                        padding: '0.5rem',
                        borderRadius: '8px',
                        border: topUpAmount === String(amt) ? '2px solid #0284c7' : '1px solid var(--glass-border, #cbd5e1)',
                        background: topUpAmount === String(amt) ? 'rgba(2, 132, 199, 0.15)' : 'rgba(255, 255, 255, 0.8)',
                        color: topUpAmount === String(amt) ? '#0284c7' : 'var(--text-primary, #0F172A)',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      +₹{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.4rem' }}>
                  Top-up Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50000"
                  step="10"
                  placeholder="e.g. 500"
                  value={topUpAmount}
                  onChange={(e) => { setTopUpAmount(e.target.value); setTopUpError(null); }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: '1px solid var(--glass-border, #cbd5e1)',
                    background: 'rgba(255, 255, 255, 0.95)',
                    color: '#0F172A',
                    fontSize: '1rem',
                    fontWeight: '600',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button
                  type="button"
                  onClick={() => setIsTopUpModalOpen(false)}
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
                  type="submit"
                  disabled={isSubmittingTopUp}
                  style={{
                    flex: 2,
                    padding: '0.8rem',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'var(--primary, #0284c7)',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: isSubmittingTopUp ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)'
                  }}
                >
                  {isSubmittingTopUp ? 'Adding Funds...' : 'Add Money Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        currentUser={currentUser}
        onAuthSuccess={(user) => {
          setCurrentUser(user);
          setWalletBalance(getWalletBalance());
        }}
      />

      <style>{`
        @media (max-width: 520px) {
          .nav-label {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
