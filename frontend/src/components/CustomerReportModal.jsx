import React, { useRef } from 'react';
import { X, TrendingUp, CheckCircle, Smartphone, Activity, BarChart2, User, Download } from 'lucide-react';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Format a single feature value for display */
const formatValue = (val) => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    const num = parseFloat(val);
    if (!isNaN(num)) {
        if (num > 1000) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num);
        if (Number.isInteger(num)) return num.toString();
        return num.toFixed(2);
    }
    const s = String(val);
    return s.length > 20 ? s.slice(0, 18) + '…' : s;
};

/** Humanise a snake_case / camelCase feature name */
const humanise = (name) =>
    name
        .replace(/([A-Z])/g, ' $1')   // camelCase → words
        .replace(/_/g, ' ')
        .replace(/^\s/, '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

/**
 * Pick top N stat-card features.
 * Priority: by |SHAP| desc → fallback to feature_importance from metadata
 */
const pickStatFeatures = (shapData, customerFeatures, uploadMetadata, n = 3) => {
    if (!customerFeatures) return [];

    const featureKeys = Object.keys(customerFeatures);

    if (shapData && Object.keys(shapData).length > 0) {
        return Object.entries(shapData)
            .filter(([k]) => featureKeys.includes(k))
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, n)
            .map(([k]) => k);
    }

    // Fallback: use feature_importance ordering from metadata
    const fi = uploadMetadata?.feature_importance || uploadMetadata?.summary?.feature_importance || {};
    if (Object.keys(fi).length > 0) {
        return Object.entries(fi)
            .sort(([, a], [, b]) => b - a)
            .slice(0, n)
            .map(([k]) => k)
            .filter(k => featureKeys.includes(k));
    }

    // Last resort: first N keys
    return featureKeys.slice(0, n);
};

/**
 * Build a personalised retention strategy from the customer's top SHAP features.
 * Returns { title, actions }
 */
const buildRetentionStrategy = (shapData, churnProbability) => {
    const defaultHigh = {
        title: 'Immediate Retention Action Required',
        actions: [
            'Offer 15% discount on next 3 months',
            'Schedule check-in call with Success Manager',
            'Review recent support tickets for unresolved issues',
        ],
    };
    const defaultMed = {
        title: 'Proactive Engagement Suggested',
        actions: [
            'Send educational content relevant to their usage',
            'Highlight features they are not currently using',
            'Offer free consultation or audit',
        ],
    };
    const defaultLow = {
        title: 'Nurture & Upsell Opportunity',
        actions: [
            'Request referral or testimonial',
            'Suggest upgrade to annual plan',
            'Invite to beta test new features',
        ],
    };

    if (!shapData || Object.keys(shapData).length === 0) {
        if (churnProbability > 0.7) return defaultHigh;
        if (churnProbability > 0.3) return defaultMed;
        return defaultLow;
    }

    // Sort by |SHAP| desc, keep only risk-increasing (positive SHAP) features
    const topRiskFeatures = Object.entries(shapData)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k.toLowerCase());

    const PATTERNS = [
        {
            match: (f) => /contract|month.to.month|annual/.test(f),
            title: 'Address Contract Risk',
            action: 'Offer upgrade to an annual or 2-year contract with a loyalty discount',
        },
        {
            match: (f) => /charge|price|fee|amount|cost|bill/.test(f),
            title: 'Address Pricing Risk',
            action: 'Provide a personalised pricing review or apply a targeted fee waiver',
        },
        {
            match: (f) => /tenure|age|duration|month|year/.test(f),
            title: 'Loyalty & Onboarding Focus',
            action: 'Send loyalty recognition and an early-tenure onboarding kit',
        },
        {
            match: (f) => /support|ticket|complaint|call|issue/.test(f),
            title: 'Resolve Support Issues',
            action: 'Escalate open tickets to the senior support team immediately',
        },
        {
            match: (f) => /product|service|account|plan|feature/.test(f),
            title: 'Improve Product Experience',
            action: 'Offer a free 3-month upgrade to the premium product tier',
        },
        {
            match: (f) => /balance|credit|loan|debt/.test(f),
            title: 'Financial Risk Intervention',
            action: 'Assign a dedicated relationship manager to assist with financial concerns',
        },
        {
            match: (f) => /transaction|activity|login|session|usage|visit|frequency/.test(f),
            title: 'Re-Engagement Campaign',
            action: 'Launch a targeted re-engagement campaign with usage incentives',
        },
        {
            match: (f) => /lifetime|loyalty|member/.test(f),
            title: 'Membership Appreciation',
            action: 'Grant complimentary access to premium facilities or exclusive events',
        },
        {
            match: (f) => /location|partner|friend|group|social/.test(f),
            title: 'Community Engagement',
            action: 'Invite to referral programs or social community events to build sticky relationships',
        },
    ];

    const actions = [];
    const titleParts = [];

    for (const feat of topRiskFeatures) {
        const matched = PATTERNS.find((p) => p.match(feat));
        if (matched) {
            titleParts.push(matched.title);
            if (!actions.includes(matched.action)) actions.push(matched.action);
        } else {
            actions.push(`Personalised outreach focused on their "${humanise(feat)}" risk factor`);
        }
    }

    const title = titleParts.length > 0
        ? titleParts[0]                                  // use most-impactful match
        : churnProbability > 0.7
            ? defaultHigh.title
            : churnProbability > 0.3
                ? defaultMed.title
                : defaultLow.title;

    // Pad with generic actions if we have fewer than 2
    if (actions.length === 0) {
        return churnProbability > 0.7 ? defaultHigh : churnProbability > 0.3 ? defaultMed : defaultLow;
    }
    if (actions.length < 2) {
        actions.push('Monitor engagement closely over the next 30 days');
    }

    return { title, actions };
};

