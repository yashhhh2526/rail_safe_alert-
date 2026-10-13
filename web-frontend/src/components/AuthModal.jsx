import { useState, useEffect } from 'react';
import { 
  loginUser, 
  registerUser, 
  clearAuthSession, 
  getWalletBalance, 
  formatWalletBalance 
} from '../utils/authService';

export default function AuthModal({ isOpen, onClose, currentUser, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletBalance, setWalletBalance] = useState(getWalletBalance);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setWalletBalance(getWalletBalance());
    }
  }, [isOpen, currentUser]);

  useEffect(() => {
    const handleWalletChange = (e) => {
      setWalletBalance(e.detail?.balance ?? getWalletBalance());
    };
    window.addEventListener('railsafe:wallet-changed', handleWalletChange);
    return () => {
      window.removeEventListener('railsafe:wallet-changed', handleWalletChange);
    };
  }, []);

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.email || !formData.email.trim()) {
      return 'Email address is required.';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      return 'Please enter a valid email address.';
    }
    if (!formData.password || formData.password.length < 6) {
      return 'Password must be at least 6 characters long.';
    }
    if (tab === 'register' && (!formData.name || !formData.name.trim())) {
      return 'Full name is required for registration.';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (tab === 'login') {
        const res = await loginUser(formData.email, formData.password);
        if (onAuthSuccess) onAuthSuccess(res.user);
        // Reset form data and close modal cleanly
        setFormData({ name: '', email: '', password: '', phone: '' });
        onClose();
      } else {
        const res = await registerUser(formData);
        if (onAuthSuccess) onAuthSuccess(res.user);
        setFormData({ name: '', email: '', password: '', phone: '' });
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    if (onAuthSuccess) onAuthSuccess(null);
    onClose();
  };

  return (
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
        maxWidth: '440px',
        position: 'relative',
        background: 'var(--glass-bg, rgba(15, 23, 42, 0.92))',
        color: 'var(--text-primary, #0F172A)',
        border: '1px solid var(--glass-border, rgba(56, 189, 248, 0.25))',
        borderRadius: '20px',
        padding: '2rem',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.3s ease'
      }}>
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.2rem',
            right: '1.2rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #94a3b8)',
            fontSize: '1.4rem',
            cursor: 'pointer',
            lineHeight: 1,
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title="Close Modal"
        >
          ✕
        </button>

        {currentUser ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, var(--primary, #0284c7), var(--secondary, #0f766e))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 0.8rem',
                fontSize: '2rem',
                boxShadow: '0 8px 20px rgba(2, 132, 199, 0.35)'
              }}>
                👤
              </div>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '0.2rem', color: 'var(--text-primary, #0F172A)', fontWeight: '700' }}>
                {currentUser.name}
              </h2>
              <p style={{ color: 'var(--text-muted, #475569)', fontSize: '0.88rem', fontWeight: '500' }}>
                {currentUser.email}
              </p>
              {currentUser.phone && (
                <p style={{ color: 'var(--secondary, #0f766e)', fontSize: '0.82rem', fontWeight: '600', marginTop: '2px' }}>
                  📞 {currentUser.phone}
                </p>
              )}
            </div>

            {/* Wallet Balance Display inside Profile Card */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted, #475569)', fontWeight: '600' }}>
                  RailSafe Wallet
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--primary, #0284c7)', marginTop: '2px' }}>
                  {formatWalletBalance(walletBalance)}
                </div>
              </div>
              <div style={{ fontSize: '1.8rem' }}>👛</div>
            </div>

            <div style={{
              background: 'rgba(248, 250, 252, 0.1)',
              border: '1px solid var(--glass-border, rgba(203, 213, 225, 0.5))',
              padding: '0.9rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: 'var(--text-secondary, #475569)',
              fontWeight: '500',
              lineHeight: 1.4
            }}>
              ✓ Connected to RailSafe Cloud Account.<br />
              Your alarms, wallet funds, and journey records sync seamlessly across all devices.
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                background: 'var(--danger, #dc2626)',
                color: '#fff',
                padding: '0.85rem',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(220, 38, 38, 0.3)'
              }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div>
            {/* Tab switchers */}
            <div style={{
              display: 'flex',
              background: 'rgba(241, 245, 249, 0.12)',
              border: '1px solid var(--glass-border, rgba(203, 213, 225, 0.4))',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '1.5rem'
            }}>
              <button
                type="button"
                id="tab-login-btn"
                onClick={() => { setTab('login'); setError(null); }}
                style={{
                  flex: 1,
                  background: tab === 'login' ? 'var(--primary, #0284c7)' : 'transparent',
                  color: tab === 'login' ? '#fff' : 'var(--text-muted, #475569)',
                  border: 'none',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: tab === 'login' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                id="tab-register-btn"
                onClick={() => { setTab('register'); setError(null); }}
                style={{
                  flex: 1,
                  background: tab === 'register' ? 'var(--primary, #0284c7)' : 'transparent',
                  color: tab === 'register' ? '#fff' : 'var(--text-muted, #475569)',
                  border: 'none',
                  padding: '0.65rem',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: tab === 'register' ? '0 2px 8px rgba(2, 132, 199, 0.35)' : 'none'
                }}
              >
                Create Account
              </button>
            </div>

            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.4rem', textAlign: 'center', color: 'var(--text-primary, #0F172A)', fontWeight: '700', letterSpacing: '-0.01em' }}>
              {tab === 'login' ? 'Welcome to RailSafe' : 'Join RailSafe Alert'}
            </h3>
            <p style={{ color: 'var(--text-muted, #475569)', fontSize: '0.85rem', marginBottom: '1.2rem', textAlign: 'center', fontWeight: '500' }}>
              {tab === 'login' ? 'Sign in to access your wallet, ticket bookings, and saved alarms' : 'Create an account to book tickets with your ₹1,000 complimentary wallet balance'}
            </p>

            {/* Inline Error Message */}
            {error && (
              <div 
                id="auth-error-banner"
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#dc2626',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  marginBottom: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                <span style={{ flex: 1 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="auth-name-input"
                    name="name"
                    required
                    placeholder="e.g. Yashwanth Chodipalli"
                    value={formData.name}
                    onChange={handleChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '10px', 
                      background: 'rgba(255, 255, 255, 0.95)', 
                      color: '#0F172A', 
                      border: '1px solid rgba(203, 213, 225, 0.8)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="auth-email-input"
                  name="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '10px', 
                    background: 'rgba(255, 255, 255, 0.95)', 
                    color: '#0F172A', 
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  id="auth-password-input"
                  name="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ 
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '10px', 
                    background: 'rgba(255, 255, 255, 0.95)', 
                    color: '#0F172A', 
                    border: '1px solid rgba(203, 213, 225, 0.8)',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', fontWeight: '600', marginBottom: '0.35rem' }}>
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    id="auth-phone-input"
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem 1rem', 
                      borderRadius: '10px', 
                      background: 'rgba(255, 255, 255, 0.95)', 
                      color: '#0F172A', 
                      border: '1px solid rgba(203, 213, 225, 0.8)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>
              )}

              <button
                type="submit"
                id="auth-submit-btn"
                disabled={loading}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  fontWeight: '700',
                  borderRadius: '10px',
                  background: 'var(--primary, #0284c7)',
                  color: '#ffffff',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.35)',
                  transition: 'all 0.2s ease'
                }}
              >
                {loading ? <span className="loader-small"></span> : (tab === 'login' ? 'Sign In' : 'Create Account')}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
