import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

import {
    Loader2, Download, Trash2, LogOut, KeyRound, AlertTriangle,
    Smartphone, Monitor, Globe, Clock, Settings, ShieldAlert, User, List, Copy, RefreshCw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/Modal';

interface UserSession {
    id: string;
    ip_address: string;
    user_agent: string;
    created_at: string;
    last_used_at: string;
    is_active: boolean;
}

export default function Profile() {
    const { user, logout } = useAuth();

    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'overview' | 'sessions' | 'settings' | 'danger' | 'api'>('overview');

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
        mutationFn: (data: { session_duration_minutes: number, email?: string }) => api.put('/users/me/settings', data),
        onSuccess: () => {
            toast.success(t('profile.settings.saved') || 'Settings saved');
            queryClient.invalidateQueries({ queryKey: ['user'] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to update settings');
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

    // --- Tabs Components ---

    const OverviewTab = () => {
        const [passwords, setPasswords] = useState({ old: '', new: '' });
        const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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

        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <User className="h-5 w-5" /> {t('profile.user_info')}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="font-medium text-lg">{user?.username}</p>
                            <p className="text-muted-foreground">{user?.email}</p>
                            <p className="text-muted-foreground capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>

                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <KeyRound className="h-5 w-5" /> {t('profile.change_password')}
                    </h2>
                    <form
                        onSubmit={(e) => { e.preventDefault(); handlePasswordChange(); }}
                        className="space-y-4 max-w-md"
                    >
                        <input type="text" autoComplete="username" className="hidden" />
                        <input
                            type="password"
                            autoComplete="current-password"
                            placeholder={t('profile.old_password')}
                            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:bg-background transition-colors"
                            value={passwords.old}
                            onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                        />
                        <input
                            type="password"
                            autoComplete="new-password"
                            placeholder={t('profile.new_password')}
                            className="flex h-10 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm focus:bg-background transition-colors"
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                        />
                        {msg && (
                            <div className={`text-sm ${msg.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                                {msg.text}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={changePasswordMutation.isPending || !passwords.old || !passwords.new}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {changePasswordMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t('profile.update_password_btn')}
                        </button>
                    </form>
                </div>

                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Download className="h-5 w-5" /> {t('profile.export_data')}
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">{t('profile.export_desc')}</p>
                    <button onClick={handleExport} className="border px-4 py-2 rounded-md hover:bg-accent/50 flex items-center gap-2 bg-background/30 transition-colors">
                        <Download className="h-4 w-4" /> {t('profile.export_btn')}
                    </button>
                </div>
            </div>
        );
    };

    const SessionsTab = () => {
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

    const SettingsTab = () => {
        const [duration, setDuration] = useState(user?.session_duration_minutes || 60);
        const [email, setEmail] = useState(user?.email || '');
        const [showSettingsConfirmModal, setShowSettingsConfirmModal] = useState(false);
        const [pendingDuration, setPendingDuration] = useState(60);

        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Settings className="h-5 w-5" /> {t('profile.tabs.settings')}
                    </h2>
                    <div className="max-w-md space-y-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('profile.email') || "Email"}
                            </label>
                            <input
                                type="email"
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="user@example.com"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">
                                {t('profile.settings.session_duration')}
                            </label>
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
                                <span className="w-24 text-right font-mono text-sm">
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
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>1 min</span>
                                <span>30 days</span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setPendingDuration(duration);
                                setShowSettingsConfirmModal(true);
                            }}
                            disabled={updateSettingsMutation.isPending}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                        >
                            {updateSettingsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t('profile.settings.update')}
                        </button>
                    </div>
                </div>

                {showSettingsConfirmModal && (
                    <Modal title={t('profile.settings.confirm_title') || "Confirm Settings Update"} onClose={() => setShowSettingsConfirmModal(false)}>
                        <p className="mb-6 text-muted-foreground">
                            {t('profile.settings.confirm_desc') || "Are you sure you want to update your session duration? This will apply to new sessions."}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettingsConfirmModal(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('profile.modal.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    updateSettingsMutation.mutate({
                                        session_duration_minutes: pendingDuration,
                                        email: email !== user?.email ? email : undefined
                                    });
                                    setShowSettingsConfirmModal(false);
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

    const DangerTab = () => {
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
        const { data: apiStatus, isLoading: isLoadingKey, refetch } = useQuery({
            queryKey: ['api-key'],
            queryFn: async () => {
                const res = await api.get<{ has_api_key: boolean }>('/users/me/api-key');
                return res.data;
            }
        });

        const [generatedKey, setGeneratedKey] = useState<string | null>(null);

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
                                            if (confirm("Regenerating will invalidate your existing API Key immediately. Continue?")) {
                                                generateKeyMutation.mutate();
                                            }
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
            </div>
        );
    };


    return (
        <div className="w-full space-y-8">
            <PageHeader
                title={t('profile.title')}
            />

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full lg:w-64 shrink-0">
                    <nav className="flex flex-col gap-2 glass-panel p-4 rounded-xl">
                        {[
                            { id: 'overview', label: t('profile.tabs.overview'), icon: User },
                            { id: 'sessions', label: t('profile.tabs.sessions'), icon: List },
                            { id: 'api', label: "API Access", icon: KeyRound },
                            { id: 'settings', label: t('profile.tabs.settings'), icon: Settings },
                            { id: 'danger', label: t('profile.tabs.danger'), icon: AlertTriangle },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id as any)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all text-left",
                                    activeTab === item.id
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'overview' && <OverviewTab />}
                    {activeTab === 'sessions' && <SessionsTab />}
                    {activeTab === 'settings' && <SettingsTab />}
                    {activeTab === 'api' && <ApiTab />}
                    {activeTab === 'danger' && <DangerTab />}
                </div>
            </div>

            {/* Modals */}
            {revokeSessionId && (
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
                            {t('profile.modal.confirm')}
                        </button>
                    </div>
                </Modal>
            )}

            {showRevokeAllModal && (
                <Modal title={t('profile.revoke_sessions')} onClose={() => setShowRevokeAllModal(false)}>
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
                            {t('profile.modal.confirm')}
                        </button>
                    </div>
                </Modal>
            )}



            {showDeleteAccountModal && (
                <Modal title={t('profile.modal.delete_title')} onClose={() => setShowDeleteAccountModal(false)}>
                    <p className="mb-4 text-muted-foreground">{t('profile.modal.delete_confirm')}</p>
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
        </div >
    );
}
