/**
 * User Settings Management
 * Persists user preferences for themes, alarm tones, vibration, and alert defaults.
 */

const SETTINGS_KEY = 'railSafe_userSettings';

export const DEFAULT_SETTINGS = {
  theme: 'dark',
  alarmSound: 'digital', // 'digital' | 'siren' | 'gentle'
  vibrationIntensity: 3, // 1: Low, 2: Med, 3: High
  defaultAlertDistance: 10, // km
  voiceAnnouncements: true,
  notificationsEnabled: true,
  emergencyNumber: '139'
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (err) {
    console.warn('Error reading settings from localStorage:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(newSettings) {
  try {
    const current = getSettings();
    const merged = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    
    // Apply theme to document root
    applyTheme(merged.theme);
    
    // Dispatch custom event for reactive updates across components
    window.dispatchEvent(new CustomEvent('railsafe:settings-changed', { detail: merged }));
    return merged;
  } catch (err) {
    console.error('Error saving settings to localStorage:', err);
    return getSettings();
  }
}

export function applyTheme(themeName) {
  const root = document.documentElement;
  if (themeName === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (themeName === 'midnight') {
    root.setAttribute('data-theme', 'midnight');
  } else {
    root.removeAttribute('data-theme');
  }
}
