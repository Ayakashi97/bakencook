import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Save, RefreshCw, Shield, Mail, Globe, Cpu, Eye, EyeOff, Database, Download, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { FaviconPicker } from './FaviconPicker';
import { Modal } from '../components/Modal';


export default function AdminSystem() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'general' | 'access' | 'ai' | 'email' | 'backup'>('general');

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-xl overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-white/5 backdrop-blur-sm">
                    {/* Mobile Dropdown */}
                    <div className="md:hidden p-4">
                        <div className="relative">
                            <select
                                value={activeTab}
                                onChange={(e) => setActiveTab(e.target.value as any)}
                                className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg py-2 pl-4 pr-10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {[
                                    { id: 'general', label: t('admin.settings_general', 'General') },
                                    { id: 'access', label: t('admin.settings_access', 'Access & Security') },
                                    { id: 'ai', label: t('admin.settings_ai', 'AI Features') },
                                    { id: 'email', label: t('admin.settings_email', 'Email & SMTP') },
                                    { id: 'backup', label: t('admin.settings_backup', 'Backup & Restore') },
                                ].map((tab) => (
                                    <option key={tab.id} value={tab.id} className="bg-gray-900 text-white">
                                        {tab.label}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                                <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Sidebar */}
                    <nav className="hidden md:flex flex-col p-2 gap-1">
                        {[
                            { id: 'general', label: t('admin.settings_general', 'General'), icon: Globe },
                            { id: 'access', label: t('admin.settings_access', 'Access & Security'), icon: Shield },
                            { id: 'ai', label: t('admin.settings_ai', 'AI Features'), icon: Cpu },
                            { id: 'email', label: t('admin.settings_email', 'Email & SMTP'), icon: Mail },
                            { id: 'backup', label: t('admin.settings_backup', 'Backup & Restore'), icon: Database },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={cn(
                                    "group flex items-center justify-start text-left w-full px-3 py-2 text-sm font-medium rounded-md transition-all",
                                    activeTab === tab.id
                                        ? "bg-primary/10 text-primary shadow-sm"
                                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                )}
                            >
                                <tab.icon className={cn("mr-3 h-4 w-4", activeTab === tab.id ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 p-6 bg-background/30">
                    {activeTab === 'general' && <GeneralSettings />}
                    {activeTab === 'access' && <AccessSettings />}
                    {activeTab === 'ai' && <AISettings />}
                    {activeTab === 'email' && <EmailSettings />}
                    {activeTab === 'backup' && <BackupSettings />}
                </div>
            </div>
        </div>
    );
}


// --- Settings Components ---

function useSettings() {
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const { data: settings, isLoading } = useQuery({
        queryKey: ['adminSettings'],
        queryFn: async () => {
            const res = await api.get('/admin/settings');
            return res.data || {};
        }
    });

    const updateSettingsMutation = useMutation({
        mutationFn: (data: any) => api.put('/admin/settings', { settings: data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['adminSettings'] });
            queryClient.invalidateQueries({ queryKey: ['publicSettings'] });
            toast.success(t('admin.settings_saved', 'Settings saved successfully'));
        },
        onError: (err: any) => {
            let msg = 'Failed to save settings';
            if (err.response?.data?.detail) {
                if (typeof err.response.data.detail === 'string') {
                    msg = err.response.data.detail;
                } else if (Array.isArray(err.response.data.detail)) {
                    msg = err.response.data.detail.map((e: any) => e.msg).join(', ');
                } else {
                    msg = JSON.stringify(err.response.data.detail);
                }
            }
            toast.error(msg);
        }
    });

    return { settings, isLoading, updateSettingsMutation };
}

function GeneralSettings() {
    const { t } = useTranslation();
    const { settings, isLoading, updateSettingsMutation } = useSettings();
    const [formData, setFormData] = useState({ app_name: '', favicon_url: '', debug_mode: false });
    const [showFaviconModal, setShowFaviconModal] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData({
                app_name: settings.app_name || '',
                favicon_url: settings.favicon_url || '',
                debug_mode: settings.debug_mode || false
            });
        }
    }, [settings]);

    if (isLoading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6 max-w-xl">
            <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.app_name')}</label>
                <input
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    placeholder="Bake'n'Cook"
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.favicon')}</label>
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden">
                        {formData.favicon_url ? (
                            <img src={formData.favicon_url} alt="Favicon" className="h-8 w-8 object-contain" />
                        ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFaviconModal(true)}
                        className="text-sm text-primary hover:underline font-medium"
                    >
                        {t('admin.change_favicon')}
                    </button>
                </div>
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.debug_mode', 'Debug Mode')}</label>
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                    <div>
                        <div className="font-medium">{t('admin.enable_debug', 'Enable Debug Logging')}</div>
                        <div className="text-sm text-muted-foreground">{t('admin.enable_debug_desc', 'Show detailed logs in backend console')}</div>
                    </div>
                    <Switch
                        checked={formData.debug_mode === true}
                        onChange={() => setFormData({ ...formData, debug_mode: !formData.debug_mode })}
                    />
                </div>
                <div className="flex justify-end mt-2">
                    <button
                        onClick={() => setShowLogsModal(true)}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                        <Eye className="h-3 w-3" />
                        {t('admin.view_logs', 'View Logs')}
                    </button>
                </div>
            </div>
            <button
                onClick={() => updateSettingsMutation.mutate(formData)}
                disabled={updateSettingsMutation.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
            >
                {updateSettingsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
            </button>

            {showLogsModal && <LogViewerModal onClose={() => setShowLogsModal(false)} />}

            {showFaviconModal && (
                <Modal title={t('admin.select_favicon')} onClose={() => setShowFaviconModal(false)}>
                    <div className="space-y-4">
                        <FaviconPicker
                            value={formData.favicon_url}
                            onChange={(url) => setFormData({ ...formData, favicon_url: url })}
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    updateSettingsMutation.mutate(formData);
                                    setShowFaviconModal(false);
                                }}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium"
                            >
                                {t('common.done')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

function AccessSettings() {
    const { t } = useTranslation();
    const { settings, isLoading, updateSettingsMutation } = useSettings();
    const [formData, setFormData] = useState({
        allow_guest_access: 'false',
        enable_registration: 'true',
        maintenance_mode: 'false'
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                allow_guest_access: settings.allow_guest_access || 'false',
                enable_registration: settings.enable_registration || 'true',
                maintenance_mode: settings.maintenance_mode || 'false'
            });
        }
    }, [settings]);

    const handleToggle = (key: string) => {
        const newVal = formData[key as keyof typeof formData] === 'true' ? 'false' : 'true';
        setFormData({ ...formData, [key]: newVal });
        // Auto-save on toggle? Or wait for save button? Let's wait for save button for consistency.
    };

    if (isLoading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6 max-w-xl">
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                    <div>
                        <div className="font-medium">{t('admin.allow_guest_access', 'Guest Access')}</div>
                        <div className="text-sm text-muted-foreground">{t('admin.allow_guest_access_desc', 'Allow unauthenticated users to view public recipes')}</div>
                    </div>
                    <Switch checked={formData.allow_guest_access === 'true'} onChange={() => handleToggle('allow_guest_access')} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                    <div>
                        <div className="font-medium">{t('admin.enable_registration', 'User Registration')}</div>
                        <div className="text-sm text-muted-foreground">{t('admin.enable_registration_desc', 'Allow new users to sign up')}</div>
                    </div>
                    <Switch checked={formData.enable_registration === 'true'} onChange={() => handleToggle('enable_registration')} />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                    <div>
                        <div className="font-medium text-red-500">{t('admin.maintenance_mode', 'Maintenance Mode')}</div>
                        <div className="text-sm text-muted-foreground">{t('admin.maintenance_mode_desc', 'Only admins can log in when enabled')}</div>
                    </div>
                    <Switch checked={formData.maintenance_mode === 'true'} onChange={() => handleToggle('maintenance_mode')} />
                </div>
            </div>

            <button
                onClick={() => updateSettingsMutation.mutate(formData)}
                disabled={updateSettingsMutation.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
            >
                {updateSettingsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
            </button>
        </div>
    );
}

function AISettings() {
    const { t } = useTranslation();
    const { settings, isLoading, updateSettingsMutation } = useSettings();
    const [formData, setFormData] = useState({
        enable_ai: 'true',
        gemini_api_key: ''
    });
    const [showKey, setShowKey] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData({
                enable_ai: settings.enable_ai || 'true',
                gemini_api_key: settings.gemini_api_key || ''
            });
        }
    }, [settings]);

    if (isLoading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6 max-w-xl">
            <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                <div>
                    <div className="font-medium">{t('admin.enable_ai', 'Enable AI Features')}</div>
                    <div className="text-sm text-muted-foreground">{t('admin.enable_ai_desc', 'Enable recipe import and parsing via AI')}</div>
                </div>
                <Switch checked={formData.enable_ai === 'true'} onChange={() => setFormData(prev => ({ ...prev, enable_ai: prev.enable_ai === 'true' ? 'false' : 'true' }))} />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">{t('admin.gemini_api_key', 'Gemini API Key')}</label>
                <form className="relative" onSubmit={(e) => e.preventDefault()}>
                    <input
                        type={showKey ? "text" : "password"}
                        autoComplete="new-password"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                        value={formData.gemini_api_key}
                        onChange={(e) => setFormData({ ...formData, gemini_api_key: e.target.value })}
                        placeholder="AIza..."
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                        {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </form>
            </div>

            <button
                onClick={() => {
                    if (formData.enable_ai === 'true' && !formData.gemini_api_key.trim()) {
                        toast.error(t('onboarding.errors.gemini_key_required', 'Please enter a Gemini API Key'));
                        return;
                    }
                    updateSettingsMutation.mutate(formData);
                }}
                disabled={updateSettingsMutation.isPending}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
            >
                {updateSettingsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('common.save')}
            </button>
        </div>
    );
}

function EmailSettings() {
    const { t, i18n } = useTranslation();
    const { settings, isLoading, updateSettingsMutation } = useSettings();
    const [formData, setFormData] = useState({
        enable_email_verification: 'false',
        smtp_host: '',
        smtp_port: '587',
        smtp_user: '',
        smtp_password: '',
        smtp_from_email: '',
        smtp_tls: 'true'
    });
    const [showSmtpPassword, setShowSmtpPassword] = useState(false);


    const testEmailMutation = useMutation({
        mutationFn: (data: any) => api.post('/admin/system/email/test', {
            smtp_server: data.smtp_host,
            smtp_port: parseInt(data.smtp_port),
            smtp_user: data.smtp_user,
            smtp_password: data.smtp_password,
            sender_email: data.smtp_from_email,
            test_recipient: data.smtp_from_email, // Send to self
            language: i18n.language
        }),
        onSuccess: () => {
            toast.success(t('admin.email_test_success', 'Test email sent successfully!'));
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.detail || 'Failed to send test email');
        }
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                enable_email_verification: settings.enable_email_verification || 'false',
                smtp_host: settings.smtp_host || '',
                smtp_port: settings.smtp_port || '587',
                smtp_user: settings.smtp_user || '',
                smtp_password: settings.smtp_password || '',
                smtp_from_email: settings.smtp_from_email || '',
                smtp_tls: settings.smtp_tls || 'true'
            });
        }
    }, [settings]);

    if (isLoading) return <div>{t('common.loading')}</div>;

    return (
        <div className="space-y-6 max-w-xl">
            <div className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/5">
                <div>
                    <div className="font-medium">{t('admin.enable_email_verification', 'Email Verification')}</div>
                    <div className="text-sm text-muted-foreground">{t('admin.enable_email_verification_desc', 'Require new users to verify their email')}</div>
                </div>
                <Switch checked={formData.enable_email_verification === 'true'} onChange={() => setFormData(prev => ({ ...prev, enable_email_verification: prev.enable_email_verification === 'true' ? 'false' : 'true' }))} />
            </div>

            {formData.enable_email_verification === 'true' && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('admin.smtp_host', 'SMTP Host')}</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.smtp_host}
                                onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                                placeholder="smtp.example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('admin.smtp_port', 'SMTP Port')}</label>
                            <input
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={formData.smtp_port}
                                onChange={(e) => setFormData({ ...formData, smtp_port: e.target.value })}
                                placeholder="587"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('admin.smtp_user', 'SMTP User')}</label>
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.smtp_user}
                            onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                            autoComplete="off"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('admin.smtp_password', 'SMTP Password')}</label>
                        <form className="relative" onSubmit={(e) => e.preventDefault()}>
                            <input
                                type={showSmtpPassword ? "text" : "password"}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm pr-10"
                                value={formData.smtp_password}
                                onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                            >
                                {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </form>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('admin.smtp_from', 'From Email')}</label>
                        <input
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.smtp_from_email}
                            onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
                            placeholder="noreply@example.com"
                        />
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="smtp_tls"
                            className="h-4 w-4 rounded border-gray-300"
                            checked={formData.smtp_tls === 'true'}
                            onChange={(e) => setFormData({ ...formData, smtp_tls: e.target.checked ? 'true' : 'false' })}
                        />
                        <label htmlFor="smtp_tls" className="text-sm font-medium leading-none">
                            {t('admin.smtp_tls', 'Use TLS')}
                        </label>
                    </div>
                </>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
                <button
                    onClick={() => updateSettingsMutation.mutate(formData)}
                    disabled={updateSettingsMutation.isPending}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center justify-center gap-2 text-sm font-medium w-full sm:w-auto"
                >
                    {updateSettingsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {t('common.save')}
                </button>
                {formData.enable_email_verification === 'true' && (
                    <button
                        onClick={() => testEmailMutation.mutate(formData)}
                        disabled={testEmailMutation.isPending || !formData.smtp_host || !formData.smtp_user}
                        className="border border-input bg-background hover:bg-accent hover:text-accent-foreground px-4 py-2 rounded-md flex items-center justify-center gap-2 text-sm font-medium transition-colors disabled:opacity-50 w-full sm:w-auto"
                    >
                        {testEmailMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                        {t('admin.test_config', 'Test Configuration')}
                    </button>
                )}
            </div>
        </div>
    );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={onChange}
            className={cn(
                "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                checked ? "bg-primary" : "bg-input"
            )}
        >
            <span
                className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
                    checked ? "translate-x-5" : "translate-x-0"
                )}
            />
        </button>
    );
}

