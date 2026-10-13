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
        background: '#ffffff',
        color: '#0F172A',
        border: '1px solid #cbd5e1',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.25)'
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
            color: '#475569',
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
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem', color: '#0F172A', fontWeight: '700' }}>{currentUser.name}</h2>
              <p style={{ color: '#475569', fontSize: '0.9rem', fontWeight: '500' }}>{currentUser.email}</p>
              {currentUser.phone && (
                <p style={{ color: '#0f766e', fontSize: '0.85rem', fontWeight: '600' }}>📞 {currentUser.phone}</p>
              )}
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '1rem',
              borderRadius: '10px',
              marginBottom: '1.5rem',
              fontSize: '0.9rem',
              color: '#475569',
              fontWeight: '500'
            }}>
              ✓ Connected to RailSafe Cloud Account.<br />
              Your alarms, alert preferences, and journeys automatically sync across devices.
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                width: '100%',
                background: '#dc2626',
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
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '4px',
              marginBottom: '1.5rem'
            }}>
              <button
                type="button"
                onClick={() => { setTab('login'); setError(null); }}
                style={{
                  flex: 1,
                  background: tab === 'login' ? '#0284c7' : 'transparent',
                  color: tab === 'login' ? '#fff' : '#475569',
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
                  background: tab === 'register' ? '#0284c7' : 'transparent',
                  color: tab === 'register' ? '#fff' : '#475569',
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

            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', textAlign: 'center', color: '#0F172A', fontWeight: '700' }}>
              {tab === 'login' ? 'Welcome Back' : 'Join RailSafe Alert'}
            </h3>
            <p style={{ color: '#475569', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'center', fontWeight: '500' }}>
              {tab === 'login' ? 'Log in to access your saved journeys and alarm history' : 'Save your railway destinations and receive cloud alerts'}
            </p>

            {error && (
              <div style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                color: '#dc2626',
                padding: '0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="e.g. Yashwanth Chodipalli"
                    value={formData.name}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#0F172A', border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: '600', marginBottom: '0.3rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#0F172A', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: '600', marginBottom: '0.3rem' }}>
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
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#0F172A', border: '1px solid #cbd5e1' }}
                />
              </div>

              {tab === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#475569', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Mobile Number (Optional)
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', background: '#ffffff', color: '#0F172A', border: '1px solid #cbd5e1' }}
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
