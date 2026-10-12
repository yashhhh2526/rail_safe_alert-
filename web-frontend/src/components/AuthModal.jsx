import { useState } from 'react';
import { loginUser, registerUser, clearAuthSession } from '../utils/authService';

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

  if (!isOpen) return null;

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (tab === 'login') {
        const res = await loginUser(formData.email, formData.password);
        if (onAuthSuccess) onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await registerUser(formData);
        if (onAuthSuccess) onAuthSuccess(res.user);
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
      background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '440px',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
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
            color: 'var(--text-muted)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            lineHeight: 1
          }}
        >
          ✕
        </button>

        {currentUser ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>👤</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{currentUser.name}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{currentUser.email}</p>
              {currentUser.phone && (
                <p style={{ color: 'var(--secondary)', fontSize: '0.85rem' }}>📞 {currentUser.phone}</p>
              )}
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              color: 'var(--text-light)'
            }}>
              ✓ Connected to RailSafe Cloud Account.<br />
              Your alarms, alert preferences, and journeys automatically sync across devices.
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                background: 'var(--danger)',
                color: '#fff',
                padding: '0.8rem',
                borderRadius: '8px',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer'
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
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '4px',
              marginBottom: '1.5rem'
            }}>
              <button
                type="button"
                onClick={() => { setTab('login'); setError(null); }}
                style={{
                  flex: 1,
                  background: tab === 'login' ? 'var(--primary)' : 'transparent',
                  color: tab === 'login' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(null); }}
                style={{
                  flex: 1,
                  background: tab === 'register' ? 'var(--primary)' : 'transparent',
                  color: tab === 'register' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Create Account
              </button>
            </div>

            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', textAlign: 'center' }}>
              {tab === 'login' ? 'Welcome Back' : 'Join RailSafe Alert'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center' }}>
              {tab === 'login' ? 'Log in to access your saved journeys and alarm history' : 'Save your railway destinations and receive cloud alerts'}
            </p>

            {error && (
              <div style={{
                background: 'rgba(255, 107, 107, 0.2)',
                border: '1px solid var(--danger)',
                color: '#ff9b9b',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Yashwanth Chodipalli"
                    value={formData.name}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px' }}
                />
              </div>

              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px' }}
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="search-btn"
                style={{
                  marginTop: '0.5rem',
                  padding: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
