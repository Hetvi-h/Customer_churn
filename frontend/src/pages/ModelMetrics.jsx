import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, Activity, Brain, Database, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { modelApi } from '../services/api';
import { LoadingPage, ErrorMessage, Alert } from '../components/Common';

export default function ModelMetrics() {
  const [metrics, setMetrics] = useState(null);
  const [featureImportance, setFeatureImportance] = useState(null);
  const [confusionMatrix, setConfusionMatrix] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchModelData();
  }, []);

  const fetchModelData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [metricsRes, featuresRes, cmRes, statusRes] = await Promise.all([
        modelApi.getMetrics(),
        modelApi.getFeatureImportance().catch(() => ({ data: { features: [] } })),
        modelApi.getConfusionMatrix(),
        modelApi.getStatus(),
      ]);
      setMetrics(metricsRes.data);
      setFeatureImportance(featuresRes.data);
      setConfusionMatrix(cmRes.data);
      setStatus(statusRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load model data');
    } finally {
      setLoading(false);
    }
  };

  const handleReloadModel = async () => {
    setReloading(true);
    try {
      await modelApi.reloadModel();
      await fetchModelData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to reload model');
    } finally {
      setReloading(false);
    }
  };

  if (loading) return <LoadingPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchModelData} />;

  const featureData = featureImportance?.features?.slice(0, 10).map((f) => ({
    feature: f.feature.replace(/_/g, ' '),
    importance: f.importance,
  })) || [];

  const perf = metrics?.model_performance || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Metrics</h2>
          <p className="text-gray-500">
            Performance metrics and feature importance for the churn prediction model
          </p>
        </div>
        <button
          onClick={handleReloadModel}
          disabled={reloading}
          className="btn-primary flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? 'Reloading...' : 'Reload Model'}
        </button>
      </div>

      {/* Model Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Model Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            {status?.model_loaded ? (
              <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500 mr-3" />
            )}
            <div>
              <p className="text-sm text-gray-500">Model</p>
              <p className="font-medium">{status?.model_loaded ? 'Loaded' : 'Not Loaded'}</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            {status?.shap_explainer_ready ? (
              <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
            ) : (
              <XCircle className="w-6 h-6 text-yellow-500 mr-3" />
            )}
            <div>
              <p className="text-sm text-gray-500">SHAP Explainer</p>
              <p className="font-medium">
                {status?.shap_explainer_ready ? 'Ready' : 'Not Available'}
              </p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            <Activity className="w-6 h-6 text-primary-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Version</p>
              <p className="font-medium">{status?.model_version || 'N/A'}</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            <Brain className="w-6 h-6 text-primary-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Features</p>
              <p className="font-medium">{status?.feature_count || metrics?.feature_count || 0}</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-gray-50 rounded-lg">
            <Database className="w-6 h-6 text-primary-500 mr-3" />
            <div>
              <p className="text-sm text-gray-500">Training Size</p>
              <p className="font-medium">{metrics?.dataset_size?.toLocaleString() || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {!status?.model_loaded && (
        <Alert type="warning" title="Model Not Loaded">
          The prediction model is not loaded. Please ensure model files exist in ml/models/ directory
          and click "Reload Model" to load them.
        </Alert>
      )}

      {/* Performance Metrics */}
      {metrics && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 mb-1">ROC-AUC</p>
              <p className="text-3xl font-bold text-blue-600">
                {((perf.roc_auc || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700 mb-1">Accuracy</p>
              <p className="text-3xl font-bold text-green-600">
                {((perf.accuracy || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-700 mb-1">Precision</p>
              <p className="text-3xl font-bold text-purple-600">
                {((perf.precision || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-orange-700 mb-1">Recall</p>
              <p className="text-3xl font-bold text-orange-600">
                {((perf.recall || 0) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
            {metrics.training_date && (
              <span className="flex items-center">
                <Calendar className="w-4 h-4 mr-1" />
                Trained: {metrics.training_date}
              </span>
            )}
            {metrics.churn_rate && (
              <span>
                Churn Rate in Data: {(metrics.churn_rate * 100).toFixed(1)}%
              </span>
            )}
            {metrics.dataset_size && (
              <span>
                Dataset: {metrics.dataset_size.toLocaleString()} samples
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Confusion Matrix */}
        {confusionMatrix && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Confusion Matrix</h3>
            <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
              {/* Header row */}
              <div></div>
              <div className="text-center text-sm font-medium text-gray-500 py-2">
                Predicted: No
              </div>
              <div className="text-center text-sm font-medium text-gray-500 py-2">
                Predicted: Yes
              </div>

              {/* Actual No row */}
              <div className="text-sm font-medium text-gray-500 py-4 text-right pr-2">
                Actual: No
              </div>
              <div className="bg-green-100 text-green-800 p-4 text-center rounded">
                <p className="text-2xl font-bold">{confusionMatrix.matrix.true_negative}</p>
                <p className="text-xs">True Negative</p>
              </div>
              <div className="bg-red-100 text-red-800 p-4 text-center rounded">
                <p className="text-2xl font-bold">{confusionMatrix.matrix.false_positive}</p>
                <p className="text-xs">False Positive</p>
              </div>

              {/* Actual Yes row */}
              <div className="text-sm font-medium text-gray-500 py-4 text-right pr-2">
                Actual: Yes
              </div>
              <div className="bg-red-100 text-red-800 p-4 text-center rounded">
                <p className="text-2xl font-bold">{confusionMatrix.matrix.false_negative}</p>
                <p className="text-xs">False Negative</p>
              </div>
              <div className="bg-green-100 text-green-800 p-4 text-center rounded">
                <p className="text-2xl font-bold">{confusionMatrix.matrix.true_positive}</p>
                <p className="text-xs">True Positive</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Derived Metrics</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Accuracy:</span>
                  <span className="font-medium">
                    {(confusionMatrix.metrics.accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Precision:</span>
                  <span className="font-medium">
                    {(confusionMatrix.metrics.precision * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recall:</span>
                  <span className="font-medium">
                    {(confusionMatrix.metrics.recall * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">F1 Score:</span>
                  <span className="font-medium">
                    {(confusionMatrix.metrics.f1_score * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feature Importance */}
        {featureData.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Top Feature Importance</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="feature" type="category" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [(value * 100).toFixed(2) + '%', 'Importance']}
                  />
                  <Bar dataKey="importance" fill="#3b82f6">
                    {featureData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={`hsl(${220 - index * 15}, 70%, ${50 + index * 3}%)`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Feature Descriptions */}
      {featureImportance?.features && featureImportance.features.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Feature Descriptions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featureImportance.features.slice(0, 12).map((feature) => (
              <div key={feature.feature} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">
                  {feature.feature.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-gray-500">{feature.description}</p>
                <p className="text-xs text-primary-600 mt-1">
                  Importance: {(feature.importance * 100).toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
