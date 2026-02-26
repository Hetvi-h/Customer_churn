import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart as PieChartIcon,
  Users,
  TrendingUp,
  Download,
  AlertCircle,
  Info,
  RefreshCw
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useUpload } from '../contexts/UploadContext';
import { useApiData } from '../hooks/useSwrFetcher';

const RISK_COLORS = {
  high: 'var(--color-risk-high)',
  medium: 'var(--color-risk-medium)',
  low: 'var(--color-risk-low)'
};

/**
 * Segments Page - Dynamic Customer Segmentation
 * 
 * Section 1: Risk Overview (donut chart)
 * Section 2: Auto-Generated Segments (from top features)
 * Section 3: Churn Rate by Top Feature (dynamic chart)
 */
export default function Segments() {
  const navigate = useNavigate();
  const { hasUploadedData, uploadResults } = useUpload();

  const summary = uploadResults?.summary || {};
  const risksFromUpload = {
    high: summary.high_risk || 0,
    medium: summary.medium_risk || 0,
    low: summary.low_risk || 0,
  };

  const hasContextRisks = risksFromUpload.high > 0 || risksFromUpload.medium > 0 || risksFromUpload.low > 0;

  // Conditionally fetch risk distribution only if we don't have it in the upload context
  const { data: riskDistributionData, error: riskError, isLoading: loadingRisk, mutate: mutateRisk } = useApiData(
    hasUploadedData && !hasContextRisks ? '/dashboard/risk-distribution' : null
  );

  // Always fetch metadata for feature importance
  const { data: metadata, error: metadataError, isLoading: loadingMetadata, mutate: mutateMetadata } = useApiData(
    hasUploadedData ? '/metadata' : null
  );

  const riskDistribution = hasContextRisks ? risksFromUpload : riskDistributionData;
  const loading = loadingRisk || loadingMetadata;
  const errorObj = riskError || metadataError;
  const error = errorObj ? errorObj.info?.detail || errorObj.message || 'Failed to load segments data' : null;

  const fetchData = () => {
    mutateRisk();
    mutateMetadata();
  };

  if (!hasUploadedData) {
    // Return a dummy to avoid React calling hooks out of order if we navigated away, though navigate happens immediately
    return null;
  }

  if (!hasUploadedData) {
    return null;
  }

  // Prepare risk distribution data for pie chart
  const riskPieData = riskDistribution ? [
    { name: 'High Risk', value: riskDistribution.high || 0, color: RISK_COLORS.high },
    { name: 'Medium Risk', value: riskDistribution.medium || 0, color: RISK_COLORS.medium },
    { name: 'Low Risk', value: riskDistribution.low || 0, color: RISK_COLORS.low }
  ].filter(item => item.value > 0) : [];

  const totalCustomers = riskPieData.reduce((sum, item) => sum + item.value, 0);

  // Get top feature from metadata
  const topFeature = metadata?.feature_importance?.[0]?.feature ||
    (metadata?.feature_importance && Object.keys(metadata.feature_importance)[0]) ||
    null;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <PieChartIcon className="w-8 h-8 text-blue-600" />
          Customer Segments
        </h1>
        <p className="mt-2 text-gray-600">
          Automatically generated customer groups based on shared churn risk patterns
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading segments...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div className="space-y-6">
          {/* SECTION 1: Risk Overview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Risk Overview</h2>
              <p className="text-sm text-gray-600">
                Distribution of churn risk across your customer base
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Donut Chart */}
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={riskPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {riskPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Stats */}
              <div className="flex flex-col justify-center space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-risk-high)' }}>🔴 High Risk</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--color-risk-high)' }}>
                        {riskDistribution?.high?.toLocaleString() || 0}
                      </p>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-risk-high)' }}>
                      {totalCustomers > 0
                        ? ((riskDistribution?.high / totalCustomers) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-risk-medium)' }}>🟡 Medium Risk</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--color-risk-medium)' }}>
                        {riskDistribution?.medium?.toLocaleString() || 0}
                      </p>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-risk-medium)' }}>
                      {totalCustomers > 0
                        ? ((riskDistribution?.medium / totalCustomers) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-risk-low)' }}>🟢 Low Risk</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--color-risk-low)' }}>
                        {riskDistribution?.low?.toLocaleString() || 0}
                      </p>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-risk-low)' }}>
                      {totalCustomers > 0
                        ? ((riskDistribution?.low / totalCustomers) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Auto-Generated Segments */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Auto-Generated Segments</h2>
              <p className="text-sm text-gray-600">
                Customer groups generated from top features in your dataset
              </p>
            </div>

            {/* Info Box */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p>
                    Segments are automatically created by analyzing patterns in your data.
                    Each segment represents customers with similar characteristics and churn risk levels.
                  </p>
                </div>
              </div>
            </div>

            {/* Segment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* High Risk Segment */}
              <div className="border-2 border-red-200 rounded-lg p-5 bg-red-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-red-900">
                    High Risk - {topFeature || 'Top Feature'}
                  </h3>
                  <span className="text-2xl">🔴</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--color-risk-high)]" />
                    <span className="text-red-900">
                      {riskDistribution?.high?.toLocaleString() || 0} customers
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--color-risk-high)]" />
                    <span className="text-red-900">
                      Avg Churn Risk: {'>70%'}
                    </span>
                  </div>
                  <p className="text-xs text-red-700 mt-3">
                    Common Traits: High churn probability, requires immediate intervention
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate('/customers')}
                    className="flex-1 px-3 py-2 bg-[var(--color-risk-high)] text-white rounded-lg hover:opacity-90 text-sm font-medium"
                  >
                    View Customers
                  </button>
                  <button className="px-3 py-2 bg-white border border-red-300 text-[var(--color-risk-high)] rounded-lg hover:bg-red-100 text-sm">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Medium Risk Segment */}
              <div className="border-2 border-yellow-200 rounded-lg p-5 bg-yellow-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-yellow-900">
                    Medium Risk - {topFeature || 'Top Feature'}
                  </h3>
                  <span className="text-2xl">🟡</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--color-risk-medium)]" />
                    <span className="text-yellow-900">
                      {riskDistribution?.medium?.toLocaleString() || 0} customers
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--color-risk-medium)]" />
                    <span className="text-yellow-900">
                      Avg Churn Risk: 40-70%
                    </span>
                  </div>
                  <p className="text-xs text-yellow-700 mt-3">
                    Common Traits: Moderate churn risk, proactive engagement recommended
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate('/customers')}
                    className="flex-1 px-3 py-2 bg-[var(--color-risk-medium)] text-white rounded-lg hover:opacity-90 text-sm font-medium"
                  >
                    View Customers
                  </button>
                  <button className="px-3 py-2 bg-white border border-yellow-300 text-[var(--color-risk-medium)] rounded-lg hover:bg-yellow-100 text-sm">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Low Risk Segment */}
              <div className="border-2 border-green-200 rounded-lg p-5 bg-green-50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-900">
                    Low Risk - {topFeature || 'Top Feature'}
                  </h3>
                  <span className="text-2xl">🟢</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--color-risk-low)]" />
                    <span className="text-green-900">
                      {riskDistribution?.low?.toLocaleString() || 0} customers
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[var(--color-risk-low)]" />
                    <span className="text-green-900">
                      Avg Churn Risk: {'<40%'}
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-3">
                    Common Traits: Low churn probability, focus on retention and upsell
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => navigate('/customers')}
                    className="flex-1 px-3 py-2 bg-[var(--color-risk-low)] text-white rounded-lg hover:opacity-90 text-sm font-medium"
                  >
                    View Customers
                  </button>
                  <button className="px-3 py-2 bg-white border border-green-300 text-[var(--color-risk-low)] rounded-lg hover:bg-green-100 text-sm">
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Churn Rate by Top Feature (DYNAMIC) */}
          {topFeature && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-900">
                  Churn Rate by {topFeature}
                </h2>
                <p className="text-sm text-gray-600">
                  How churn risk varies across different values of your top predictive feature
                </p>
              </div>

              {/* Placeholder for dynamic chart */}
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Dynamic Chart: Churn Rate by {topFeature}</p>
                <p className="text-sm text-gray-500 mt-2">
                  This chart will show churn rate breakdown by unique values of "{topFeature}"
                </p>
                <p className="text-xs text-gray-400 mt-4">
                  Backend API endpoint needed: /api/segments/churn-by-feature/{topFeature}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
