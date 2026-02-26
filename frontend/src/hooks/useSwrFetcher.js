import useSWR from 'swr';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = '/api';

/**
 * Global fetcher for SWR that automatically injects the Bearer token
 */
export const fetcherWithAuth = async ([url, token]) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { headers });

    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        error.info = await res.json().catch(() => ({}));
        error.status = res.status;
        throw error;
    }

    return res.json();
};

/**
 * Custom hook wrapping useSWR to automatically handle auth tokens
 * 
 * @param {string} endpoint - The API endpoint (e.g., '/dashboard/stats')
 * @param {object} options - SWR options
 * @returns SWR response object
 */
export const useApiData = (endpoint, options = {}) => {
    const { token } = useAuth();

    // Create a compound key containing both the URL and the token
    // If token is null, we can either suspend fetching or try without it
    const url = endpoint ? `${API_BASE_URL}${endpoint}` : null;
    const key = url ? [url, token] : null;

    return useSWR(key, fetcherWithAuth, {
        // SWR Global defaults for our app
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        refreshInterval: 0, // No auto-polling by default
        ...options
    });
};
