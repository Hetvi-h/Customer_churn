import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    ArrowLeft, User, Mail, Lock, Shield, Calendar,
    Check, AlertCircle, Eye, EyeOff, Loader2, Chrome
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function SectionCard({ title, icon: Icon, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Icon className="w-4 h-4 text-indigo-600" />
                </div>
                <h2 className="font-semibold text-gray-800">{title}</h2>
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
}

function Toast({ message, type }) {
    if (!message) return null;
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
      ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
            {type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message}
        </div>
    );
}

export default function Profile() {
    const navigate = useNavigate();
    const { user, token, saveAuth } = useAuth();

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState({ message: '', type: 'success' });

    // Name edit
    const [name, setName] = useState('');
    const [savingName, setSavingName] = useState(false);

    // Password change
    const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' });
    const [showPw, setShowPw] = useState({ current: false, new: false });
    const [savingPw, setSavingPw] = useState(false);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast({ message: '', type: 'success' }), 3500);
    };

    const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`${API}/profile`, { headers: authHeaders });
                if (!res.ok) throw new Error();
                const data = await res.json();
                setProfile(data);
                setName(data.name || '');
            } catch {
                showToast('Could not load profile', 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleSaveName = async () => {
        if (!name.trim()) return;
        setSavingName(true);
        try {
            const res = await fetch(`${API}/profile`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ name: name.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            // Update auth context so header also updates
            saveAuth({ ...user, name: data.name }, token);
            showToast('Name updated!');
        } catch (e) {
            showToast(e.message || 'Failed to update name', 'error');
        } finally {
            setSavingName(false);
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (pwForm.new !== pwForm.confirm) {
            showToast("New passwords don't match", 'error'); return;
        }
        if (pwForm.new.length < 8) {
            showToast('Password must be at least 8 characters', 'error'); return;
        }
        setSavingPw(true);
        try {
            const res = await fetch(`${API}/profile/change-password`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ current_password: pwForm.current, new_password: pwForm.new }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            setPwForm({ current: '', new: '', confirm: '' });
            showToast('Password changed!');
        } catch (e) {
            showToast(e.message || 'Failed to change password', 'error');
        } finally {
            setSavingPw(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Toast message={toast.message} type={toast.type} />

            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-gray-600" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-800">Account Settings</h1>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* Avatar + name banner */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 flex items-center gap-5 text-white shadow-lg">
                    <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-4xl font-bold backdrop-blur">
                        {name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{name || 'Your Name'}</h2>
                        <p className="text-indigo-200 text-sm mt-0.5">{profile?.email}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                            {profile?.google_id ? (
                                <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2.5 py-0.5">
                                    <Chrome className="w-3 h-3" /> Google account
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2.5 py-0.5">
                                    <Mail className="w-3 h-3" /> Email account
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Identity */}
                <SectionCard title="Profile Information" icon={User}>
                    <div className="space-y-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Display name</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="flex-1 border border-gray-300 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                                    placeholder="Your name"
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={savingName || name === profile?.name}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition flex items-center gap-1.5"
                                >
                                    {savingName ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    Save
                                </button>
                            </div>
                        </div>
                        {/* Email (read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                            <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-xl px-3.5 py-2 text-sm text-gray-500">
                                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                {profile?.email}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Email cannot be changed as it is your login identifier.</p>
                        </div>
                    </div>
                </SectionCard>

                {/* Security */}
                <SectionCard title="Security" icon={Shield}>
                    {profile?.google_id && !profile?.has_password ? (
                        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                            <Chrome className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-blue-800">Signed in with Google</p>
                                <p className="text-xs text-blue-600 mt-0.5">Your account uses Google OAuth — no password is needed to sign in.</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <p className="text-sm text-gray-500">Choose a strong password with at least 8 characters.</p>
                            {[
                                { key: 'current', label: 'Current password', show: showPw.current, toggle: () => setShowPw(p => ({ ...p, current: !p.current })) },
                                { key: 'new', label: 'New password', show: showPw.new, toggle: () => setShowPw(p => ({ ...p, new: !p.new })) },
                                { key: 'confirm', label: 'Confirm new password', show: false, toggle: null },
                            ].map(({ key, label, show, toggle }) => (
                                <div key={key}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input
                                            type={show ? 'text' : 'password'}
                                            required
                                            value={pwForm[key]}
                                            onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                                            className="w-full border border-gray-300 rounded-xl pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                                            placeholder="••••••••"
                                        />
                                        {toggle && (
                                            <button type="button" onClick={toggle}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button
                                type="submit"
                                disabled={savingPw}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-medium transition flex items-center justify-center gap-2"
                            >
                                {savingPw && <Loader2 className="w-4 h-4 animate-spin" />}
                                Update password
                            </button>
                        </form>
                    )}
                </SectionCard>

                {/* Account info */}
                <SectionCard title="Account Information" icon={Calendar}>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-500">Member since</span>
                            <span className="text-sm font-medium text-gray-800">
                                {profile?.created_at
                                    ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                                    : '—'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <span className="text-sm text-gray-500">Account type</span>
                            <span className="text-sm font-medium text-gray-800">
                                {profile?.google_id ? 'Google OAuth' : 'Email & Password'}
                            </span>
                        </div>
                    </div>
                </SectionCard>

            </div>
        </div>
    );
}
