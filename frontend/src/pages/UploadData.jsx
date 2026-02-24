import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { predictionsApi } from '../services/api';
import { useUpload } from '../contexts/UploadContext';
import {
    Upload as UploadIcon,
    CheckCircle,
    AlertCircle,
    Info,
    Download,
    TrendingUp,
    Users,
    Target,
    ChevronRight,
    Zap,
    PieChart
} from 'lucide-react';

/**
 * Upload Data Page - Entry Point After Processing
 * 
 * Section 1: Upload area with info box (always visible)
 * Section 2: Processing complete + comprehensive summary (appears after upload)
 */
const UploadData = () => {
    const navigate = useNavigate();
    const { markDataUploaded, uploadResults, hasUploadedData, resetUpload } = useUpload();
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);

    // Restore results from context on mount
    React.useEffect(() => {
        if (uploadResults && !result) {
            setResult(uploadResults);
        }
    }, [uploadResults, result]);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            const response = await predictionsApi.uploadCSV(file);
            const data = response.data;

            setResult(data);
            setError(null);

            // Mark data as uploaded and store FULL results
            markDataUploaded(data);

            // Scroll to results section
            setTimeout(() => {
                document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 300);

        } catch (err) {
            console.error('Upload error:', err);
            setError(err.response?.data?.detail || 'Failed to upload file');
            setResult(null);
        } finally {
            setUploading(false);
        }
    };

    const handleReset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        resetUpload();
    };

    // Extract data from result (Backend returns nested 'summary' object)
    const summary = result?.summary || {};

    const totalCustomers = result?.rows_processed || summary.total_rows || 0;
    const highRisk = summary.high_risk || 0;
    const mediumRisk = summary.medium_risk || 0;
    const lowRisk = summary.low_risk || 0;
    const churnRate = summary.churn_rate || 0;
    const modelName = summary.model_name || result?.model_info?.model_name || 'XGBoost';
    const rocAuc = summary.roc_auc || result?.model_info?.roc_auc || 0;
    const accuracy = summary.accuracy || result?.model_info?.accuracy || 0;

    const customerIdCol = summary.customer_id_col || result?.schema_info?.customer_id_col || 'Auto-detected';
    const targetCol = summary.target_col || result?.schema_info?.target_col || 'Auto-detected';
    const churnValue = summary.churn_value || 'Yes/1';

    // Feature extraction - Handle multiple formats robustly
    const featureImportance = summary.feature_importance || result?.feature_importance || {};

    // Create normalized array of {feature, importance}
    let topFeatures = [];
    if (Array.isArray(featureImportance)) {
        topFeatures = featureImportance;
    } else {
        topFeatures = Object.entries(featureImportance)
            .map(([feature, importance]) => ({ feature, importance }));
    }

    // Sort by importance (descending) and take top 5
    topFeatures = topFeatures
        .sort((a, b) => Math.abs(b.importance) - Math.abs(a.importance))
        .slice(0, 5);

    // Get all feature names
    const featureCols = Array.isArray(featureImportance)
        ? featureImportance.map(f => f.feature)
        : Object.keys(featureImportance);

    const excludedCols = result?.excluded_cols || [];  // Restored missing variable

    return (
        <div className="max-w-5xl mx-auto">
            {hasUploadedData && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg flex justify-between items-center animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 rounded-full">
                            <CheckCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-medium text-indigo-900">Analysis Active</h3>
                            <p className="text-sm text-indigo-700">Displaying results from your last upload</p>
                        </div>
                    </div>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        <UploadIcon className="w-4 h-4" />
                        Upload New Dataset
                    </button>
                </div>
            )}

            {/* SECTION 1: Upload Area */}
            {!hasUploadedData && (
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Upload Customer Data</h1>
                    <p className="mt-2 text-gray-600">
                        Import your customer dataset. Our AI automatically detects structure, trains a custom model, and generates predictions - no configuration required.
                    </p>
                </div>
            )}

            {/* Info Box - What kind of data is needed */}
            {!hasUploadedData && (
                <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <div className="flex items-start gap-3 mb-3">
                        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <h3 className="font-semibold text-blue-900">What Kind of Data Do I Need?</h3>
                    </div>
                    <div className="ml-8 space-y-3 text-sm text-blue-900">
                        <p>
                            Upload <strong>HISTORICAL customer data</strong> that includes whether each customer churned or stayed.
                        </p>
                        <div className="space-y-2">
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 font-bold">✅</span>
                                <p>
                                    <strong>Required:</strong> A column indicating churn
                                    (e.g. "Churn", "Exited", "Cancelled", "Left" - system auto-detects this)
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 font-bold">✅</span>
                                <p>
                                    <strong>Required:</strong> Customer attributes
                                    (any columns describing your customers)
                                </p>
                            </div>
                            <div className="flex items-start gap-2">
                                <span className="text-green-600 font-bold">✅</span>
                                <p>
                                    <strong>Works for ANY industry:</strong> Telecom, Banking, SaaS, Retail, Gym, Insurance...
                                </p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-blue-200">
                            <div className="flex items-start gap-2">
                                <span className="text-blue-600">💡</span>
                                <p>
                                    Once uploaded, use <strong>"Churn Predictor"</strong> to assess risk for NEW customers who aren't in this dataset yet.
                                </p>
                            </div>
                        </div>
                        <button className="mt-3 flex items-center gap-2 text-blue-700 hover:text-blue-900 font-medium text-sm">
                            <Download className="w-4 h-4" />
                            Download Sample CSV Template
                        </button>
                    </div>
                </div>
            )}

            {/* Upload Area */}
            {!result && (
                <div className="bg-white rounded-lg shadow-md p-8">
                    <div
                        className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${dragActive
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                            }`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {file ? (
                            <div>
                                <div className="text-5xl mb-4">📄</div>
                                <p className="text-lg font-semibold text-gray-900">{file.name}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {(file.size / 1024).toFixed(2)} KB
                                </p>
                                <div className="mt-6 flex gap-3 justify-center">
                                    <button
                                        onClick={handleUpload}
                                        disabled={uploading}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-semibold"
                                        title="Import and process customer dataset"
                                    >
                                        {uploading ? (
                                            <span className="flex items-center gap-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                Processing...
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <UploadIcon className="w-5 h-5" />
                                                Upload & Analyze
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        disabled={uploading}
                                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 transition-colors font-semibold"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="text-6xl mb-4">📁</div>
                                <p className="text-xl font-semibold text-gray-900 mb-2">
                                    Drop your CSV file here
                                </p>
                                <p className="text-gray-600 mb-4">or</p>
                                <label className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors font-semibold">
                                    <input
                                        type="file"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    Choose File
                                </label>
                                <p className="text-sm text-gray-500 mt-4">
                                    Supports CSV and Excel files (.csv, .xlsx, .xls)
                                </p>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-red-800">{error}</p>
                        </div>
                    )}
                </div>
            )}

            {/* SECTION 2: Processing Complete + Comprehensive Summary */}
            {result && (
                <div id="results-section" className="space-y-6">
                    {/* Success Header */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Dataset Processed Successfully!</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    {file?.name} • {totalCustomers.toLocaleString()} customers processed
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 border-t border-gray-200 pt-3 mt-3">
                            Your custom AI model has been trained on this dataset. Explore insights using the navigation menu.
                        </p>
                    </div>

                    {/* Quick Summary - 4 Metric Cards */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow-md p-6 text-center">
                            <div className="text-sm font-medium text-gray-500 uppercase mb-2">Total</div>
                            <div className="text-3xl font-bold text-gray-900">{totalCustomers.toLocaleString()}</div>
                            <div className="text-xs text-gray-500 mt-1">Customers</div>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6 text-center">
                            <div className="text-sm font-medium text-red-600 uppercase mb-2">🔴 High Risk</div>
                            <div className="text-3xl font-bold text-red-900">{highRisk.toLocaleString()}</div>
                            <div className="text-xs text-red-600 mt-1">
                                ({totalCustomers > 0 ? ((highRisk / totalCustomers) * 100).toFixed(1) : 0}%)
                            </div>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-md p-6 text-center">
                            <div className="text-sm font-medium text-yellow-600 uppercase mb-2">🟡 Medium</div>
                            <div className="text-3xl font-bold text-yellow-900">{mediumRisk.toLocaleString()}</div>
                            <div className="text-xs text-yellow-600 mt-1">
                                ({totalCustomers > 0 ? ((mediumRisk / totalCustomers) * 100).toFixed(1) : 0}%)
                            </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg shadow-md p-6 text-center">
                            <div className="text-sm font-medium text-green-600 uppercase mb-2">🟢 Low</div>
                            <div className="text-3xl font-bold text-green-900">{lowRisk.toLocaleString()}</div>
                            <div className="text-xs text-green-600 mt-1">
                                ({totalCustomers > 0 ? ((lowRisk / totalCustomers) * 100).toFixed(1) : 0}%)
                            </div>
                        </div>
                    </div>

                    {/* Model Performance */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Target className="w-5 h-5 text-blue-600" />
                            Model Performance
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">Algorithm:</span>
                                <div className="font-bold text-gray-900 mt-1">{modelName}</div>
                            </div>
                            <div>
                                <span className="text-gray-600">ROC-AUC:</span>
                                <div className="font-bold text-gray-900 mt-1">
                                    {rocAuc.toFixed(4)} <span className="text-green-600">✅</span>
                                </div>
                            </div>
                            <div>
                                <span className="text-gray-600">Accuracy:</span>
                                <div className="font-bold text-gray-900 mt-1">{(accuracy * 100).toFixed(2)}%</div>
                            </div>
                            <div>
                                <span className="text-gray-600">Features Detected:</span>
                                <div className="font-bold text-gray-900 mt-1">{featureCols.length}</div>
                            </div>
                        </div>
                    </div>

                    {/* Auto-Detected Schema */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Info className="w-5 h-5 text-blue-600" />
                            Auto-Detected Schema
                        </h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-600">• Customer ID:</span>
                                <span className="ml-2 font-medium text-gray-900">{customerIdCol}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">• Target Column:</span>
                                <span className="ml-2 font-medium text-gray-900">{targetCol}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">• Churn Value:</span>
                                <span className="ml-2 font-medium text-gray-900">{churnValue}</span>
                            </div>
                            <div>
                                <span className="text-gray-600">• Features Used:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                    {summary.feature_count !== undefined ? summary.feature_count : featureCols.length} columns
                                </span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-gray-600">• Excluded:</span>
                                <span className="ml-2 font-medium text-gray-900">
                                    {excludedCols.length > 0 ? excludedCols.join(', ') : 'None'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Top 5 Churn Drivers */}
                    {topFeatures.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-yellow-600" />
                                Top 5 Churn Drivers
                            </h3>
                            <div className="space-y-3">
                                {topFeatures.map((item, idx) => {
                                    const importance = typeof item.importance === 'number'
                                        ? item.importance
                                        : parseFloat(item.importance) || 0;

                                    return (
                                        <div key={idx} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-gray-700 w-6">{idx + 1}.</span>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-900">{item.feature}</span>
                                                    <span className="text-sm text-gray-600">{(importance * 100).toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all"
                                                        style={{ width: `${importance * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => navigate('/customers')}
                            className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-md"
                            title="Search customers and predict churn"
                        >
                            <Users className="w-5 h-5" />
                            Explore Customer Intelligence
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/features')}
                            className="px-6 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-md"
                            title="View detailed feature importance analysis"
                        >
                            <Zap className="w-5 h-5" />
                            View Feature Drivers
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/segments')}
                            className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2 shadow-md"
                            title="Explore customer segments and risk distribution"
                        >
                            <PieChart className="w-5 h-5" />
                            See All Segments
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Upload Another File */}
                    <div className="text-center pt-4">
                        <button
                            onClick={handleReset}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                            ← Upload Another Dataset
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadData;
