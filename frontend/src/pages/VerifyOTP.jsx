import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Mail, RefreshCw, Sparkles, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function VerifyOTP() {
    const navigate = useNavigate();
    const location = useLocation();
    const { saveAuth } = useAuth();
    const email = location.state?.email || '';
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const inputs = useRef([]);

    // Redirect if arrived without email context
    useEffect(() => {
        if (!email) navigate('/login', { replace: true });
    }, [email, navigate]);

    // Countdown timer for resend
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(t);
    }, [countdown]);

    const handleChange = (idx, val) => {
        if (!/^\d?$/.test(val)) return;
        const next = [...digits];
        next[idx] = val;
        setDigits(next);
        if (val && idx < 5) inputs.current[idx + 1]?.focus();
        // Auto-submit when all 6 filled
        if (val && next.every(d => d !== '')) {
            submitCode(next.join(''));
        }
    };

    const handleKeyDown = (idx, e) => {
        if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
            inputs.current[idx - 1]?.focus();
        }
    };

    const handlePaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setDigits(pasted.split(''));
            submitCode(pasted);
        }
    };

    const submitCode = async (code) => {
        setError(''); setLoading(true);
        try {
            const res = await fetch(`${API}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Invalid code');
            setSuccess(true);
            saveAuth(data.user, data.access_token);
            setTimeout(() => navigate('/', { replace: true }), 1200);
        } catch (err) {
            setError(err.message);
            setDigits(['', '', '', '', '', '']);
            inputs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setResending(true); setError('');
        try {
            // Use login endpoint to re-trigger OTP (works for both email/password and Google users)
            await fetch(`${API}/auth/resend-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            setCountdown(60);
        } catch (_) { }
        setResending(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 flex items-center justify-center px-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
            </div>

            <div className="relative w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600/20 border border-indigo-500/30 rounded-2xl mb-4 backdrop-blur">
                        {success ? <CheckCircle className="w-8 h-8 text-green-400" /> : <Sparkles className="w-8 h-8 text-indigo-400" />}
                    </div>
                    <h1 className="text-3xl font-bold text-white">Attrinex</h1>
                    <p className="text-slate-400 mt-1">Customer Intelligence Platform</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                    {success ? (
                        <div className="text-center py-4">
                            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                            <h2 className="text-xl font-semibold text-white">Verified!</h2>
                            <p className="text-slate-400 text-sm mt-1">Redirecting to your dashboard…</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
                                    <Mail className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Check your email</h2>
                                </div>
                            </div>
                            <p className="text-slate-400 text-sm mb-6">
                                We sent a 6-digit code to <span className="text-white font-medium">{email}</span>
                            </p>

                            {error && (
                                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* OTP boxes */}
                            <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
                                {digits.map((d, i) => (
                                    <input
                                        key={i}
                                        ref={el => inputs.current[i] = el}
                                        type="text" inputMode="numeric" maxLength={1}
                                        value={d}
                                        onChange={e => handleChange(i, e.target.value)}
                                        onKeyDown={e => handleKeyDown(i, e)}
                                        autoFocus={i === 0}
                                        className={`w-12 h-14 text-center text-xl font-bold rounded-xl border bg-slate-800/60 text-white
                      focus:outline-none transition-all duration-200
                      ${d ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700'}
                      ${loading ? 'opacity-50' : ''}
                    `}
                                        disabled={loading}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={() => submitCode(digits.join(''))}
                                disabled={loading || digits.some(d => d === '')}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium rounded-xl py-2.5 text-sm transition-all duration-200"
                            >
                                {loading ? 'Verifying…' : 'Verify code →'}
                            </button>

                            <div className="mt-4 text-center">
                                {countdown > 0 ? (
                                    <p className="text-sm text-slate-500">
                                        Resend code in <span className="text-slate-300">{countdown}s</span>
                                    </p>
                                ) : (
                                    <button
                                        onClick={handleResend} disabled={resending}
                                        className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 mx-auto disabled:opacity-60"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                                        {resending ? 'Sending…' : 'Resend code'}
                                    </button>
                                )}
                            </div>

                            <p className="text-center text-sm text-slate-500 mt-4">
                                <Link to="/login" className="text-indigo-400 hover:text-indigo-300">
                                    ← Back to login
                                </Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
