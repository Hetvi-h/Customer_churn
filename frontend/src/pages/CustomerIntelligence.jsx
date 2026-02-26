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
    RefreshCw,
    FileText,
    CheckCircle
} from 'lucide-react';
import { useUpload } from '../contexts/UploadContext';
import { predictionsApi } from '../services/api';
import CustomerReportModal from '../components/CustomerReportModal';
import { SkeletonRow, HelpTooltip, InlineError } from '../components/Common';
import { useApiData } from '../hooks/useSwrFetcher';

/**
 * Customer Intelligence - Merged Customers + Predictions Page
 * 
 * Tab 1: Customer Lookup - Search/analyze existing customers from uploaded CSV
 * Tab 2: Churn Predictor - Predict churn for new/hypothetical customers
 */
export default function CustomerIntelligence() {
    const navigate = useNavigate();
    const { hasUploadedData } = useUpload();

    // Redirect if no data uploaded
    useEffect(() => {
        if (!hasUploadedData) {
            navigate('/upload');
        }
    }, [hasUploadedData, navigate]);

    // Tab state
    const [activeTab, setActiveTab] = useState('lookup'); // 'lookup' or 'predictor'

    // Filtering State
    const [searchQuery, setSearchQuery] = useState('');
    const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'high', 'medium', 'low'
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 50;

    // View State
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerShap, setCustomerShap] = useState(null);
    const [customerFeatures, setCustomerFeatures] = useState(null);
    const [loadingShap, setLoadingShap] = useState(false);

    // Predictor State
    const [formData, setFormData] = useState({});
    const [predictionResult, setPredictionResult] = useState(null);
    const [predicting, setPredicting] = useState(false);
    const [predictError, setPredictError] = useState(null);

    // --- SWR Data Fetching ---

    // 1. Fetch Customers (only active when on lookup tab)
    const {
        data: customersRes,
        isLoading: loadingCustomers,
        error: customersError
    } = useApiData(
        activeTab === 'lookup'
            ? `/customers?page=${currentPage}&page_size=${PAGE_SIZE}&sort_by=churn_probability&sort_order=desc${searchQuery ? `&search=${searchQuery}` : ''}${riskFilter !== 'all' ? `&risk_level=${riskFilter}` : ''}`
            : null
    );

    const customers = customersRes?.customers || customersRes || [];
    const totalCustomers = customersRes?.total ?? customers.length;

    // The backend API should handle filtering natively with the `risk_level` and `search` params
    // via SWR. But just to be safe and match the previous UI state logic:
    const filteredCustomers = customers;

    // 2. Fetch Metadata (only active when on predictor tab)
    const {
        data: metadata,
        isLoading: loadingMetadata,
        error: metadataError
    } = useApiData(
        activeTab === 'predictor' ? '/metadata' : null
    );

    // Reset to page 1 whenever search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, riskFilter]);

    // Initialize Predictor Form when Metadata Loads
    useEffect(() => {
        if (metadata && Object.keys(formData).length === 0) {
            try {
                const initialForm = {};
                if (metadata.numerical_cols) {
                    metadata.numerical_cols.forEach(col => {
                        initialForm[col] = 0;
                    });
                }
                if (metadata.categorical_cols) {
                    metadata.categorical_cols.forEach(col => {
                        const values = metadata.categorical_values?.[col] || [];
                        initialForm[col] = values[0] || '';
                    });
                }
                setFormData(initialForm);
            } catch (error) {
                console.error('Error initializing form data:', error);
            }
        }
    }, [metadata, formData]);

    const handleCustomerClick = async (customer) => {
        setSelectedCustomer(customer);
        setLoadingShap(true);
        setCustomerShap(null);
        setCustomerFeatures(null);

        try {
            // Fetch full customer detail (includes features_json and shap_values_json)
            const response = await customersApi.getCustomer(customer.customer_id);
            const data = response.data;

            // Store features dict for dynamic stat cards
            if (data.features_json) {
                setCustomerFeatures(
                    typeof data.features_json === 'string'
                        ? JSON.parse(data.features_json)
                        : data.features_json
                );
            }

            // Store SHAP dict for Key Risk Drivers
            if (data.shap_values_json) {
                const shapData = typeof data.shap_values_json === 'string'
                    ? JSON.parse(data.shap_values_json)
                    : data.shap_values_json;
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
        setPredictError(null);

        try {
            const response = await predictionsApi.predictWithExplanation(formData);
            setPredictionResult(response.data);
        } catch (error) {
            console.error('Error predicting churn:', error);
            const detail = error?.response?.data?.detail;
            setPredictError(detail || 'Prediction failed. Please check your inputs and try again.');
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
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'all' || riskFilter === 'high' ? '' : 'opacity-50'}`}
                                    style={riskFilter === 'high' ? { backgroundColor: 'var(--color-risk-high)', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
                                >
                                    🔴 High Risk
                                </button>
                                <button
                                    onClick={() => setRiskFilter('medium')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'all' || riskFilter === 'medium' ? '' : 'opacity-50'}`}
                                    style={riskFilter === 'medium' ? { backgroundColor: 'var(--color-risk-medium)', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
                                >
                                    🟡 Medium Risk
                                </button>
                                <button
                                    onClick={() => setRiskFilter('low')}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${riskFilter === 'all' || riskFilter === 'low' ? '' : 'opacity-50'}`}
                                    style={riskFilter === 'low' ? { backgroundColor: 'var(--color-risk-low)', color: 'white' } : { backgroundColor: '#f3f4f6', color: '#374151' }}
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
                                            <span className="flex items-center gap-1">Churn Probability
                                                <HelpTooltip text="Likelihood (0-100%) this customer will stop using your service. Above 70% = High Risk." position="top" />
                                            </span>
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            <span className="flex items-center gap-1">Risk Level
                                                <HelpTooltip text="High (>70%), Medium (30-70%), Low (<30%) based on churn probability." position="top" />
                                            </span>
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
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <SkeletonRow key={i} cols={5} />
                                        ))
                                    ) : filteredCustomers.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 text-gray-400">
                                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                                    <p className="font-medium text-gray-600">No customers found</p>
                                                    <p className="text-sm">Try adjusting your search or risk filter</p>
                                                </div>
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
                                                                className="h-2 rounded-full"
                                                                style={{
                                                                    width: `${(customer.churn_probability || 0) * 100}%`,
                                                                    backgroundColor: (customer.churn_probability || 0) > 0.7
                                                                        ? 'var(--color-risk-high)'
                                                                        : (customer.churn_probability || 0) > 0.4
                                                                            ? 'var(--color-risk-medium)'
                                                                            : 'var(--color-risk-low)'
                                                                }}
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
                                                        View Report
                                                        <FileText className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {totalCustomers > PAGE_SIZE && (
                            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-white">
                                <span className="text-sm text-gray-600">
                                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCustomers)} of {totalCustomers.toLocaleString()} customers
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1 || loadingCustomers}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        ← Prev
                                    </button>
                                    <span className="text-sm font-medium text-gray-900 px-2">
                                        Page {currentPage} of {Math.ceil(totalCustomers / PAGE_SIZE)}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCustomers / PAGE_SIZE), p + 1))}
                                        disabled={currentPage >= Math.ceil(totalCustomers / PAGE_SIZE) || loadingCustomers}
                                        className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
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
                                    {[...(metadata.feature_cols || [
                                        ...(metadata.numerical_cols || []),
                                        ...(metadata.categorical_cols || []),
                                    ])].map((col) => {
                                        // ── Human-readable label ───────────────────────────────────
                                        const LABEL_MAP = {
                                            Near_Location: 'Near Location',
                                            Contract_period: 'Contract Period',
                                            Avg_additional_charges_total: 'Avg Additional Charges ($)',
                                            Avg_class_frequency_total: 'Avg Class Frequency (Total)',
                                            Avg_class_frequency_current_month: 'Avg Class Frequency (This Month)',
                                            Month_to_end_contract: 'Months to Contract End',
                                            Promo_friends: 'Referred by Friend',
                                            Group_visits: 'Group Visits',
                                            Age: 'Age (years)',
                                            Lifetime: 'Membership Lifetime (months)',
                                            tenure: 'Tenure (months)',
                                            MonthlyCharges: 'Monthly Charges ($)',
                                            TotalCharges: 'Total Charges ($)',
                                            SeniorCitizen: 'Senior Citizen',
                                        };
                                        const label = LABEL_MAP[col]
                                            || col
                                                .replace(/_/g, ' ')
                                                .replace(/\b\w/g, c => c.toUpperCase());

                                        const isCategorical = (metadata.categorical_cols || []).includes(col);
                                        const colLower = col.toLowerCase();
                                        const metaOptions = metadata.categorical_values?.[col];

                                        // ── Decide input type ──────────────────────────────────────
                                        // NOTE: Check special patterns FIRST — binary fields like
                                        // gender/Phone/Partner live in numerical_cols (encoded 0/1)
                                        // so isCategorical would be false for them.
                                        let inputEl;

                                        if (colLower.includes('gender') || colLower === 'sex') {
                                            // Gender → Male / Female
                                            inputEl = (
                                                <select
                                                    value={formData[col] ?? 0}
                                                    onChange={e => setFormData({ ...formData, [col]: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                >
                                                    <option value={0}>Male</option>
                                                    <option value={1}>Female</option>
                                                </select>
                                            );
                                        } else if (colLower === 'contract_period' || colLower.endsWith('contractperiod')) {
                                            // Contract period → 1 / 6 / 12 months
                                            inputEl = (
                                                <select
                                                    value={formData[col] ?? 1}
                                                    onChange={e => setFormData({ ...formData, [col]: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                >
                                                    <option value={1}>1 Month</option>
                                                    <option value={6}>6 Months</option>
                                                    <option value={12}>12 Months</option>
                                                </select>
                                            );
                                        } else if (
                                            (metadata.known_binary_fields || []).includes(col)
                                            || ['phone', 'partner', 'promo_friends', 'group_visits',
                                                'near_location', 'paperlessbilling', 'multiplelines',
                                                'phoneservice', 'seniorcitizen'].includes(colLower)
                                        ) {
                                            // Binary → No / Yes
                                            inputEl = (
                                                <select
                                                    value={formData[col] ?? 0}
                                                    onChange={e => setFormData({ ...formData, [col]: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                >
                                                    <option value={0}>No</option>
                                                    <option value={1}>Yes</option>
                                                </select>
                                            );
                                        } else if (metaOptions && metaOptions.length > 0) {
                                            // String categorical with known options
                                            inputEl = (
                                                <select
                                                    value={formData[col] ?? metaOptions[0]}
                                                    onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                                >
                                                    {metaOptions.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            );
                                        } else if (isCategorical) {
                                            // Unknown categorical → free text
                                            inputEl = (
                                                <input
                                                    type="text"
                                                    value={formData[col] ?? ''}
                                                    onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                    placeholder={`Enter ${label.toLowerCase()}`}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            );
                                        } else {
                                            // Numerical field
                                            inputEl = (
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0"
                                                    value={formData[col] ?? 0}
                                                    onChange={e => setFormData({ ...formData, [col]: parseFloat(e.target.value) || 0 })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    title={`Enter a numeric value for ${label}`}
                                                />
                                            );
                                        }

                                        return (
                                            <div key={col}>
                                                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                                    {label}
                                                    {isCategorical && (
                                                        <span className="text-[10px] font-normal text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                            Category
                                                        </span>
                                                    )}
                                                </label>
                                                {inputEl}
                                            </div>
                                        );
                                    })}
                                </div>

                                {predictError && (
                                    <div className="mt-4">
                                        <InlineError
                                            message={predictError}
                                            onDismiss={() => setPredictError(null)}
                                            onRetry={handlePredictChurn}
                                        />
                                    </div>
                                )}

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
                                    AI-generated churn probability, key risk drivers &amp; retention strategy
                                </p>

                                {!predictionResult ? (
                                    <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                                        <Target className="w-16 h-16 mb-4" />
                                        <p className="text-center">
                                            Enter customer attributes and click<br />"Assess Churn Risk" to generate prediction
                                        </p>
                                    </div>
                                ) : (() => {
                                    // ── Helpers (mirrors CustomerReportModal) ────────────────────
                                    const humanise = (name) =>
                                        name.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\s/, '')
                                            .split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

                                    const formatVal = (val) => {
                                        if (val === null || val === undefined) return '—';
                                        if (typeof val === 'boolean') return val ? 'Yes' : 'No';
                                        const n = parseFloat(val);
                                        if (!isNaN(n)) {
                                            if (n > 1000) return `$${Math.round(n).toLocaleString()}`;
                                            return Number.isInteger(n) ? n.toString() : n.toFixed(2);
                                        }
                                        return String(val);
                                    };

                                    const prob = predictionResult.churn_probability || 0;
                                    const probPct = (prob * 100).toFixed(1);
                                    const riskLevel = predictionResult.risk_level?.toUpperCase() || 'UNKNOWN';
                                    const riskColorClass = prob > 0.7
                                        ? 'text-[var(--color-risk-high)] bg-red-50 border-red-200'
                                        : prob > 0.3
                                            ? 'text-[var(--color-risk-medium)] bg-yellow-50 border-yellow-200'
                                            : 'text-[var(--color-risk-low)] bg-green-50 border-green-200';

                                    // shap_values from /explain is already a dict: {feature: float}
                                    // Handle both dict and array formats defensively
                                    const rawShap = predictionResult.shap_values || {};
                                    let shapDict = {};
                                    if (Array.isArray(rawShap)) {
                                        // array format: [{feature, value}]
                                        rawShap.forEach(s => { shapDict[s.feature] = s.value; });
                                    } else if (typeof rawShap === 'object') {
                                        // dict format: {feature: float}  ← what backend actually returns
                                        shapDict = rawShap;
                                    }

                                    // Sort by |impact| for bars
                                    const topSHAP = Object.entries(shapDict)
                                        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                                        .slice(0, 5);

                                    // Retention strategy (same PATTERNS as modal)
                                    const topRiskFeatures = Object.entries(shapDict)
                                        .filter(([, v]) => v > 0).sort(([, a], [, b]) => b - a)
                                        .slice(0, 3).map(([k]) => k.toLowerCase());

                                    const PATTERNS = [
                                        { match: f => /contract|month.to.month|annual/.test(f), title: 'Address Contract Risk', action: 'Offer upgrade to an annual or 2-year contract with a loyalty discount' },
                                        { match: f => /charge|price|fee|amount|cost|bill/.test(f), title: 'Address Pricing Risk', action: 'Provide a personalised pricing review or apply a targeted fee waiver' },
                                        { match: f => /tenure|age|duration|month|year|lifetime/.test(f), title: 'Loyalty & Onboarding Focus', action: 'Send loyalty recognition and an early-tenure onboarding kit' },
                                        { match: f => /support|ticket|complaint|call|issue/.test(f), title: 'Resolve Support Issues', action: 'Escalate open tickets to the senior support team immediately' },
                                        { match: f => /product|service|account|plan|feature/.test(f), title: 'Improve Product Experience', action: 'Offer a free 3-month upgrade to the premium product tier' },
                                        { match: f => /balance|credit|loan|debt/.test(f), title: 'Financial Risk Intervention', action: 'Assign a dedicated relationship manager to assist with financial concerns' },
                                        { match: f => /transaction|activity|login|session|usage|visit|frequency/.test(f), title: 'Re-Engagement Campaign', action: 'Launch a targeted re-engagement campaign with usage incentives' },
                                        { match: f => /lifetime|loyalty|member/.test(f), title: 'Membership Appreciation', action: 'Grant complimentary access to premium facilities or exclusive events' },
                                        { match: f => /location|partner|friend|group|social/.test(f), title: 'Community Engagement', action: 'Invite to referral programs or social community events' },
                                    ];

                                    const actions = []; const titleParts = [];
                                    for (const feat of topRiskFeatures) {
                                        const matched = PATTERNS.find(p => p.match(feat));
                                        if (matched) { titleParts.push(matched.title); if (!actions.includes(matched.action)) actions.push(matched.action); }
                                        else actions.push(`Personalised outreach focused on their "${humanise(feat)}" risk factor`);
                                    }
                                    if (actions.length < 2) actions.push('Monitor engagement closely over the next 30 days');
                                    const defaults = { high: { title: 'Immediate Retention Action Required', actions: ['Offer 15% discount on next 3 months', 'Schedule check-in call with Success Manager', 'Review recent support tickets'] }, med: { title: 'Proactive Engagement Suggested', actions: ['Send educational content relevant to their usage', 'Highlight unused features', 'Offer free consultation'] }, low: { title: 'Nurture & Upsell Opportunity', actions: ['Request referral or testimonial', 'Suggest upgrade to annual plan', 'Invite to beta test'] } };
                                    const strategy = actions.length > 0 ? { title: titleParts[0] || (prob > 0.7 ? defaults.high.title : prob > 0.3 ? defaults.med.title : defaults.low.title), actions } : prob > 0.7 ? defaults.high : prob > 0.3 ? defaults.med : defaults.low;

                                    return (
                                        <div className="space-y-6">
                                            {/* ── Top Stat Cards ── */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                                    <div className="text-xs text-gray-500 mb-1">Churn Probability</div>
                                                    <div className="text-3xl font-bold text-gray-900">{probPct}%</div>
                                                    <div className="w-full bg-gray-200 h-1.5 mt-2 rounded-full overflow-hidden">
                                                        <div className={`h-full ${prob > 0.5 ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${prob * 100}%` }} />
                                                    </div>
                                                </div>
                                                <div className={`p-4 rounded-xl border ${riskColorClass}`}>
                                                    <div className="text-xs mb-1 opacity-70">Risk Level</div>
                                                    <div className="text-2xl font-bold">{getRiskIcon(predictionResult.risk_level)} {riskLevel}</div>
                                                    <div className="text-xs mt-1 opacity-60">Urgency of intervention</div>
                                                </div>
                                            </div>

                                            {/* ── Key Risk Drivers ── */}
                                            <div>
                                                <h4 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                                    <TrendingUp className="w-4 h-4 text-blue-600" /> Key Risk Drivers
                                                </h4>
                                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                                    {topSHAP.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {topSHAP.map(([feature, impact], idx) => {
                                                                const isNeg = impact < 0;
                                                                const width = Math.min(Math.abs(impact) * 100 * 2, 100);
                                                                const customerValue = formData[feature];
                                                                return (
                                                                    <div key={idx}>
                                                                        <div className="flex justify-between text-sm mb-1">
                                                                            <span className="font-medium text-gray-700">{humanise(feature)}</span>
                                                                            <span style={{ color: isNeg ? 'var(--color-risk-low)' : 'var(--color-risk-high)', fontWeight: isNeg ? 'normal' : '600' }}>
                                                                                {isNeg ? '↓ Reduces Risk' : '↑ Increases Risk'}
                                                                            </span>
                                                                        </div>
                                                                        {customerValue !== undefined && (
                                                                            <div className="text-xs text-gray-400 mb-1">Value: {formatVal(customerValue)}</div>
                                                                        )}
                                                                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                                                                            <div className="w-1/2 flex justify-end">
                                                                                {isNeg && <div className="h-full rounded-l-full" style={{ width: `${width}%`, backgroundColor: 'var(--color-risk-low)' }} />}
                                                                            </div>
                                                                            <div className="w-1/2">
                                                                                {!isNeg && <div className="h-full rounded-r-full" style={{ width: `${width}%`, backgroundColor: 'var(--color-risk-high)' }} />}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                            <p className="text-[10px] text-gray-400 pt-1">SHAP — SHapley Additive exPlanations (game-theory based AI interpretability)</p>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center py-6 text-gray-400 text-sm">SHAP analysis not available</div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Retention Strategy ── */}
                                            <div>
                                                <h4 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                                                    <CheckCircle className="w-4 h-4 text-purple-600" /> Retention Strategy
                                                </h4>
                                                <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-4 shadow-sm">
                                                    <div className="font-semibold text-purple-900 mb-3">{strategy.title}</div>
                                                    <ul className="space-y-2">
                                                        {strategy.actions.map((action, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                                <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                                                {action}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                    {topSHAP.length > 0 && (
                                                        <div className="mt-3 pt-3 border-t border-purple-100 text-xs text-purple-600">
                                                            Based on top risk drivers: {topSHAP.slice(0, 2).map(([f]) => humanise(f)).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* ── Submitted Feature Profile ── */}
                                            <div>
                                                <h4 className="font-bold text-gray-900 mb-3">Submitted Profile</h4>
                                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 max-h-48 overflow-y-auto text-sm">
                                                    <table className="w-full">
                                                        <tbody>
                                                            {Object.entries(formData).map(([key, val]) => (
                                                                <tr key={key} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                                                    <td className="py-1.5 text-gray-500 font-medium pr-2">{humanise(key)}</td>
                                                                    <td className="py-1.5 text-gray-900 text-right font-medium">{formatVal(val)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Customer Report Modal */}
            {selectedCustomer && (
                <CustomerReportModal
                    customer={selectedCustomer}
                    shapData={customerShap}
                    customerFeatures={customerFeatures}
                    uploadMetadata={uploadMetadata}
                    onClose={() => {
                        setSelectedCustomer(null);
                        setCustomerShap(null);
                        setCustomerFeatures(null);
                    }}
                />
            )}
        </div>
    );
}
