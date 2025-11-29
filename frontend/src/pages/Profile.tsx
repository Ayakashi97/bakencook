import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

import {
    Loader2, Download, Trash2, LogOut, KeyRound, AlertTriangle,
    Smartphone, Monitor, Globe, Clock, Settings, ShieldAlert, User, List, Copy, RefreshCw,
    CheckCircle, Utensils
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../components/Modal';
import { GlassTabs } from '../components/ui/GlassTabs';

interface UserSession {
    id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    last_used_at: string;
    is_active: boolean;
}

const OverviewTab = ({
    user,
    email,
    setEmail,
    isEditingEmail,
    setIsEditingEmail,
    setShowEmailConfirmModal,
    changePasswordMutation,
    updateSettingsMutation
}: {
    user: any;
    email: string;
    setEmail: (e: string) => void;
    isEditingEmail: boolean;
    setIsEditingEmail: (v: boolean) => void;
    setShowEmailConfirmModal: (v: boolean) => void;
    changePasswordMutation: any;
    updateSettingsMutation: any;
}) => {
    const { t } = useTranslation();

    const [passwords, setPasswords] = useState({ old: '', new: '' });
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Session Duration State
    const [duration, setDuration] = useState(user?.session_duration_minutes || 60);

    // Username State
    const [username, setUsername] = useState(user?.username || '');
    const [isEditingUsername, setIsEditingUsername] = useState(false);

    // Fetch recipe count for stats
    const { data: recipeData } = useQuery({
        queryKey: ['user-stats-recipes'],
        queryFn: async () => {
            const res = await api.get('/recipes', { params: { tab: 'my_recipes', limit: 1 } });
            return res.data;
        }
    });

    const recipeCount = recipeData?.total || 0;

    const handlePasswordChange = () => {
        changePasswordMutation.mutate({ old_password: passwords.old, new_password: passwords.new }, {
            onSuccess: () => {
                setMsg({ type: 'success', text: t('profile.password_success') });
                setPasswords({ old: '', new: '' });
            },
            onError: (err: any) => {
                setMsg({ type: 'error', text: err.response?.data?.detail || t('profile.password_failed') });
            }
        });
    };

    const handleUsernameSave = () => {
        if (username === user?.username) {
            setIsEditingUsername(false);
            return;
        }
        updateSettingsMutation.mutate({
            session_duration_minutes: user?.session_duration_minutes,
            username: username
        }, {
            onSuccess: () => {
                setIsEditingUsername(false);
                toast.success(t('profile.username_updated') || "Username updated");
            },
            onError: () => {
                setUsername(user?.username || ''); // Revert on error
            }
        });
    };

    const handleExport = async () => {
        try {
            const res = await api.get('/users/me/export');
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "export.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        } catch (err) {
            toast.error(t('admin.export_error') || 'Failed to export data');
        }
    };

    // Format Member Since
    const memberSince = user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown';

    return (
        <div className="space-y-6">
            {/* Header Stats Card */}
            <div className="glass-card rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary/20 to-secondary/20" />

                <div className="relative flex flex-col md:flex-row gap-8 items-start mt-4">
                    {/* Avatar & Basic Info */}
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-background border-4 border-background/50 shadow-xl flex items-center justify-center text-primary text-3xl font-bold shrink-0">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{user?.username}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">
                                    {user?.role}
                                </span>
                                {user?.is_active && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400">
                                        <CheckCircle className="w-3 h-3" /> Active
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center">
                            <Utensils className="w-5 h-5 text-orange-500 mb-1" />
                            <span className="text-xl font-bold">{recipeCount}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Recipes</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center gap-1 text-yellow-500 mb-1">
                                <span className="w-5 h-5 flex items-center justify-center">★</span>
                            </div>
                            <span className="text-xl font-bold">{user?.average_rating || '0.0'}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rating</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center">
                            <Clock className="w-5 h-5 text-blue-500 mb-1" />
                            <span className="text-sm font-bold mt-1">{memberSince}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Member Since</span>
                        </div>
                        <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center">
                            <Globe className="w-5 h-5 text-purple-500 mb-1" />
                            <span className="text-sm font-bold mt-1 uppercase">{user?.language || 'EN'}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">Language</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Account Details */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    <h3 className="font-semibold flex items-center gap-2 border-b border-white/10 pb-3">
                        <User className="w-4 h-4" /> Account Details
                    </h3>

                    {/* Username */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                            Username
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:bg-background transition-colors disabled:opacity-50"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={!isEditingUsername}
                            />
                            {!isEditingUsername ? (
                                <button
                                    onClick={() => setIsEditingUsername(true)}
                                    className="px-3 py-1 rounded-md hover:bg-muted transition-colors text-xs border border-white/10"
                                >
                                    {t('common.edit') || "Edit"}
                                </button>
                            ) : (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => {
                                            setUsername(user?.username || '');
                                            setIsEditingUsername(false);
                                        }}
                                        className="px-3 py-1 rounded-md hover:bg-muted transition-colors text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleUsernameSave}
                                        disabled={!username || username === user?.username}
                                        className="bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 text-xs"
                                    >
                                        Save
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
                            {t('profile.email') || "Email Address"}
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm focus:bg-background transition-colors disabled:opacity-50"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={!isEditingEmail}
                            />
                            {!isEditingEmail ? (
                                <button
                                    onClick={() => setIsEditingEmail(true)}
                                    className="px-3 py-1 rounded-md hover:bg-muted transition-colors text-xs border border-white/10"
                                >
                                    {t('common.edit') || "Edit"}
                                </button>
                            ) : (
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => {
                                            setEmail(user?.email || '');
                                            setIsEditingEmail(false);
                                        }}
                                        className="px-3 py-1 rounded-md hover:bg-muted transition-colors text-xs"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={() => setShowEmailConfirmModal(true)}
                                        disabled={!email || email === user?.email}
                                        className="bg-primary text-primary-foreground px-3 py-1 rounded-md hover:bg-primary/90 text-xs"
                                    >
                                        Save
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Password Change */}
                    <div className="pt-4 border-t border-white/10">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                            <KeyRound className="h-3 w-3" /> {t('profile.change_password')}
                        </h4>
                        <form
                            onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}
                            className="space-y-3"
                        >
                            <input type="text" autoComplete="username" className="hidden" />
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder={t('profile.old_password')}
                                    className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs focus:bg-background transition-colors"
                                    value={passwords.old}
                                    onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                />
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder={t('profile.new_password')}
                                    className="flex h-8 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-xs focus:bg-background transition-colors"
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                />
                            </div>
                            {msg && (
                                <div className={`text-xs ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                    {msg.text}
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={changePasswordMutation.isPending || !passwords.old || !passwords.new}
                                className="w-full bg-secondary/50 text-secondary-foreground px-3 py-1.5 rounded-md hover:bg-secondary/70 disabled:opacity-50 text-xs transition-colors"
                            >
                                {changePasswordMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : t('profile.update_password_btn')}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Settings & Export */}
                <div className="space-y-6">
                    {/* Application Settings */}
                    <div className="glass-card rounded-xl p-6">
                        <h3 className="font-semibold flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                            <Settings className="w-4 h-4" /> Application Settings
                        </h3>

                        {/* Session Duration */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <label className="text-sm font-medium">Session Duration</label>
                                <span className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">
                                    {(() => {
                                        if (duration < 60) return `${duration} min`;
                                        if (duration < 1440) {
                                            const h = Math.floor(duration / 60);
                                            const m = duration % 60;
                                            return m > 0 ? `${h}h ${m}m` : `${h}h`;
                                        }
                                        const d = Math.floor(duration / 1440);
                                        const h = Math.floor((duration % 1440) / 60);
                                        return h > 0 ? `${d}d ${h}h` : `${d}d`;
                                    })()}
                                </span>
                            </div>

                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="1"
                                    max="112"
                                    step="1"
                                    value={(() => {
                                        if (duration <= 60) return duration;
                                        if (duration <= 1440) return 60 + Math.round((duration - 60) / 60);
                                        return 83 + Math.round((duration - 1440) / 1440);
                                    })()}
                                    onChange={(e) => {
                                        const s = parseInt(e.target.value);
                                        let val;
                                        if (s <= 60) val = s;
                                        else if (s <= 83) val = 60 + (s - 60) * 60;
                                        else val = 1440 + (s - 83) * 1440;
                                        setDuration(val);
                                    }}
                                    className="flex-1"
                                />
                                <button
                                    onClick={() => updateSettingsMutation.mutate({ session_duration_minutes: duration })}
                                    disabled={updateSettingsMutation.isPending || duration === user?.session_duration_minutes}
                                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md hover:bg-primary/90 disabled:opacity-50 text-xs font-medium transition-colors"
                                >
                                    {updateSettingsMutation.isPending ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-1 px-1">
                                <span>1 min</span>
                                <span>30 days</span>
                            </div>
                        </div>
                    </div>

                    {/* Data Export */}
                    <div className="glass-card rounded-xl p-6 flex flex-col">
                        <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                            <Download className="h-4 w-4" /> {t('profile.export_data')}
                        </h2>
                        <p className="text-xs text-muted-foreground mb-4 flex-1">
                            {t('profile.export_desc')}
                        </p>
                        <button
                            onClick={handleExport}
                            className="w-full border px-4 py-2 rounded-md hover:bg-accent/50 flex items-center justify-center gap-2 bg-background/30 transition-colors text-sm"
                        >
                            <Download className="h-3 w-3" /> {t('profile.export_btn')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function Profile() {
    const { user, logout } = useAuth();

    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'danger' | 'api'>('overview');

    // --- Queries ---
    const { data: sessions, isLoading: isLoadingSessions } = useQuery({
        queryKey: ['sessions'],
        queryFn: async () => {
            const res = await api.get<UserSession[]>('/users/me/sessions');
            return res.data;
        },
        enabled: activeTab === 'sessions'
    });

    // --- Mutations ---
    const changePasswordMutation = useMutation({
        mutationFn: (data: any) => api.post('/auth/change-password', data),
    });

    const updateSettingsMutation = useMutation({
        mutationFn: (data: any) => api.put('/users/me/settings', data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['user'] });

            // If verification is pending, show verification modal
            if (data.data.verification_pending) {
                setShowVerificationModal(true);
            } else {
            }
        },
        onError: (err: any) => {
            console.error("Settings update failed:", err);
            const msg = err.response?.data?.detail || err.message || "Failed to update settings";
            toast.error(`${t('profile.settings.update_error') || "Failed to update settings"}: ${msg}`);
        }
    });

    const confirmEmailChangeMutation = useMutation({
        mutationFn: (data: { code: string, email: string }) => api.post('/users/me/email/confirm', data),
        onSuccess: () => {
            toast.success(t('auth.verification_success') || 'Email verified successfully!');
            queryClient.invalidateQueries({ queryKey: ['user'] });
            setShowVerificationModal(false);
            setIsEditingEmail(false);
            setShowEmailConfirmModal(false);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Verification failed');
        }
    });

    const revokeSessionMutation = useMutation({
        mutationFn: (sessionId: string) => api.delete(`/users/me/sessions/${sessionId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sessions'] });
        }
    });

    const revokeAllSessionsMutation = useMutation({
        mutationFn: () => api.post('/auth/revoke-sessions'),
        onSuccess: () => {
            logout();
        }
    });

    const deleteAccountMutation = useMutation({
        mutationFn: (password: string) => api.delete('/users/me', { data: { password } }),
        onSuccess: () => {
            logout();
        }
    });

    // --- Modals State ---
    const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);

    const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);

    // Email state lifted from OverviewTab
    const [email, setEmail] = useState(user?.email || '');
    const [isEditingEmail, setIsEditingEmail] = useState(false);

    // --- Tabs Components ---

    // OverviewTab extracted to outer component



    const SessionsTab = ({
        sessions,
        isLoadingSessions,
        setRevokeSessionId
    }: {
        sessions: UserSession[] | undefined;
        isLoadingSessions: boolean;
        setRevokeSessionId: (id: string) => void;
    }) => {
        const { t } = useTranslation();
        if (isLoadingSessions) return <div>{t('common.loading')}</div>;

        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Monitor className="h-5 w-5" /> {t('profile.sessions.active')}
                    </h2>
                    <div className="space-y-4">
                        {sessions?.map((session) => (
                            <div key={session.id} className="flex items-center justify-between p-4 border border-white/10 rounded-lg bg-white/5">
                                <div className="flex items-start gap-3">
                                    <div className="mt-1">
                                        {session.user_agent?.toLowerCase().includes('mobile') ?
                                            <Smartphone className="h-5 w-5 text-muted-foreground" /> :
                                            <Monitor className="h-5 w-5 text-muted-foreground" />
                                        }
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">{session.user_agent || 'Unknown Device'}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                            <Globe className="h-3 w-3" /> {session.ip_address || 'Unknown IP'}
                                            <span className="mx-1">•</span>
                                            <Clock className="h-3 w-3" /> {new Date(session.last_used_at).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setRevokeSessionId(session.id)}
                                    className="text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors"
                                    title={t('profile.sessions.revoke')}
                                >
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                        {sessions?.length === 0 && (
                            <p className="text-muted-foreground text-sm">No active sessions found.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const DangerTab = ({
        setShowRevokeAllModal,
        setShowDeleteAccountModal
    }: {
        setShowRevokeAllModal: (v: boolean) => void;
        setShowDeleteAccountModal: (v: boolean) => void;
    }) => {
        const { t } = useTranslation();
        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl p-6 border-orange-200/50 bg-orange-50/50 dark:bg-orange-950/20 dark:border-orange-900/50">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-orange-700 dark:text-orange-400">
                        <ShieldAlert className="h-5 w-5" /> {t('profile.revoke_sessions')}
                    </h2>
                    <p className="text-sm text-orange-600/80 dark:text-orange-400/80 mb-4">
                        {t('profile.revoke_desc')}
                    </p>
                    <button
                        onClick={() => setShowRevokeAllModal(true)}
                        className="text-orange-600 border-orange-200 border px-4 py-2 rounded-md hover:bg-orange-100/50 dark:hover:bg-orange-900/40 flex items-center gap-2 transition-colors"
                    >
                        <LogOut className="h-4 w-4" /> {t('profile.revoke_btn')}
                    </button>
                </div>

                <div className="glass-card rounded-xl p-6 border-red-200/50 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-red-700 dark:text-red-400">
                        <Trash2 className="h-5 w-5" /> {t('profile.delete_account')}
                    </h2>
                    <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
                        {t('profile.delete_desc')}
                    </p>
                    <button
                        onClick={() => setShowDeleteAccountModal(true)}
                        className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center gap-2 shadow-sm transition-colors"
                    >
                        <Trash2 className="h-4 w-4" /> {t('profile.delete_btn')}
                    </button>
                </div>
            </div>
        );
    };

    const ApiTab = () => {
        //const { t } = useTranslation();
        const { data: apiStatus, isLoading: isLoadingKey, refetch } = useQuery({
            queryKey: ['api-key'],
            queryFn: async () => {
                const res = await api.get<{ has_api_key: boolean }>('/users/me/api-key');
                return res.data;
            }
        });

        const [generatedKey, setGeneratedKey] = useState<string | null>(null);
        const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

        const generateKeyMutation = useMutation({
            mutationFn: async () => {
                const res = await api.post<{ api_key: string }>('/users/me/api-key');
                return res.data;
            },
            onSuccess: (data) => {
                setGeneratedKey(data.api_key);
                toast.success("API Key generated");
                refetch();
            }
        });

        const copyToClipboard = (text: string) => {
            navigator.clipboard.writeText(text);
            toast.success("Copied to clipboard");
        };

        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <KeyRound className="h-5 w-5" /> API Access
                    </h2>
                    <p className="text-sm text-muted-foreground mb-6">
                        Use this API Key to authenticate automated requests (e.g., from iOS Shortcuts).
                        Include it in the <code>X-API-Key</code> header along with Basic Auth (Username/Password).
                    </p>

                    {isLoadingKey ? (
                        <div>Loading...</div>
                    ) : (
                        <div className="space-y-6">

                            {/* Status Display */}
                            <div className="flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10">
                                <div className={`w-3 h-3 rounded-full ${apiStatus?.has_api_key ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                                <div>
                                    <p className="font-medium text-sm">
                                        {apiStatus?.has_api_key ? "API Key Active" : "No API Key Active"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {apiStatus?.has_api_key ? "Your account is ready for automation." : "Generate a key to start using automation."}
                                    </p>
                                </div>
                            </div>

                            {/* Generated Key Display (Only shown once) */}
                            {generatedKey && (
                                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 space-y-3">
                                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-medium text-sm">
                                        <AlertTriangle className="h-4 w-4" />
                                        Save this key now! It will not be shown again.
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-background/50 p-3 rounded-md font-mono text-sm break-all border border-white/10">
                                            {generatedKey}
                                        </div>
                                        <button
                                            onClick={() => copyToClipboard(generatedKey)}
                                            className="p-3 rounded-md hover:bg-muted transition-colors border border-white/10"
                                            title="Copy"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    onClick={() => {
                                        if (apiStatus?.has_api_key) {
                                            setShowRegenerateConfirm(true);
                                        } else {
                                            generateKeyMutation.mutate();
                                        }
                                    }}
                                    disabled={generateKeyMutation.isPending}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                >
                                    {generateKeyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    {apiStatus?.has_api_key ? "Regenerate API Key" : "Generate API Key"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {showRegenerateConfirm && (
                    <Modal title={t('profile.api.regenerate_confirm_title')} onClose={() => setShowRegenerateConfirm(false)}>
                        <p className="mb-6 text-muted-foreground">
                            {t('profile.api.regenerate_confirm_desc')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowRegenerateConfirm(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('profile.modal.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    generateKeyMutation.mutate();
                                    setShowRegenerateConfirm(false);
                                }}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                            >
                                {t('profile.modal.confirm')}
                            </button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    };


    return (
        <div className="w-full space-y-6">
            {/* Hidden Header as requested */}
            {/* <PageHeader title={t('profile.title')} /> */}

            <div className="flex flex-col gap-6">
                {/* Top Tabs Navigation */}
                <div className="w-full overflow-x-auto">
                    <GlassTabs
                        activeTab={activeTab}
                        onChange={(id) => setActiveTab(id as any)}
                        tabs={[
                            { id: 'overview', label: t('profile.tabs.overview'), icon: User },
                            { id: 'sessions', label: t('profile.tabs.sessions'), icon: List },
                            { id: 'api', label: "API Access", icon: KeyRound },
                            { id: 'danger', label: t('profile.tabs.danger'), icon: AlertTriangle },
                        ]}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'overview' && <OverviewTab
                        user={user}
                        email={email}
                        setEmail={setEmail}
                        isEditingEmail={isEditingEmail}
                        setIsEditingEmail={setIsEditingEmail}
                        setShowEmailConfirmModal={setShowEmailConfirmModal}
                        changePasswordMutation={changePasswordMutation}
                        updateSettingsMutation={updateSettingsMutation}
                    />}
                    {activeTab === 'sessions' && <SessionsTab sessions={sessions} isLoadingSessions={isLoadingSessions} setRevokeSessionId={setRevokeSessionId} />}
                    {activeTab === 'api' && <ApiTab />}
                    {activeTab === 'danger' && <DangerTab setShowRevokeAllModal={setShowRevokeAllModal} setShowDeleteAccountModal={setShowDeleteAccountModal} />}
                </div>
            </div>

            {/* Modals */}
            {
                revokeSessionId && (
                    <Modal title={t('profile.modal.revoke_title')} onClose={() => setRevokeSessionId(null)}>
                        <p className="mb-6 text-muted-foreground">{t('profile.modal.revoke_confirm')}</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setRevokeSessionId(null)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('profile.modal.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    revokeSessionMutation.mutate(revokeSessionId);
                                    setRevokeSessionId(null);
                                }}
                                className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90"
                            >
                                {t('profile.modal.revoke')}
                            </button>
                        </div>
                    </Modal>
                )
            }

            {
                showRevokeAllModal && (
                    <Modal title={t('profile.modal.revoke_all_title')} onClose={() => setShowRevokeAllModal(false)}>
                        <p className="mb-6 text-muted-foreground">{t('profile.modal.revoke_all_confirm')}</p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowRevokeAllModal(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('profile.modal.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    revokeAllSessionsMutation.mutate();
                                    setShowRevokeAllModal(false);
                                }}
                                className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90"
                            >
                                {t('profile.modal.revoke_all')}
                            </button>
                        </div>
                    </Modal>
                )
            }

            {
                showDeleteAccountModal && (
                    <Modal title={t('profile.modal.delete_title')} onClose={() => setShowDeleteAccountModal(false)}>
                        <p className="mb-4 text-muted-foreground">
                            {t('profile.modal.delete_desc')}
                        </p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            deleteAccountMutation.mutate(formData.get('password') as string);
                        }}>
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder={t('profile.modal.delete_confirm')}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-6"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteAccountModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted"
                                >
                                    {t('profile.modal.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={deleteAccountMutation.isPending}
                                    className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 flex items-center gap-2"
                                >
                                    {deleteAccountMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t('profile.modal.delete')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )
            }

            {
                showEmailConfirmModal && (
                    <Modal title={t('profile.email_confirm_title') || "Confirm Email Change"} onClose={() => setShowEmailConfirmModal(false)}>
                        <p className="mb-4 text-muted-foreground">
                            {t('profile.email_confirm_desc') || "Please enter your password to confirm the email change."}
                        </p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            updateSettingsMutation.mutate({
                                session_duration_minutes: user?.session_duration_minutes || 60,
                                email: email,
                                password: formData.get('password') as string
                            }, {
                                onSuccess: (data) => {
                                    // If verification pending, keep modal open or switch to verification modal?
                                    // The mutation onSuccess handles opening verification modal.
                                    // But we need to close this one ONLY if NO verification pending.
                                    if (!data.data.verification_pending) {
                                        setShowEmailConfirmModal(false);
                                        setIsEditingEmail(false);
                                    } else {
                                        setShowEmailConfirmModal(false); // Close password modal, open verification modal
                                    }
                                }
                            });
                        }}>
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder={t('common.password') || "Password"}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-6"
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEmailConfirmModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={updateSettingsMutation.isPending}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
                                >
                                    {updateSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t('common.confirm') || "Confirm"}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )
            }

            {
                showVerificationModal && (
                    <Modal title={t('auth.verify_email') || "Verify Email"} onClose={() => setShowVerificationModal(false)}>
                        <p className="mb-4 text-muted-foreground">
                            {t('auth.enter_code_desc') || "Please enter the 6-digit code sent to your new email address."}
                        </p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            confirmEmailChangeMutation.mutate({
                                code: formData.get('code') as string,
                                email: email
                            });
                        }}>
                            <input
                                name="code"
                                type="text"
                                required
                                placeholder="123456"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-6 font-mono text-center tracking-widest text-lg"
                                maxLength={6}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowVerificationModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={confirmEmailChangeMutation.isPending}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
                                >
                                    {confirmEmailChangeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {t('auth.verify_btn') || "Verify"}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )
            }
        </div>
    );
}
