import React from 'react';
import { Link } from 'react-router-dom';
import { Upload, Zap, Brain, PieChart, TrendingUp, Target, ArrowRight, CheckCircle } from 'lucide-react';

/**
 * Home/Landing Page
 * 
 * Marketing page shown at localhost:5173/
 * Explains the product and directs users to upload data
 */
const Home = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                    <div className="text-center">
                        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                            Predict Customer Churn
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                                in 5 Minutes
                            </span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                            Upload any customer CSV → Get instant AI-powered churn predictions for any industry
                        </p>
                        <Link
                            to="/upload"
                            className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                        >
                            <Upload className="w-6 h-6 mr-2" />
                            Upload Your Data
                            <ArrowRight className="w-6 h-6 ml-2" />
                        </Link>
                        <p className="text-sm text-gray-400 mt-4">
                            No configuration needed • Works with any industry • Free to use
                        </p>
                    </div>
                </div>

                {/* Decorative gradient orbs */}
                <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
            </div>

            {/* How It Works Section */}
            <div className="bg-gray-900 py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-white text-center mb-16">
                        How It Works
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Step 1 */}
                        <div className="relative">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700 hover:border-blue-500 transition-all">
                                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-6">
                                    <Upload className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    1
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-4">Upload Your CSV</h3>
                                <p className="text-gray-400">
                                    Works with any industry - telecom, banking, SaaS, retail, insurance. Just upload your customer data.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="relative">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700 hover:border-purple-500 transition-all">
                                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mb-6">
                                    <Zap className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    2
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-4">AI Auto-Detects</h3>
                                <p className="text-gray-400">
                                    Our AI automatically detects your data structure, features, and patterns. No configuration needed.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="relative">
                            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-8 border border-gray-700 hover:border-green-500 transition-all">
                                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mb-6">
                                    <Target className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -top-4 -left-4 w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    3
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-4">Get Predictions</h3>
                                <p className="text-gray-400">
                                    Instant churn predictions, SHAP explanations, customer segments, and actionable insights.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <div className="bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h2 className="text-4xl font-bold text-white text-center mb-4">
                        Powerful Features
                    </h2>
                    <p className="text-xl text-gray-300 text-center mb-16">
                        Everything you need to understand and prevent customer churn
                    </p>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500 transition-all">
                            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Industry Agnostic</h3>
                            <p className="text-gray-400">
                                Works for telecom, banking, SaaS, retail, insurance - any industry with customer data.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500 transition-all">
                            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center mb-4">
                                <Brain className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Auto Schema Detection</h3>
                            <p className="text-gray-400">
                                No configuration needed. Upload your CSV and we automatically detect features and data types.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all">
                            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center mb-4">
                                <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">SHAP Explanations</h3>
                            <p className="text-gray-400">
                                Understand WHY customers churn with AI-powered explanations for every prediction.
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-yellow-500 transition-all">
                            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center mb-4">
                                <PieChart className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Dynamic Segments</h3>
                            <p className="text-gray-400">
                                Auto-generated customer segments based on churn risk and behavior patterns.
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-all">
                            <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center mb-4">
                                <Target className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Live Predictions</h3>
                            <p className="text-gray-400">
                                Test individual customer profiles with real-time churn probability predictions.
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-indigo-500 transition-all">
                            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center mb-4">
                                <CheckCircle className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Code Required</h3>
                            <p className="text-gray-400">
                                Simple drag-and-drop interface. No technical knowledge or coding required.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-gray-900 py-20">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <h2 className="text-4xl font-bold text-white mb-6">
                        Ready to Predict Churn?
                    </h2>
                    <p className="text-xl text-gray-300 mb-8">
                        Upload your customer data and get instant AI-powered insights
                    </p>
                    <Link
                        to="/upload"
                        className="inline-flex items-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 shadow-lg"
                    >
                        <Upload className="w-6 h-6 mr-2" />
                        Get Started Now
                        <ArrowRight className="w-6 h-6 ml-2" />
                    </Link>
                </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-950 py-8 border-t border-gray-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500">
                    <p>© 2026 Churn Prediction System • Built with AI • Industry Agnostic</p>
                </div>
            </div>
        </div>
    );
};

export default Home;
