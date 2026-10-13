import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettings, saveSettings } from '../utils/settingsService';
import { startAlarmTone, stopAlarmTone, triggerVibration, stopVibration } from '../utils/alarmAudioService';

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  useEffect(() => {
    return () => {
      stopAlarmTone();
      stopVibration();
    };
  }, []);

  const handleChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
    setSavedSuccess(false);
  };

  const handleTestSound = () => {
    if (isPlayingPreview) {
      stopAlarmTone();
      setIsPlayingPreview(false);
    } else {
      setIsPlayingPreview(true);
      startAlarmTone(settings.alarmSound);
      setTimeout(() => {
        stopAlarmTone();
        setIsPlayingPreview(false);
      }, 3500);
    }
  };

  const handleTestVibration = () => {
    triggerVibration(Number(settings.vibrationIntensity));
  };

  const handleSave = () => {
    stopAlarmTone();
    stopVibration();
    setIsPlayingPreview(false);
    saveSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      navigate('/');
    }, 700);
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '1rem' }}>
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <button 
            type="button"
            className="back-btn" 
            onClick={() => navigate('/')} 
            style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}
          >
            ← Back
          </button>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: '#0F172A', fontWeight: '700' }}>Settings & Preferences</h2>
          <div style={{ width: '60px' }}></div>
        </div>

        {savedSuccess && (
          <div style={{
            background: 'rgba(5, 150, 105, 0.15)',
            border: '1px solid #059669',
            color: '#047857',
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: '700'
          }}>
            ✓ Settings saved successfully! Returning to home...
          </div>
        )}

        {/* Theme Settings */}
        <div className="info-item" style={{ marginBottom: '1.8rem' }}>
          <label htmlFor="theme-select" className="label" style={{ fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '0.4rem' }}>
            Visual Theme
          </label>
          <select 
            id="theme-select"
            value={settings.theme}
            onChange={(e) => handleChange('theme', e.target.value)}
            style={{ 
              background: '#ffffff', 
              color: '#0F172A', 
              border: '1px solid #cbd5e1', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              width: '100%',
              fontSize: '1rem',
              fontWeight: '500',
              outline: 'none'
            }}
          >
            <option value="light" style={{ background: '#ffffff', color: '#0F172A' }}>Light Dashboard (High Contrast)</option>
            <option value="dark" style={{ background: '#ffffff', color: '#0F172A' }}>Dark Glassmorphism</option>
            <option value="midnight" style={{ background: '#ffffff', color: '#0F172A' }}>Midnight Deep Blue</option>
          </select>
        </div>

        {/* Alarm Sound Settings */}
        <div className="info-item" style={{ marginBottom: '1.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label htmlFor="sound-select" className="label" style={{ fontWeight: '700', color: '#0F172A' }}>
              Alarm Sound Profile (Offline Ready)
            </label>
            <button
              type="button"
              onClick={handleTestSound}
              style={{
                background: isPlayingPreview ? '#dc2626' : 'rgba(2, 132, 199, 0.15)',
                color: isPlayingPreview ? '#fff' : '#0284c7',
                border: '1px solid #0284c7',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: '700'
              }}
            >
              {isPlayingPreview ? '⏹ Stop Sound' : '▶ Preview Sound'}
            </button>
          </div>
          <select 
            id="sound-select"
            value={settings.alarmSound}
            onChange={(e) => handleChange('alarmSound', e.target.value)}
            style={{ 
              background: '#ffffff', 
              color: '#0F172A', 
              border: '1px solid #cbd5e1', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              width: '100%',
              fontSize: '1rem',
              fontWeight: '500',
              outline: 'none'
            }}
          >
            <option value="digital">Digital Alarm Watch (Loud Beeps)</option>
            <option value="siren">Two-Tone Warning Siren</option>
            <option value="gentle">Gentle Harmonic Chime</option>
          </select>
        </div>

        {/* Vibration Settings */}
        <div className="info-item" style={{ marginBottom: '1.8rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <label htmlFor="vibration-slider" className="label" style={{ fontWeight: '700', color: '#0F172A' }}>
              Vibration Intensity: Level {settings.vibrationIntensity}
            </label>
            <button
              type="button"
              onClick={handleTestVibration}
              style={{
                background: '#ffffff',
                color: '#0F172A',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                padding: '0.35rem 0.85rem',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              📳 Test Vibration
            </button>
          </div>
          <input 
            id="vibration-slider"
            type="range" 
            min="1" 
            max="3" 
            value={settings.vibrationIntensity}
            onChange={(e) => handleChange('vibrationIntensity', parseInt(e.target.value, 10))}
            style={{ width: '100%', margin: '0.8rem 0' }} 
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#475569', fontWeight: '500' }}>
            <span>1 - Subtle (Short buzz)</span>
            <span>2 - Moderate (Double pulse)</span>
            <span>3 - Strong (Emergency pattern)</span>
          </div>
        </div>

        {/* Default Alert Proximity */}
        <div className="info-item" style={{ marginBottom: '1.8rem' }}>
          <label htmlFor="distance-select" className="label" style={{ fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '0.4rem' }}>
            Default Alert Distance (km before destination)
          </label>
          <select 
            id="distance-select"
            value={settings.defaultAlertDistance}
            onChange={(e) => handleChange('defaultAlertDistance', parseInt(e.target.value, 10))}
            style={{ 
              background: '#ffffff', 
              color: '#0F172A', 
              border: '1px solid #cbd5e1', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              width: '100%',
              fontSize: '1rem',
              fontWeight: '500',
              outline: 'none'
            }}
          >
            <option value="2">2 km (Immediate Arrival)</option>
            <option value="5">5 km (Standard Wake-up)</option>
            <option value="10">10 km (Recommended for Overnight Trains)</option>
            <option value="15">15 km (Early Preparation)</option>
          </select>
        </div>

        {/* Emergency Helpline */}
        <div className="info-item" style={{ marginBottom: '2.5rem' }}>
          <label htmlFor="emergency-input" className="label" style={{ fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '0.4rem' }}>
            Railway Emergency Assistance Hotline
          </label>
          <input 
            id="emergency-input"
            type="text"
            value={settings.emergencyNumber}
            onChange={(e) => handleChange('emergencyNumber', e.target.value)}
            placeholder="139"
            style={{ 
              background: '#ffffff', 
              color: '#0F172A', 
              border: '1px solid #cbd5e1', 
              padding: '0.75rem 1rem', 
              borderRadius: '8px',
              width: '100%',
              fontSize: '1rem',
              fontWeight: '500',
              outline: 'none'
            }}
          />
          <small style={{ color: '#475569', display: 'block', marginTop: '0.3rem', fontWeight: '500' }}>
            Official Indian Railways Security, Medical & Complaint Helpline (Default: 139)
          </small>
        </div>

        {/* Save and Return Button */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: '1rem' }}>
          <button 
            type="button"
            className="search-btn"
            onClick={handleSave} 
            style={{ flex: 1, padding: '1rem', fontWeight: 'bold', fontSize: '1rem' }}
          >
            Save Preferences
          </button>
        </div>

      </div>
    </div>
  );
}
