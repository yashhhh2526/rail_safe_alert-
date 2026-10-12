import { API_BASE_URL } from '../config/api';

const TOKEN_KEY = 'railSafe_authToken';
const USER_KEY = 'railSafe_authUser';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.dispatchEvent(new CustomEvent('railsafe:auth-changed', { detail: { isAuthenticated: true, user } }));
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new CustomEvent('railsafe:auth-changed', { detail: { isAuthenticated: false, user: null } }));
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export async function loginUser(email, password) {
  const url = `${API_BASE_URL}/api/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.msg || 'Invalid email or password');
  }

  setAuthSession(data.token, data.user);
  return data;
}

export async function registerUser({ name, email, password, phone }) {
  const url = `${API_BASE_URL}/api/auth/register`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone })
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.msg || 'Registration failed');
  }

  setAuthSession(data.token, data.user);
  return data;
}

export async function fetchUserProfile() {
  const token = getToken();
  if (!token) return null;

  try {
    const url = `${API_BASE_URL}/api/auth/profile`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.user) {
        setAuthSession(token, data.user);
        return data.user;
      }
    }
    return null;
  } catch (err) {
    console.warn('Error verifying profile:', err);
    return null;
  }
}
