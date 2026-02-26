import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import { AuthProvider } from './contexts/AuthContext';
import { UploadProvider } from './contexts/UploadContext';

// Auth pages (no Layout wrapper)
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOTP from './pages/VerifyOTP';
import Profile from './pages/Profile';

// Dashboard pages (protected by PrivateRoute, wrapped in Layout)
import Home from './pages/Home';
import CustomerIntelligence from './pages/CustomerIntelligence';
import Segments from './pages/Segments';
import Trends from './pages/Trends';
import FeatureDrivers from './pages/FeatureDrivers';
import ModelMetrics from './pages/ModelMetrics';
import UploadData from './pages/UploadData';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <BrowserRouter>
          <UploadProvider>
            <Routes>
              {/* Public auth routes — no sidebar/header */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOTP />} />

              {/* Protected dashboard routes — wrapped in Layout */}
              <Route path="/" element={
                <PrivateRoute>
                  <Layout><Home /></Layout>
                </PrivateRoute>
              } />
              <Route path="/upload" element={
                <PrivateRoute>
                  <Layout><UploadData /></Layout>
                </PrivateRoute>
              } />
              <Route path="/customers" element={
                <PrivateRoute>
                  <Layout><CustomerIntelligence /></Layout>
                </PrivateRoute>
              } />
              <Route path="/segments" element={
                <PrivateRoute>
                  <Layout><Segments /></Layout>
                </PrivateRoute>
              } />
              <Route path="/trends" element={
                <PrivateRoute>
                  <Layout><Trends /></Layout>
                </PrivateRoute>
              } />
              <Route path="/features" element={
                <PrivateRoute>
                  <Layout><FeatureDrivers /></Layout>
                </PrivateRoute>
              } />
              <Route path="/model-metrics" element={
                <PrivateRoute>
                  <Layout><ModelMetrics /></Layout>
                </PrivateRoute>
              } />
              <Route path="/profile" element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </UploadProvider>
        </BrowserRouter>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
