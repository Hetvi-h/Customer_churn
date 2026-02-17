import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp } from 'lucide-react';

/**
 * Dynamic Feature Importance Chart
 * 
 * CRITICAL: Reads feature importance from metadata API
 * NO hardcoded feature names!
 */
const FeatureImportanceChart = ({ features, title = "Top Churn Drivers", limit = 10 }) => {
    if (!features || features.length === 0) {
        return (
            <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                    {title}
                </h3>
                <div className="flex items-center justify-center h-64 text-gray-400">
                    <div className="text-center">
                        <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                        <p>No feature importance data available</p>
                    </div>
                </div>
            </div>
        );
    }

    // Take top N features
    const topFeatures = features.slice(0, limit);

    // Format for chart
    const chartData = topFeatures.map(f => ({
        name: f.feature,
        importance: f.importance,
        displayName: f.feature.length > 20 ? f.feature.substring(0, 17) + '...' : f.feature
    }));

    // Color gradient based on importance
    const getColor = (index) => {
        const colors = [
            '#ef4444', // red-500
            '#f97316', // orange-500
            '#f59e0b', // amber-500
            '#eab308', // yellow-500
            '#84cc16', // lime-500
            '#22c55e', // green-500
            '#10b981', // emerald-500
            '#14b8a6', // teal-500
            '#06b6d4', // cyan-500
            '#0ea5e9', // sky-500
        ];
        return colors[index % colors.length];
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                {title}
            </h3>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="displayName" width={90} />
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white p-3 border border-gray-200 rounded shadow-lg">
                                            <p className="font-semibold text-gray-900">{payload[0].payload.name}</p>
                                            <p className="text-sm text-gray-600">
                                                Importance: <span className="font-medium">{payload[0].value.toFixed(4)}</span>
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={getColor(index)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 text-sm text-gray-500">
                <p>💡 These features have the strongest impact on churn predictions</p>
            </div>
        </div>
    );
};

export default FeatureImportanceChart;
