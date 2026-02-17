import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Filter,
    AlertCircle,
    TrendingUp,
    Target,
    ChevronRight,
    X,
    Info,
    Download,
    RefreshCw
} from 'lucide-react';
import { useUpload } from '../contexts/UploadContext';
import { customersApi, predictionsApi } from '../services/api';

/**
 * Customer Intelligence - Merged Customers + Predictions Page
 * 
 * Tab 1: Customer Lookup - Search/analyze existing customers from uploaded CSV
 * Tab 2: Churn Predictor - Predict churn for new/hypothetical customers
 */
export default function CustomerIntelligence() {
    const navigate = useNavigate();
    const { hasUploadedData, uploadMetadata } = useUpload();

    // Redirect if no data uploaded
    useEffect(() => {
        if (!hasUploadedData) {
            navigate('/upload');
        }
    }, [hasUploadedData, navigate]);

    // Tab state
    const [activeTab, setActiveTab] = useState('lookup'); // 'lookup' or 'predictor'

    // Tab 1: Customer Lookup state
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerShap, setCustomerShap] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [loadingShap, setLoadingShap] = useState(false);

    // Tab 2: Churn Predictor state
    const [metadata, setMetadata] = useState(null);
    const [formData, setFormData] = useState({});
    const [predictionResult, setPredictionResult] = useState(null);
    const [predicting, setPredicting] = useState(false);
    const [loadingMetadata, setLoadingMetadata] = useState(true);

    // Load customers for Tab 1
    useEffect(() => {
        if (activeTab === 'lookup') {
            fetchCustomers();
        }
    }, [activeTab]);

    // Load metadata for Tab 2
    useEffect(() => {
        if (activeTab === 'predictor') {
            fetchMetadata();
        }
    }, [activeTab]);

    // Filter customers when search/filter changes
    useEffect(() => {
        let filtered = customers;

        // Apply search filter
        if (searchQuery) {
            filtered = filtered.filter(c =>
                c.customer_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                c.name?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }

        // Apply risk filter
        if (riskFilter !== 'all') {
            filtered = filtered.filter(c => c.churn_risk_level === riskFilter);
        }

        setFilteredCustomers(filtered);
    }, [searchQuery, riskFilter, customers]);

    const fetchCustomers = async () => {
        setLoadingCustomers(true);
        try {
            const response = await customersApi.getAll();
            const data = response.data || [];
            // Sort by churn probability descending
            const sorted = data.sort((a, b) => (b.churn_probability || 0) - (a.churn_probability || 0));
            setCustomers(sorted);
            setFilteredCustomers(sorted);
        } catch (error) {
            console.error('Error fetching customers:', error);
            setCustomers([]);
            setFilteredCustomers([]);
        } finally {
            setLoadingCustomers(false);
        }
    };

    const fetchMetadata = async () => {
        setLoadingMetadata(true);
        try {
            const response = await predictionsApi.getMetadata();
            const meta = response.data;
            setMetadata(meta);

            // Initialize form with empty values
            const initialForm = {};
            if (meta.numerical_cols) {
                meta.numerical_cols.forEach(col => {
                    initialForm[col] = 0;
                });
            }
            if (meta.categorical_cols) {
                meta.categorical_cols.forEach(col => {
                    const values = meta.categorical_values?.[col] || [];
                    initialForm[col] = values[0] || '';
                });
            }
            setFormData(initialForm);
        } catch (error) {
            console.error('Error fetching metadata:', error);
        } finally {
            setLoadingMetadata(false);
        }
    };

    const handleCustomerClick = async (customer) => {
        setSelectedCustomer(customer);
        setLoadingShap(true);
        setCustomerShap(null);

        try {
            // Fetch SHAP values for this customer
            const response = await customersApi.getById(customer.customer_id);
            const data = response.data;

            // Parse SHAP values if they exist
            if (data.shap_values) {
                const shapData = typeof data.shap_values === 'string'
                    ? JSON.parse(data.shap_values)
                    : data.shap_values;
                setCustomerShap(shapData);
            }
        } catch (error) {
            console.error('Error fetching customer details:', error);
        } finally {
            setLoadingShap(false);
        }
    };

    const handlePredictChurn = async () => {
        setPredicting(true);
        setPredictionResult(null);

        try {
            const response = await predictionsApi.predictSingle(formData);
            setPredictionResult(response.data);
        } catch (error) {
            console.error('Error predicting churn:', error);
            alert('Prediction failed: ' + (error.response?.data?.detail || error.message));
        } finally {
            setPredicting(false);
        }
    };

    const getRiskBadgeColor = (level) => {
        switch (level?.toLowerCase()) {
            case 'high': return 'bg-red-100 text-red-800 border-red-300';
            case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'low': return 'bg-green-100 text-green-800 border-green-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getRiskIcon = (level) => {
        switch (level?.toLowerCase()) {
            case 'high': return '🔴';
            case 'medium': return '🟡';
            case 'low': return '🟢';
            default: return '⚪';
        }
    };

    const generateRetentionRecommendations = (shapValues) => {
        if (!shapValues || !Array.isArray(shapValues)) return [];

        // Get top 3 risk drivers
        const topDrivers = shapValues
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .slice(0, 3);

        const recommendations = topDrivers.map(driver => {
            const feature = driver.feature.toLowerCase();
            const value = driver.value;

            // Generic recommendations based on feature patterns
            if (feature.includes('contract') || feature.includes('month')) {
                return 'Consider offering long-term contract incentives or loyalty rewards';
            } else if (feature.includes('charge') || feature.includes('price') || feature.includes('cost')) {
                return 'Review pricing strategy or offer personalized discounts';
            } else if (feature.includes('support') || feature.includes('ticket')) {
                return 'Proactively reach out to resolve outstanding support issues';
            } else if (feature.includes('tenure') || feature.includes('age')) {
                return 'Implement onboarding improvements for new customers';
            } else if (feature.includes('service') || feature.includes('product')) {
                return 'Offer product upgrades or additional service features';
            } else {
                return `Address ${driver.feature} to reduce churn risk`;
            }
        });

        return recommendations;
    };

    if (!hasUploadedData) {
        return null; // Will redirect
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Customer Intelligence</h1>
                <p className="mt-2 text-gray-600">
                    Search existing customers or predict churn for new profiles using AI-powered risk assessment
                </p>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
                <div className="border-b border-gray-200">
                    <nav className="flex -mb-px">
                        <button
                            onClick={() => setActiveTab('lookup')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'lookup'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Search className="w-5 h-5" />
                                <div className="text-left">
                                    <div>Customer Lookup</div>
                                    <div className="text-xs font-normal text-gray-500">
                                        Analyze existing customers from uploaded dataset
                                    </div>
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('predictor')}
                            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'predictor'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5" />
                                <div className="text-left">
                                    <div>Churn Predictor</div>
                                    <div className="text-xs font-normal text-gray-500">
                                        Predict churn for new or hypothetical customers
                                    </div>
                                </div>
                            </div>
                        </button>
                    </nav>
                </div>
            </div>

            {/* TAB 1: Customer Lookup */}
            {activeTab === 'lookup' && (
                <div className="space-y-6">
                    {/* Search and Filter Bar */}
                    <div className="bg-white rounded-lg shadow-sm p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="flex-1">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                    <input
                                        type="text"
                                        placeholder="Search by Customer ID or browse below..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Risk Filter */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setRiskFilter('all')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${riskFilter === 'all'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    All Customers
                                </button>
                                <button
                                    onClick={() => setRiskFilter('high')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'high'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    🔴 High Risk
                                </button>
                                <button
                                    onClick={() => setRiskFilter('medium')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'medium'
                                            ? 'bg-yellow-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    🟡 Medium Risk
                                </button>
                                <button
                                    onClick={() => setRiskFilter('low')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'low'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                >
                                    🟢 Low Risk
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Customer Table */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Customer ID
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Churn Probability
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Risk Level
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Top Risk Driver
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {loadingCustomers ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                                Loading customers...
                                            </td>
                                        </tr>
                                    ) : filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                                No customers found
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCustomers.slice(0, 50).map((customer) => (
                                            <tr
                                                key={customer.id}
                                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                onClick={() => handleCustomerClick(customer)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                    {customer.customer_id}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                                            <div
                                                                className={`h-2 rounded-full ${(customer.churn_probability || 0) > 0.7
                                                                        ? 'bg-red-600'
                                                                        : (customer.churn_probability || 0) > 0.4
                                                                            ? 'bg-yellow-600'
                                                                            : 'bg-green-600'
                                                                    }`}
                                                                style={{ width: `${(customer.churn_probability || 0) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-900">
                                                            {((customer.churn_probability || 0) * 100).toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeColor(customer.churn_risk_level)}`}>
                                                        {getRiskIcon(customer.churn_risk_level)} {customer.churn_risk_level?.toUpperCase() || 'UNKNOWN'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                    {customer.top_risk_factor || 'N/A'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCustomerClick(customer);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                                        title="Open detailed churn risk analysis"
                                                    >
                                                        View Profile
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: Churn Predictor */}
            {activeTab === 'predictor' && (
                <div className="space-y-6">
                    {/* Description */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-900">
                                <p className="font-medium mb-1">Instant Churn Risk Assessment</p>
                                <p>
                                    Enter customer attributes to generate an AI-powered churn risk assessment.
                                    Fields adapt automatically to your uploaded dataset - works for any industry.
                                </p>
                            </div>
                        </div>
                    </div>

                    {loadingMetadata ? (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                            <p className="text-gray-600">Loading prediction form...</p>
                        </div>
                    ) : !metadata ? (
                        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
                            <p className="text-gray-600">Failed to load metadata. Please try refreshing the page.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Input Form */}
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">Customer Profile</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Enter customer attributes for churn risk assessment
                                </p>

                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                    {/* Numerical Fields */}
                                    {metadata.numerical_cols?.map((col) => (
                                        <div key={col}>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                {col}
                                            </label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData[col] || 0}
                                                onChange={(e) => setFormData({ ...formData, [col]: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                title={`Enter a numeric value for ${col}`}
                                            />
                                        </div>
                                    ))}

                                    {/* Categorical Fields */}
                                    {metadata.categorical_cols?.map((col) => {
                                        const options = metadata.categorical_values?.[col] || [];
                                        return (
                                            <div key={col}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    {col}
                                                </label>
                                                <select
                                                    value={formData[col] || ''}
                                                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    title={`Select the applicable ${col} category`}
                                                >
                                                    {options.map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>

                                <button
                                    onClick={handlePredictChurn}
                                    disabled={predicting}
                                    className="w-full mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center gap-2"
                                    title="Submit profile for AI analysis"
                                >
                                    {predicting ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            Analyzing...
                                        </>
                                    ) : (
                                        <>
                                            <Target className="w-5 h-5" />
                                            Assess Churn Risk
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Results Panel */}
                            <div className="bg-white rounded-lg shadow-sm p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-1">Risk Assessment</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    AI-generated churn probability and key risk drivers
                                </p>

                                {!predictionResult ? (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                                        <Target className="w-16 h-16 mb-4" />
                                        <p className="text-center">
                                            Enter customer attributes and click<br />"Assess Churn Risk" to generate prediction
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Churn Probability Gauge */}
                                        <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                                            <p className="text-sm text-gray-600 mb-2">Churn Probability</p>
                                            <div className="text-5xl font-bold text-gray-900 mb-2">
                                                {((predictionResult.churn_probability || 0) * 100).toFixed(1)}%
                                            </div>
                                            <p className="text-xs text-gray-500">
                                                Likelihood this customer will stop using your service
                                            </p>
                                        </div>

                                        {/* Risk Level Badge */}
                                        <div className="text-center">
                                            <span className={`inline-block px-6 py-3 rounded-full text-lg font-bold border-2 ${getRiskBadgeColor(predictionResult.risk_level)}`}>
                                                {getRiskIcon(predictionResult.risk_level)} {predictionResult.risk_level?.toUpperCase()} RISK
                                            </span>
                                            <p className="text-xs text-gray-500 mt-2">
                                                Urgency of intervention required
                                            </p>
                                        </div>

                                        {/* Key Risk Drivers */}
                                        {predictionResult.shap_values && predictionResult.shap_values.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-gray-900 mb-3">Key Risk Drivers</h4>
                                                <p className="text-xs text-gray-500 mb-3">
                                                    SHAP (SHapley Additive exPlanations) - game-theory based AI interpretability
                                                </p>
                                                <div className="space-y-3">
                                                    {predictionResult.shap_values.slice(0, 5).map((shap, idx) => (
                                                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                                                            <div className="flex items-start justify-between mb-1">
                                                                <span className="font-medium text-gray-900">
                                                                    {shap.value > 0 ? '↑' : '↓'} {shap.feature}
                                                                </span>
                                                                <span className="text-sm text-gray-600">
                                                                    {shap.customer_value}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {shap.value > 0 ? '+' : ''}{shap.value.toFixed(3)} risk impact
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Customer Risk Profile Panel (Slide-over) */}
            {selectedCustomer && (
                <div className="fixed inset-0 z-50 overflow-hidden">
                    <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setSelectedCustomer(null)} />

                    <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-xl overflow-y-auto">
                        <div className="p-6">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-900">Customer Risk Profile</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        Deep-dive analysis of churn risk factors and recommended actions
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Customer ID */}
                            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Customer ID</p>
                                <p className="text-xl font-bold text-gray-900">{selectedCustomer.customer_id}</p>
                            </div>

                            {/* Churn Probability Gauge */}
                            <div className="mb-6 text-center p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                                <p className="text-sm text-gray-600 mb-2">Churn Probability</p>
                                <div className="text-6xl font-bold text-gray-900 mb-2">
                                    {((selectedCustomer.churn_probability || 0) * 100).toFixed(1)}%
                                </div>
                                <p className="text-xs text-gray-500">
                                    Likelihood this customer will stop using your service
                                </p>
                            </div>

                            {/* Risk Level Badge */}
                            <div className="mb-6 text-center">
                                <span className={`inline-block px-8 py-4 rounded-full text-xl font-bold border-2 ${getRiskBadgeColor(selectedCustomer.churn_risk_level)}`}>
                                    {getRiskIcon(selectedCustomer.churn_risk_level)} {selectedCustomer.churn_risk_level?.toUpperCase()} RISK
                                </span>
                                <p className="text-xs text-gray-500 mt-2">
                                    Urgency of intervention required
                                </p>
                            </div>

                            {/* Churn Drivers (SHAP) */}
                            {loadingShap ? (
                                <div className="mb-6 p-6 text-center">
                                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                    <p className="text-sm text-gray-600">Loading churn drivers...</p>
                                </div>
                            ) : customerShap && customerShap.length > 0 ? (
                                <div className="mb-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">Churn Drivers</h3>
                                    <p className="text-xs text-gray-500 mb-4">
                                        AI-identified factors contributing to this customer's churn risk, ranked by impact
                                    </p>
                                    <div className="space-y-3">
                                        {customerShap.slice(0, 5).map((shap, idx) => (
                                            <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-medium text-gray-900">
                                                        {shap.value > 0 ? '↑' : '↓'} {shap.feature}
                                                    </span>
                                                    <span className="text-sm text-gray-600">
                                                        {shap.customer_value}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {shap.value > 0 ? '+' : ''}{shap.value.toFixed(3)} risk impact
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}

                            {/* Retention Recommendations */}
                            {customerShap && customerShap.length > 0 && (
                                <div className="mb-6">
                                    <h3 className="font-semibold text-gray-900 mb-2">Retention Recommendations</h3>
                                    <p className="text-xs text-gray-500 mb-4">
                                        Suggested actions based on top risk drivers
                                    </p>
                                    <div className="space-y-2">
                                        {generateRetentionRecommendations(customerShap).map((rec, idx) => (
                                            <div key={idx} className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <span className="text-green-600 font-bold">{idx + 1}.</span>
                                                <p className="text-sm text-green-900">{rec}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Customer Details */}
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Customer Details</h3>
                                <p className="text-xs text-gray-500 mb-4">
                                    Full profile data from uploaded dataset
                                </p>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    {Object.entries(selectedCustomer)
                                        .filter(([key]) => !['id', 'shap_values', 'created_at', 'updated_at'].includes(key))
                                        .map(([key, value]) => (
                                            <div key={key} className="p-3 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-500 mb-1">{key}</p>
                                                <p className="font-medium text-gray-900">
                                                    {value !== null && value !== undefined ? String(value) : 'N/A'}
                                                </p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
