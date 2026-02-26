import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, Mail, Lock, User, Sparkles } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default function Register() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password !== form.confirm) {
            setError("Passwords don't match."); return;
        }
        if (form.password.length < 8) {
            setError("Password must be at least 8 characters."); return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Registration failed');
            navigate('/verify-otp', { state: { email: data.email } });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async (credentialResponse) => {
        setError(''); setLoading(true);
        try {
            const res = await fetch(`${API}/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: credentialResponse.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Google registration failed');
            navigate('/verify-otp', { state: { email: data.email } });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
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
                        <Sparkles className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Attrinex</h1>
                    <p className="text-slate-400 mt-1">Customer Intelligence Platform</p>
                </div>

                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
                    <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Full name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text" required
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="Hetvi Shah"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Email address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email" required
                                    value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="you@example.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type={showPw ? 'text' : 'password'} required
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="Min. 8 characters"
                                />
                                <button type="button" onClick={() => setShowPw(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm text-slate-400 mb-1.5">Confirm password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password" required
                                    value={form.confirm}
                                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                                    className="w-full bg-slate-800/60 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium rounded-xl py-2.5 text-sm transition-all duration-200 mt-2"
                        >
                            {loading ? 'Creating account…' : 'Create account →'}
                        </button>
                    </form>

                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-slate-700" />
                        <span className="text-xs text-slate-500">or continue with</span>
                        <div className="flex-1 h-px bg-slate-700" />
                    </div>

                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogle}
                            onError={() => setError('Google sign-up failed')}
                            theme="filled_black"
                            shape="rectangular"
                            size="large"
                            text="signup_with"
                        />
                    </div>

                    <p className="text-center text-sm text-slate-500 mt-6">
                        Already have an account?{' '}
                        <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
