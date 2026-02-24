import React from 'react';
import { X, TrendingUp, AlertTriangle, CheckCircle, Smartphone, User, DollarSign, Calendar, Activity } from 'lucide-react';

export default function CustomerReportModal({ customer, shapData, onClose }) {
    if (!customer) return null;

    // Helper to format currency
    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    // Get Risk Color
    const getRiskColor = (prob) => {
        if (prob > 70) return 'text-red-600 bg-red-100 border-red-200';
        if (prob > 30) return 'text-yellow-600 bg-yellow-100 border-yellow-200';
        return 'text-green-600 bg-green-100 border-green-200';
    };

    const riskColorClass = getRiskColor(customer.churn_probability * 100);
    const riskLevel = customer.churn_risk_level?.toUpperCase() || 'UNKNOWN';

    // Parse SHAP if string
    const shapValues = typeof shapData === 'string' ? JSON.parse(shapData) : shapData;

    // Sort SHAP factors by absolute impact
    const topFactors = shapValues
        ? Object.entries(shapValues)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, 5)
        : [];

    // AI Strategy Generator
    const getRetentionStrategy = () => {
        if (customer.churn_probability > 0.7) {
            return {
                title: "Immediate Retention Action Required",
                actions: [
                    "Offer 15% discount on next 3 months",
                    "Schedule check-in call with Success Manager",
                    "Review recent support tickets for unresolved issues"
                ]
            };
        } else if (customer.churn_probability > 0.3) {
            return {
                title: "Proactive Engagement Suggested",
                actions: [
                    "Send educational content relevant to their usage",
                    "Highlight features they are not currently using",
                    "Offer free consultation/audit"
                ]
            };
        } else {
            return {
                title: "Nurture & Upsell Opportunity",
                actions: [
                    "Request referral or testimonial",
                    "Suggest upgrade to annual plan",
                    "Invite to beta test new features"
                ]
            };
        }
    };

    const strategy = getRetentionStrategy();

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                            {customer.customer_id.substring(0, 1)}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                Customer {customer.customer_id}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${riskColorClass}`}>
                                    {riskLevel} RISK
                                </span>
                                <span className="text-gray-500 text-sm">
                                    Last predicted: {new Date(customer.last_prediction_date || Date.now()).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                <div className="p-6 space-y-8">
                    {/* Top Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Activity className="w-4 h-4" /> Churn Probability
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                                {(customer.churn_probability * 100).toFixed(1)}%
                            </div>
                            <div className="w-full bg-gray-200 h-1.5 mt-2 rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${customer.churn_probability > 0.5 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${customer.churn_probability * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <DollarSign className="w-4 h-4" /> Monthly Charges
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                                {formatCurrency(customer.monthly_charges || 0)}
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Calendar className="w-4 h-4" /> Tenure
                            </div>
                            <div className="text-2xl font-bold text-gray-900">
                                {customer.tenure || 0} <span className="text-sm font-normal text-gray-500">months</span>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <User className="w-4 h-4" /> Contract
                            </div>
                            <div className="text-lg font-bold text-gray-900 truncate">
                                {customer.contract_type || 'Unknown'}
                            </div>
                        </div>
                    </div>

                    {/* Main Content Split */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Left: Key Risk Drivers (SHAP) */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Key Risk Drivers
                            </h3>
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                {topFactors.length > 0 ? (
                                    <div className="space-y-4">
                                        {topFactors.map(([feature, impact], idx) => {
                                            const isNegative = impact < 0; // Negative SHAP = Lowers Churn (Good)
                                            const color = isNegative ? 'bg-green-500' : 'bg-red-500';
                                            const width = Math.min(Math.abs(impact) * 100 * 2, 100); // Scale factor

                                            return (
                                                <div key={idx} className="relative">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-gray-700">{feature}</span>
                                                        <span className={isNegative ? 'text-green-600' : 'text-red-600 font-semibold'}>
                                                            {isNegative ? 'Reduces Risk' : 'Increases Risk'}
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                                                        <div className="w-1/2 flex justify-end">
                                                            {isNegative && (
                                                                <div className="h-full bg-green-500 rounded-l-full" style={{ width: `${width}%` }} />
                                                            )}
                                                        </div>
                                                        <div className="w-1/2">
                                                            {!isNegative && (
                                                                <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${width}%` }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        No driver analysis available for this customer.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: AI Strategy & Details */}
                        <div className="space-y-6">

                            {/* AI Strategy Card */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                    <Smartphone className="w-5 h-5 text-purple-600" />
                                    Retention Strategy
                                </h3>
                                <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-5 shadow-sm">
                                    <div className="font-semibold text-purple-900 mb-3">
                                        {strategy.title}
                                    </div>
                                    <ul className="space-y-2">
                                        {strategy.actions.map((action, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5" />
                                                {action}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Full Profile Details */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Profile</h3>
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 h-64 overflow-y-auto text-sm">
                                    <table className="w-full">
                                        <tbody>
                                            {Object.entries(customer).map(([key, value]) => {
                                                if (['id', 'churn_probability', 'churn_risk_level', 'is_churned', 'shap_values', 'top_factors'].includes(key)) return null;
                                                return (
                                                    <tr key={key} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                                        <td className="py-2 text-gray-500 font-medium capitalize">
                                                            {key.replace(/_/g, ' ')}
                                                        </td>
                                                        <td className="py-2 text-gray-900 text-right font-medium">
                                                            {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                    >
                        Close
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2">
                        <Smartphone className="w-4 h-4" />
                        Log Action
                    </button>
                </div>

            </div>
        </div>
    );
}