function LogViewerModal({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const { data, isLoading, refetch } = useQuery({
        queryKey: ['systemLogs'],
        queryFn: async () => {
            const res = await api.get('/admin/logs');
            return res.data;
        }
    });

    return (
        <Modal title={t('admin.system_logs', 'System Logs')} onClose={onClose}>
            <div className="space-y-4 w-[1000px] max-w-[95vw]">
                <div className="bg-black/90 text-green-400 font-mono text-xs p-4 rounded-lg h-[600px] overflow-y-auto whitespace-pre-wrap break-all">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="h-6 w-6 animate-spin text-white" />
                        </div>
                    ) : (
                        data?.logs?.map((line: string, i: number) => (
                            <div key={i} className="break-words">{line}</div>
                        )) || <div className="text-gray-500 italic">No logs found</div>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border rounded hover:bg-accent"
                    >
                        <RefreshCw className="h-3 w-3" />
                        {t('common.refresh', 'Refresh')}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
                    >
                        {t('common.close')}
                    </button>
                </div>
            </div>
        </Modal>
    );
}

function BackupSettings() {
    const { t } = useTranslation();
    const [isRestoring, setIsRestoring] = useState(false);
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadBackup = async () => {
        try {
            const response = await api.get('/admin/system/backup', {
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Get filename from header or generate default
            const contentDisposition = response.headers['content-disposition'];
            let filename = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
                if (filenameMatch.length === 2)
                    filename = filenameMatch[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success(t('admin.backup_download_started', 'Backup download started'));
        } catch (error) {
            console.error(error);
            toast.error(t('admin.backup_failed', 'Failed to download backup'));
        }
    };

    const handleRestore = async () => {
        if (!selectedFile) return;

        setIsRestoring(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            await api.post('/admin/system/restore', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            toast.success(t('admin.restore_success', 'System restored successfully. Reloading...'));
            setTimeout(() => window.location.reload(), 2000);
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.detail || t('admin.restore_failed', 'Restore failed'));
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-6 max-w-xl">
            {/* Backup Section */}
            <div className="p-4 rounded-lg border border-white/10 bg-white/5 space-y-4">
                <div>
                    <div className="font-medium flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        {t('admin.create_backup', 'Create Backup')}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                        {t('admin.create_backup_desc', 'Download a full backup of your database and uploaded files.')}
                    </div>
                </div>
                <button
                    onClick={handleDownloadBackup}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium"
                >
                    <Download className="h-4 w-4" />
                    {t('admin.download_backup', 'Download Backup')}
                </button>
            </div>

            {/* Restore Section */}
            <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 space-y-4">
                <div>
                    <div className="font-medium flex items-center gap-2 text-red-500">
                        <RefreshCw className="h-4 w-4" />
                        {t('admin.restore_backup', 'Restore Backup')}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                        {t('admin.restore_backup_desc', 'Restore system from a backup file. WARNING: This will overwrite all current data!')}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <input
                        type="file"
                        accept=".zip"
                        ref={fileInputRef}
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="border border-input bg-background hover:bg-accent px-4 py-2 rounded-md text-sm font-medium"
                    >
                        {selectedFile ? selectedFile.name : t('admin.select_file', 'Select Backup File')}
                    </button>

                    <button
                        onClick={() => setShowRestoreConfirm(true)}
                        disabled={!selectedFile || isRestoring}
                        className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                    >
                        {isRestoring && <RefreshCw className="h-4 w-4 animate-spin" />}
                        {t('admin.restore', 'Restore')}
                    </button>
                </div>
            </div>

            {showRestoreConfirm && (
                <Modal title={t('admin.confirm_restore', 'Confirm Restore')} onClose={() => setShowRestoreConfirm(false)}>
                    <div className="space-y-4">
                        <div className="p-3 bg-red-500/10 text-red-500 rounded-md text-sm font-medium flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            {t('admin.restore_warning', 'Warning: This action is irreversible!')}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t('admin.restore_confirm_msg', 'Are you sure you want to restore this backup? All current data (recipes, users, settings) will be replaced.')}
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowRestoreConfirm(false)}
                                className="px-4 py-2 rounded-md text-sm font-medium hover:bg-accent"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={() => {
                                    setShowRestoreConfirm(false);
                                    handleRestore();
                                }}
                                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600 text-sm font-medium"
                            >
                                {t('admin.confirm_restore_btn', 'Yes, Restore System')}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
