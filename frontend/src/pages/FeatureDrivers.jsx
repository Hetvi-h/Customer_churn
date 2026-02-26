import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, TrendingUp, AlertCircle, Info } from 'lucide-react';
import { useUpload } from '../contexts/UploadContext';
import { useApiData } from '../hooks/useSwrFetcher';

/**
 * Feature Drivers Page
 * 
 * Shows AI-identified factors ranked by their influence on customer churn
 * All features are dynamic from metadata - no hardcoding
 */
export default function FeatureDrivers() {
    const navigate = useNavigate();
    const { hasUploadedData } = useUpload();

    const { data: metadata, error: metadataErrorObj, isLoading: loading, mutate } = useApiData(
        hasUploadedData ? '/metadata' : null
    );

    const error = metadataErrorObj ? metadataErrorObj.info?.detail || metadataErrorObj.message || 'Failed to load feature importance data' : null;

    // Derived State
    const featureImportance = React.useMemo(() => {
        if (!metadata || !metadata.feature_importance) return [];

        if (Array.isArray(metadata.feature_importance)) {
            return metadata.feature_importance;
        } else if (typeof metadata.feature_importance === 'object') {
            return Object.entries(metadata.feature_importance)
                .map(([feature, importance]) => ({ feature, importance }))
                .sort((a, b) => b.importance - a.importance);
        }
        return [];
    }, [metadata]);

    if (!hasUploadedData) {
        return null; // or navigate('/upload')
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                    <Zap className="w-8 h-8 text-yellow-600" />
                    Churn Drivers
                </h1>
                <p className="mt-2 text-gray-600">
                    AI-identified factors ranked by their influence on customer churn in your dataset
                </p>
            </div>

            {/* Info Box */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900">
                        <p className="font-medium mb-1">Understanding Feature Importance</p>
                        <p>
                            These features are ranked by how much they contribute to predicting churn in your specific dataset.
                            Higher importance means the feature has more influence on the AI model's predictions.
                            This analysis is unique to your data - not based on generic assumptions.
                        </p>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading feature importance...</p>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <AlertCircle className="w-12 h-12 text-[var(--color-risk-high)] mx-auto mb-4" />
                    <p className="text-gray-600">{error}</p>
                    <button
                        onClick={fetchFeatureImportance}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Feature Importance Chart */}
            {!loading && !error && featureImportance.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">
                        Feature Importance Ranking
                    </h2>

                    <div className="space-y-4">
                        {featureImportance.map((item, idx) => {
                            const importance = typeof item.importance === 'number'
                                ? item.importance
                                : parseFloat(item.importance) || 0;

                            // Color gradient based on rank
                            const getBarColor = (index) => {
                                if (index === 0) return 'from-[var(--color-risk-high)] to-red-500';
                                if (index < 3) return 'from-orange-600 to-orange-500';
                                if (index < 5) return 'from-yellow-600 to-yellow-500';
                                if (index < 10) return 'from-blue-600 to-blue-500';
                                return 'from-gray-600 to-gray-500';
                            };

                            return (
                                <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-4 mb-3">
                                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <h3 className="text-lg font-semibold text-gray-900">{item.feature}</h3>
                                                <span className="text-lg font-bold text-gray-900">
                                                    {(importance * 100).toFixed(2)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-3">
                                                <div
                                                    className={`bg-gradient-to-r ${getBarColor(idx)} h-3 rounded-full transition-all duration-500`}
                                                    style={{ width: `${importance * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Additional context for top features */}
                                    {idx < 3 && (
                                        <div className="ml-16 text-sm text-gray-600 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-blue-600" />
                                            <span>
                                                {idx === 0 && 'Primary driver of churn in your dataset'}
                                                {idx === 1 && 'Second most influential factor'}
                                                {idx === 2 && 'Third most influential factor'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Summary Stats */}
                    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-semibold text-gray-900 mb-3">Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Total Features:</span>
                                <div className="font-bold text-gray-900 mt-1">{featureImportance.length}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">Top Feature:</span>
                                <div className="font-bold text-gray-900 mt-1">{featureImportance[0]?.feature || 'N/A'}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">Top 3 Combined:</span>
                                <div className="font-bold text-gray-900 mt-1">
                                    {(featureImportance.slice(0, 3).reduce((sum, f) => sum + (parseFloat(f.importance) || 0), 0) * 100).toFixed(1)}%
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-600">Top 5 Combined:</span>
                                <div className="font-bold text-gray-900 mt-1">
                                    {(featureImportance.slice(0, 5).reduce((sum, f) => sum + (parseFloat(f.importance) || 0), 0) * 100).toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* No Data State */}
            {!loading && !error && featureImportance.length === 0 && (
                <div className="bg-white rounded-lg shadow-md p-12 text-center">
                    <Zap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No feature importance data available</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Upload a dataset to see which features drive churn
                    </p>
                </div>
            )}
        </div>
    );
}
