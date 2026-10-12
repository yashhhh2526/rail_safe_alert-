// Centralized API configuration for production Vercel & local development
const rawBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || (typeof process !== 'undefined' && process.env && process.env.VITE_API_URL) || '';
export const API_BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';
export const API_URL = `${API_BASE_URL}/api/trains`;

export default {
  API_BASE_URL,
  API_URL
};