// ─── component ────────────────────────────────────────────────────────────────

export default function CustomerReportModal({ customer, shapData, customerFeatures, uploadMetadata, onClose }) {
    const reportRef = useRef(null);

    const handleDownloadPdf = async () => {
        if (!reportRef.current) return;
        const html2pdf = (await import('html2pdf.js')).default;

        // Temporarily show the PDF header for capture
        reportRef.current.classList.add('is-generating-pdf');

        const customerId = customer?.customer_id || customer?.id || 'report';
        const opt = {
            margin: [0.5, 0.5],
            filename: `churn-report-${customerId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                scrollY: 0,
                windowWidth: 750
            },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await html2pdf().set(opt).from(reportRef.current).save();
        } finally {
            // Re-hide the header after capture
            reportRef.current.classList.remove('is-generating-pdf');
        }
    };
    if (!customer) return null;

    const prob = customer.churn_probability || 0;
    const probPct = (prob * 100).toFixed(1);
    const riskLevel = customer.churn_risk_level?.toUpperCase() || 'UNKNOWN';

    const getRiskColor = (p) => {
        if (p > 0.7) return 'text-[var(--color-risk-high)] bg-red-100 border-red-200';
        if (p > 0.3) return 'text-[var(--color-risk-medium)] bg-yellow-100 border-yellow-200';
        return 'text-[var(--color-risk-low)] bg-green-100 border-green-200';
    };

    // Parse SHAP — can be dict (from bulk upload storage) or null
    const shapDict = shapData && typeof shapData === 'object' && !Array.isArray(shapData)
        ? shapData
        : null;

    // Sort SHAP entries by absolute value for the bar chart
    const topSHAPFactors = shapDict
        ? Object.entries(shapDict)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, 5)
        : [];

    // ── Dynamic stat cards ──────────────────────────────────────────────────
    const statFeatureKeys = pickStatFeatures(shapDict, customerFeatures, uploadMetadata, 3);

    const statCards = statFeatureKeys
        .filter(k => customerFeatures && customerFeatures[k] !== undefined)
        .map(k => ({
            label: humanise(k),
            value: formatValue(customerFeatures[k]),
            shapImpact: shapDict ? shapDict[k] : null,
        }));

    // ── Personalised retention strategy ────────────────────────────────────
    const strategy = buildRetentionStrategy(shapDict, prob);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

                {/* Header (Screen only - Not in PDF) */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold">
                            {customer.name && !customer.name.startsWith('ROW-') ? (
                                customer.name.substring(0, 1).toUpperCase()
                            ) : (
                                <User className="w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                {customer.name && !customer.name.startsWith('ROW-')
                                    ? customer.name
                                    : `Customer ${customer.customer_id}`}
                            </h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${getRiskColor(prob)}`}>
                                    {riskLevel} RISK
                                </span>
                                <span className="text-gray-500 text-sm">
                                    Last predicted: {new Date(customer.last_prediction_date || Date.now()).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Report Content (This is what is captured in PDF) */}
                <div
                    ref={reportRef}
                    className="overflow-y-auto p-6 space-y-8 flex-1 bg-white"
                >
                    {/* PDF-Only Header (Hidden on screen, visible in PDF) */}
                    <div className="pdf-only-header hidden mb-8 pb-6 border-b-2 border-gray-100 flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-extrabold text-blue-800 mb-1">Attrinex Churn Report</h1>
                            <p className="text-gray-500 text-sm">Customer Intelligence Platform</p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-bold text-gray-900">
                                {customer.name && !customer.name.startsWith('ROW-') ? customer.name : `ID: ${customer.customer_id}`}
                            </h2>
                            <p className="font-bold mt-1" style={{ color: prob > 0.7 ? 'var(--color-risk-high)' : prob > 0.3 ? 'var(--color-risk-medium)' : 'var(--color-risk-low)' }}>
                                {riskLevel} CHURN RISK
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                                Generated: {new Date().toLocaleDateString()}
                            </p>
                        </div>
                    </div>

                    <style>{`
                        /* CSS for PDF Header Toggling */
                        .pdf-only-header { display: none !important; }
                        .is-generating-pdf .pdf-only-header { display: flex !important; }
                        
                        /* Ensure specific styles for the capture canvas */
                        .is-generating-pdf {
                            overflow: visible !important;
                            height: auto !important;
                            width: 750px !important; /* Standard printable width */
                            background: white !important;
                            margin: 0 !important;
                            padding: 30px !important;
                            box-sizing: border-box !important;
                        }

                        .is-generating-pdf * {
                            box-sizing: border-box !important;
                        }

                        /* Stat Cards in PDF - Target specifically within the grid */
                        .is-generating-pdf .grid-cols-4 .bg-gray-50 {
                            min-height: 100px !important;
                            display: flex !important;
                            flex-direction: column !important;
                            justify-content: space-between !important;
                            background-color: #f9fafb !important;
                            border: 1px solid #f3f4f6 !important;
                            padding: 12px !important;
                        }

                        /* Fix for Customer Profile Box in PDF */
                        .is-generating-pdf .profile-box {
                            height: auto !important;
                            max-height: none !important;
                            overflow: visible !important;
                            background-color: #f9fafb !important;
                            border: 1px solid #f3f4f6 !important;
                        }

                        /* Fix for Main Content Grid in PDF */
                        .is-generating-pdf .lg\\:grid-cols-2 {
                            display: grid !important;
                            grid-template-columns: 1fr 1fr !important;
                            gap: 20px !important;
                        }

                        /* Ensure text doesn't wrap awkwardly */
                        .is-generating-pdf .truncate {
                            white-space: normal !important;
                            overflow: visible !important;
                        }
                    `}</style>
                    {/* ── Stat Cards ── */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                        {/* Always-first card: Churn Probability */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                <Activity className="w-4 h-4" /> Churn Probability
                            </div>
                            <div className="text-2xl font-bold text-gray-900">{probPct}%</div>
                            <div className="w-full bg-gray-200 h-1.5 mt-2 rounded-full overflow-hidden">
                                <div
                                    className="h-full"
                                    style={{
                                        width: `${prob * 100}%`,
                                        backgroundColor: prob > 0.5 ? 'var(--color-risk-high)' : 'var(--color-risk-low)'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Dynamic feature cards */}
                        {statCards.length > 0
                            ? statCards.map((card, i) => (
                                <div key={i} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                                        <BarChart2 className="w-4 h-4" />
                                        {card.label}
                                        {card.shapImpact !== null && (
                                            <span className={`ml-auto text-xs font-semibold ${card.shapImpact > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                {card.shapImpact > 0 ? '↑ risk' : '↓ risk'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xl font-bold text-gray-900 truncate">{card.value}</div>
                                </div>
                            ))
                            : (
                                // Fallback hardcoded cards when no features available
                                <>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="text-gray-500 text-sm mb-1">Monthly Charges</div>
                                        <div className="text-2xl font-bold text-gray-900">{formatValue(customer.monthly_charges)}</div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="text-gray-500 text-sm mb-1">Tenure (months)</div>
                                        <div className="text-2xl font-bold text-gray-900">{customer.tenure ?? '—'}</div>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <div className="text-gray-500 text-sm mb-1">Contract</div>
                                        <div className="text-lg font-bold text-gray-900 truncate">{customer.contract_type || 'Unknown'}</div>
                                    </div>
                                </>
                            )
                        }
                    </div>

                    {/* ── Main Content ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Left: Key Risk Drivers (SHAP) */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-blue-600" />
                                Key Risk Drivers
                            </h3>
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                {topSHAPFactors.length > 0 ? (
                                    <div className="space-y-4">
                                        {topSHAPFactors.map(([feature, impact], idx) => {
                                            const isNegative = impact < 0;
                                            const width = Math.min(Math.abs(impact) * 100 * 2, 100);
                                            return (
                                                <div key={idx} className="relative">
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="font-medium text-gray-700">{humanise(feature)}</span>
                                                        <span style={{ color: isNegative ? 'var(--color-risk-low)' : 'var(--color-risk-high)', fontWeight: isNegative ? 'normal' : '600' }}>
                                                            {isNegative ? 'Reduces Risk' : 'Increases Risk'}
                                                        </span>
                                                    </div>
                                                    {/* Show feature value underneath if available */}
                                                    {customerFeatures && customerFeatures[feature] !== undefined && (
                                                        <div className="text-xs text-gray-400 mb-1">
                                                            Value: {formatValue(customerFeatures[feature])}
                                                        </div>
                                                    )}
                                                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden flex">
                                                        <div className="w-1/2 flex justify-end">
                                                            {isNegative && (
                                                                <div className="h-full rounded-l-full" style={{ width: `${width}%`, backgroundColor: 'var(--color-risk-low)' }} />
                                                            )}
                                                        </div>
                                                        <div className="w-1/2">
                                                            {!isNegative && (
                                                                <div className="h-full rounded-r-full" style={{ width: `${width}%`, backgroundColor: 'var(--color-risk-high)' }} />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-gray-400 text-sm">
                                        {customerFeatures
                                            ? 'SHAP analysis not available for this customer. Re-upload the dataset to generate SHAP values.'
                                            : 'Loading risk driver analysis…'}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right: Retention Strategy + Profile */}
                        <div className="space-y-6">

                            {/* Personalised Retention Strategy */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                    <Smartphone className="w-5 h-5 text-purple-600" />
                                    Retention Strategy
                                </h3>
                                <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl p-5 shadow-sm">
                                    <div className="font-semibold text-purple-900 mb-3">{strategy.title}</div>
                                    <ul className="space-y-2">
                                        {strategy.actions.map((action, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                                                <CheckCircle className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                                {action}
                                            </li>
                                        ))}
                                    </ul>
                                    {/* Show which features drove this strategy */}
                                    {topSHAPFactors.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-purple-100 text-xs text-purple-600">
                                            Based on top risk drivers: {topSHAPFactors.slice(0, 2).map(([f]) => humanise(f)).join(', ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Full Feature Profile */}
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Customer Profile</h3>
                                <div className="profile-box bg-gray-50 rounded-xl p-4 border border-gray-200 h-56 overflow-y-auto text-sm">
                                    {customerFeatures ? (
                                        <table className="w-full">
                                            <tbody>
                                                {Object.entries(customerFeatures).map(([key, val]) => (
                                                    <tr key={key} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                                        <td className="py-1.5 text-gray-500 font-medium capitalize pr-2">{humanise(key)}</td>
                                                        <td className="py-1.5 text-gray-900 text-right font-medium">{formatValue(val)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <table className="w-full">
                                            <tbody>
                                                {Object.entries(customer)
                                                    .filter(([key, value]) => {
                                                        // 1. Hide internal/technical fields
                                                        if (['id', 'churn_probability', 'churn_risk_level', 'is_churned', 'shap_values', 'top_factors', 'features_json', 'shap_values_json', 'last_prediction_date', 'created_at', 'updated_at', 'customer_id', 'name', 'email', 'phone', 'top_risk_factor'].includes(key)) return false;

                                                        // 2. Hide common telco fields if they are at their default state (null, false, 0, Unknown, —)
                                                        const defaults = [null, undefined, false, 0, '0', 0.0, 'Unknown', '—', 'none', 'no internet service'];
                                                        if (defaults.includes(value)) return false;

                                                        return true;
                                                    })
                                                    .map(([key, value]) => (
                                                        <tr key={key} className="border-b border-gray-100 last:border-0 hover:bg-gray-100">
                                                            <td className="py-1.5 text-gray-500 font-medium capitalize pr-2">{humanise(key)}</td>
                                                            <td className="py-1.5 text-gray-900 text-right font-medium">
                                                                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value ?? '—')}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    )}
                                    {!customerFeatures && (
                                        <div className="mt-4 p-2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-100">
                                            Tip: Re-upload the dataset to see all original columns and personalisation.
                                        </div>
                                    )}
                                </div>
                            </div>


                        </div>
                    </div>
                </div>

                {/* Footer (Screen only - Not in PDF) */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleDownloadPdf}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-sm flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Download PDF
                    </button>
                </div>

            </div>
        </div>
    );
}
