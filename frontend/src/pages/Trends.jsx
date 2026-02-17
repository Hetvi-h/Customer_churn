import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, TrendingDown, Minus, Activity, BarChart3, Clock } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { trendsApi } from '../services/api';
import { LoadingPage, ErrorMessage, Alert } from '../components/Common';

const PERIODS = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '1y', label: 'Last Year' },
];

export default function Trends() {
  const [period, setPeriod] = useState('30d');
  const [churnTrends, setChurnTrends] = useState(null);
  const [riskEvolution, setRiskEvolution] = useState(null);
  const [cohortAnalysis, setCohortAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrends();
  }, [period]);

  const fetchTrends = async () => {
    setLoading(true);
    setError(null);
    try {
      const [churnRes, riskRes, cohortRes] = await Promise.all([
        trendsApi.getChurnTrends(period),
        trendsApi.getRiskEvolution(period),
        trendsApi.getCohortAnalysis(),
      ]);
      setChurnTrends(churnRes.data);
      setRiskEvolution(riskRes.data);
      setCohortAnalysis(cohortRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load trends');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchTrends} />;

  // Check if we have any data
  const hasData = churnTrends?.trend_data?.length > 0 || cohortAnalysis?.cohorts?.length > 0;

  // Empty state
  if (!hasData) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Churn Trends</h2>
            <p className="text-gray-500">Analyze churn patterns over time</p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="input w-40"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Empty State */}
        <div className="bg-white rounded-lg shadow-md p-12">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Trend Data Available</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Trend analysis requires historical data from customer predictions.
              Start by adding customers and running predictions to see trends over time.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="p-4 bg-gray-50 rounded-lg">
                <Activity className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Run batch predictions to generate trend data</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <Clock className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Trends will appear as data accumulates over time</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <TrendingUp className="w-8 h-8 text-primary-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Track churn rate changes and risk evolution</p>
              </div>
            </div>
          </div>
        </div>

        {/* What You'll See */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">What You'll See Here</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-800 mb-1">Churn Rate Trend</h4>
              <p className="text-sm text-gray-500">Track how your churn rate changes over time</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-800 mb-1">At-Risk Customers</h4>
              <p className="text-sm text-gray-500">Monitor the number of customers at risk</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-800 mb-1">Risk Evolution</h4>
              <p className="text-sm text-gray-500">See how risk levels shift over time</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-800 mb-1">Cohort Analysis</h4>
              <p className="text-sm text-gray-500">Analyze churn by customer tenure groups</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const trendDirection = churnTrends?.summary?.trend_direction;
  const TrendIcon = trendDirection === 'increasing' ? TrendingUp : trendDirection === 'decreasing' ? TrendingDown : Minus;
  const trendColor = trendDirection === 'increasing' ? 'text-red-600' : trendDirection === 'decreasing' ? 'text-green-600' : 'text-gray-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Churn Trends</h2>
          <p className="text-gray-500">Analyze churn patterns over time</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input w-40"
          >
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {churnTrends?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Trend Direction</p>
            <div className={`flex items-center mt-1 ${trendColor}`}>
              <TrendIcon className="w-5 h-5 mr-2" />
              <span className="text-lg font-semibold capitalize">
                {churnTrends.summary.trend_direction || 'Stable'}
              </span>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Churn Rate Change</p>
            <p className={`text-lg font-semibold ${
              churnTrends.summary.churn_rate_change > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {churnTrends.summary.churn_rate_change > 0 ? '+' : ''}
              {churnTrends.summary.churn_rate_change?.toFixed(2) || 0}%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">At-Risk Change</p>
            <p className={`text-lg font-semibold ${
              churnTrends.summary.at_risk_change > 0 ? 'text-red-600' : 'text-green-600'
            }`}>
              {churnTrends.summary.at_risk_change > 0 ? '+' : ''}
              {churnTrends.summary.at_risk_change || 0} customers
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500">Avg Churn Rate</p>
            <p className="text-lg font-semibold">
              {churnTrends.summary.avg_churn_rate?.toFixed(2) || 0}%
            </p>
          </div>
        </div>
      )}

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Churn Rate Trend */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Churn Rate Over Time</h3>
          <div className="h-64">
            {churnTrends?.trend_data?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={churnTrends.trend_data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="churn_rate"
                    stroke="#ef4444"
                    fill="#fecaca"
                    name="Churn Rate %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-2" />
                  <p>No data for this period</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* At-Risk Customers Trend */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">At-Risk Customers Over Time</h3>
          <div className="h-64">
            {churnTrends?.trend_data?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={churnTrends.trend_data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="total_customers"
                    stroke="#3b82f6"
                    name="Total Customers"
                  />
                  <Line
                    type="monotone"
                    dataKey="at_risk_customers"
                    stroke="#f59e0b"
                    name="At Risk"
                  />
                  <Line
                    type="monotone"
                    dataKey="churned_customers"
                    stroke="#ef4444"
                    name="Churned"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Activity className="w-12 h-12 mx-auto mb-2" />
                  <p>No data for this period</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk Evolution */}
      {riskEvolution?.data?.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Risk Level Evolution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskEvolution.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="high"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  name="High Risk"
                />
                <Area
                  type="monotone"
                  dataKey="medium"
                  stackId="1"
                  stroke="#f59e0b"
                  fill="#f59e0b"
                  name="Medium Risk"
                />
                <Area
                  type="monotone"
                  dataKey="low"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  name="Low Risk"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cohort Analysis */}
      {cohortAnalysis?.cohorts?.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Churn by Customer Tenure Cohort</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cohort Chart */}
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortAnalysis.cohorts}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cohort" />
                  <YAxis yAxisId="left" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="active_customers"
                    fill="#3b82f6"
                    name="Active Customers"
                  />
                  <Bar yAxisId="right" dataKey="churn_rate" fill="#ef4444" name="Churn Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cohort Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Cohort
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Active
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Churned
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Avg Risk
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {cohortAnalysis.cohorts.map((cohort) => (
                    <tr key={cohort.cohort}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">
                        {cohort.cohort}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {cohort.active_customers}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {cohort.churned_customers}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        <span
                          className={`font-medium ${
                            cohort.churn_rate > 20
                              ? 'text-red-600'
                              : cohort.churn_rate > 10
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {cohort.churn_rate?.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {((cohort.avg_churn_probability || 0) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Avg Churn Probability Trend */}
      {churnTrends?.trend_data?.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Average Churn Probability Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={churnTrends.trend_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Avg Probability']}
                />
                <Line
                  type="monotone"
                  dataKey="avg_churn_probability"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6' }}
                  name="Avg Churn Probability"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
