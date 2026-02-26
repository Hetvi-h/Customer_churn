import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('attrinex_auth');
        if (stored) {
            try {
                const { user: u, token: t } = JSON.parse(stored);
                setUser(u);
                setToken(t);
            } catch (_) { }
        }
        setLoading(false);
    }, []);

    const saveAuth = (userData, accessToken) => {
        setUser(userData);
        setToken(accessToken);
        localStorage.setItem('attrinex_auth', JSON.stringify({ user: userData, token: accessToken }));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('attrinex_auth');
        // Fail-safe: clear upload data from localStorage on any logout
        localStorage.removeItem('hasUploadedData');
        localStorage.removeItem('uploadResults');
        localStorage.removeItem('churn_upload_state');
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, saveAuth, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
