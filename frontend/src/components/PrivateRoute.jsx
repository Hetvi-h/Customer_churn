import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingPage } from './Common';

export default function PrivateRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();
    if (loading) return <LoadingPage />;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}
