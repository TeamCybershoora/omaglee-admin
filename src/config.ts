/**
 * Omaglee Admin Dashboard - Configuration
 */

export const PROD_API_URL = 'https://omaglee-backend-1.onrender.com/api';

export const API_URL =
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '8000')
    ? 'http://localhost:8000/api'
    : PROD_API_URL;
