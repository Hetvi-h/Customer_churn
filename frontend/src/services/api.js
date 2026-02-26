import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Dashboard API
export const dashboardApi = {
  getMetrics: () => api.get('/dashboard/metrics'),
  getRiskDistribution: () => api.get('/dashboard/risk-distribution'),
  getTopAtRisk: (limit = 10) => api.get(`/dashboard/top-at-risk?limit=${limit}`),
  getRevenueAtRisk: () => api.get('/dashboard/revenue-at-risk'),
  getContractDistribution: () => api.get('/dashboard/contract-distribution'),
  getRecentPredictions: (limit = 10) => api.get(`/dashboard/recent-predictions?limit=${limit}`),
  getSummaryStats: () => api.get('/dashboard/summary-stats'),
  getTrainingDataStats: () => api.get('/dashboard/training-data-stats'),
};

// Metadata API (CRITICAL for dynamic frontend!)
export const metadataApi = {
  getMetadata: () => api.get('/metadata'),
  getFeatures: () => api.get('/metadata/features'),
  getImportance: () => api.get('/metadata/importance'),
  getModelInfo: () => api.get('/metadata/model-info'),
};

// Customers API
export const customersApi = {
  getCustomers: (params) => api.get('/customers', { params }),
  getCustomer: (customerId) => api.get(`/customers/${customerId}`),
  createCustomer: (data) => api.post('/customers', data),
  updateCustomer: (customerId, data) => api.put(`/customers/${customerId}`, data),
  deleteCustomer: (customerId) => api.delete(`/customers/${customerId}`),
  markChurned: (customerId) => api.post(`/customers/${customerId}/mark-churned`),
  getStats: () => api.get('/customers/stats/summary'),
};

// Predictions API
export const predictionsApi = {
  predict: (data) => api.post('/predictions', data),
  predictWithExplanation: (data) => api.post('/predictions/explain', data),
  predictForCustomer: (customerId) => api.post(`/predictions/customer/${customerId}`),
  batchPredict: (customerIds) => api.post('/predictions/batch', { customer_ids: customerIds }),
  predictAll: () => api.post('/predictions/batch/all'),
  getHistory: (customerId, limit = 10) => api.get(`/predictions/history/${customerId}?limit=${limit}`),
  uploadCSV: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/predictions/upload-csv', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getMetadata: () => api.get('/metadata'), // Add this to fix the error
};

// Segments API
export const segmentsApi = {
  getSegments: () => api.get('/segments'),
  getSegmentDetails: (segmentId) => api.get(`/segments/${segmentId}`),
  getSegmentCustomers: (segmentId, params) => api.get(`/segments/${segmentId}/customers`, { params }),
  getSegmentInsights: (segmentId) => api.get(`/segments/${segmentId}/insights`),
};

// Trends API
export const trendsApi = {
  getChurnTrends: (period = '30d') => api.get(`/trends/churn?period=${period}`),
  getPredictionTrends: (period = '30d') => api.get(`/trends/predictions?period=${period}`),
  getRiskEvolution: (period = '30d') => api.get(`/trends/risk-evolution?period=${period}`),
  getCohortAnalysis: () => api.get('/trends/cohort-analysis'),
  createSnapshot: () => api.post('/trends/snapshot'),
};

// Model API
export const modelApi = {
  getMetrics: () => api.get('/model/metrics'),
  getFeatureImportance: () => api.get('/model/feature-importance'),
  getConfusionMatrix: () => api.get('/model/confusion-matrix'),
  getStatus: () => api.get('/model/status'),
  reloadModel: () => api.post('/model/reload'),
};

// Health API
export const healthApi = {
  check: () => api.get('/health'),
};

export default api;
