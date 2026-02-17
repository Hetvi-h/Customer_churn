import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Upload State Context
 * 
 * Manages whether user has uploaded data and retains the results.
 * Controls which pages are accessible in the navigation.
 */
const UploadContext = createContext();

export const useUpload = () => {
    const context = useContext(UploadContext);
    if (!context) {
        throw new Error('useUpload must be used within UploadProvider');
    }
    return context;
};

export const UploadProvider = ({ children }) => {
    // Initialize state from localStorage directly to avoid flicker
    const [hasUploadedData, setHasUploadedData] = useState(() => {
        return localStorage.getItem('hasUploadedData') === 'true';
    });

    const [uploadResults, setUploadResults] = useState(() => {
        const saved = localStorage.getItem('uploadResults');
        try {
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error("Failed to parse upload results", e);
            return null;
        }
    });

    const markDataUploaded = (results) => {
        setHasUploadedData(true);
        setUploadResults(results);
        localStorage.setItem('hasUploadedData', 'true');
        // Store full results for persistence
        try {
            localStorage.setItem('uploadResults', JSON.stringify(results));
        } catch (e) {
            console.error("Storage quota exceeded", e);
            // Fallback: store only summary if full results fail
            if (results.summary) {
                localStorage.setItem('uploadResults', JSON.stringify({ summary: results.summary, predictions: [] }));
            }
        }
    };

    const resetUpload = () => {
        setHasUploadedData(false);
        setUploadResults(null);
        localStorage.removeItem('hasUploadedData');
        localStorage.removeItem('uploadResults');
        localStorage.removeItem('churn_upload_state'); // Clear old key if exists
    };

    return (
        <UploadContext.Provider
            value={{
                hasUploadedData,
                uploadResults,
                markDataUploaded,
                resetUpload
            }}
        >
            {children}
        </UploadContext.Provider>
    );
};
