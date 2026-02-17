import { useState, useEffect } from 'react';
import { metadataApi } from '../services/api';

/**
 * Custom hook to load and cache metadata from the backend
 * 
 * CRITICAL: This provides dynamic configuration for the entire frontend
 * All components should use this instead of hardcoding feature names!
 */
export const useMetadata = () => {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadMetadata = async () => {
            try {
                setLoading(true);
                const response = await metadataApi.getMetadata();
                setMetadata(response.data);
                setError(null);
            } catch (err) {
                console.error('Error loading metadata:', err);
                setError(err.message || 'Failed to load metadata');
            } finally {
                setLoading(false);
            }
        };

        loadMetadata();
    }, []);

    return { metadata, loading, error };
};

/**
 * Hook to get feature importance (sorted)
 */
export const useFeatureImportance = () => {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadImportance = async () => {
            try {
                setLoading(true);
                const response = await metadataApi.getImportance();
                setFeatures(response.data.features || []);
                setError(null);
            } catch (err) {
                console.error('Error loading feature importance:', err);
                setError(err.message || 'Failed to load feature importance');
            } finally {
                setLoading(false);
            }
        };

        loadImportance();
    }, []);

    return { features, loading, error };
};

/**
 * Hook to get model info
 */
export const useModelInfo = () => {
    const [modelInfo, setModelInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadModelInfo = async () => {
            try {
                setLoading(true);
                const response = await metadataApi.getModelInfo();
                setModelInfo(response.data);
                setError(null);
            } catch (err) {
                console.error('Error loading model info:', err);
                setError(err.message || 'Failed to load model info');
            } finally {
                setLoading(false);
            }
        };

        loadModelInfo();
    }, []);

    return { modelInfo, loading, error };
};
