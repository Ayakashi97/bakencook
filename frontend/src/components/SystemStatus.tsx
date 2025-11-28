import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RefreshCw, Activity, Database, Server, Globe, Bot, Download, CheckCircle2, Loader2, ArrowUpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { Modal } from './Modal';

interface SystemInfo {
    version: string;
    environment: 'docker' | 'local';
    update_available: boolean;
    services: {
        frontend: 'online' | 'offline';
        backend: 'online' | 'offline';
        database: 'online' | 'offline';
        scraper: 'online' | 'offline';
    };
}

export default function SystemStatus() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<string>('idle');
    const [updateLog, setUpdateLog] = useState<string[]>([]);

    // --- System Info ---
    const { data: systemInfo, isLoading: isLoadingInfo } = useQuery<SystemInfo>({
        queryKey: ['systemInfo'],
        queryFn: async () => {
            const res = await api.get('/admin/system/info');
            return res.data;
        },
        refetchInterval: 30000 // Refresh every 30s
    });

    // --- Update Logic ---

    // Fetch Version (Redundant if systemInfo has it, but let's keep consistent with UpdateSettings logic for now or merge)
    // systemInfo has version.

    // Fetch Changelog
    const { data: changelogData } = useQuery({
        queryKey: ['systemChangelog'],
        queryFn: async () => {
            const res = await api.get('/system/changelog');
            return res.data;
        }
    });

    // Check Updates
    const { data: updateData, isLoading: isLoadingUpdate, refetch: checkUpdates } = useQuery({
        queryKey: ['systemUpdateCheck'],
        queryFn: async () => {
            const res = await api.get('/system/check-update');
            return res.data;
        },
        // enabled: false // Auto check on mount via useEffect
    });

    // Update Channel Settings
    const { data: settings } = useQuery({
        queryKey: ['systemSettings'],
        queryFn: async () => {
            const res = await api.get('/system/settings');
            return res.data;
        }
    });

    const updateChannelMutation = useMutation({
        mutationFn: async (channel: string) => {
            await api.put('/system/settings', { update_channel: channel });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
            toast.success(t('common.saved'));
            checkUpdates(); // Re-check updates after channel change
        }
    });

    // Start Update Mutation
    const startUpdateMutation = useMutation({
        mutationFn: async (version: string) => {
            await api.post('/system/update', { version });
        },
        onSuccess: () => {
            setIsUpdateModalOpen(true);
            setUpdateStatus('running');
            setUpdateLog(['Starting update...']);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.detail || "Failed to start update");
        }
    });

    // Poll Update Status
    useQuery({
        queryKey: ['updateStatus'],
        queryFn: async () => {
            if (!isUpdateModalOpen || updateStatus === 'completed' || updateStatus === 'failed') return null;
            const res = await api.get('/system/update-status');
            setUpdateStatus(res.data.status);
            setUpdateLog(res.data.log);
            return res.data;
        },
        enabled: isUpdateModalOpen && updateStatus === 'running',
        refetchInterval: 1000,
    });

    const handleUpdateClick = () => {
        if (updateData?.remote_version) {
            if (confirm(t('admin.confirm_update', 'Are you sure you want to update? The system will be restarted.'))) {
                startUpdateMutation.mutate(updateData.remote_version);
            }
        }
    };

    if (isLoadingInfo) return <div>{t('common.loading')}</div>;

    const isDocker = systemInfo?.environment === 'docker';

    const services = [
        { id: 'frontend', label: 'Frontend', icon: Globe, status: systemInfo?.services?.frontend || 'online' },
        { id: 'backend', label: 'Backend', icon: Server, status: systemInfo?.services?.backend || 'offline' },
        { id: 'database', label: 'Database', icon: Database, status: systemInfo?.services?.database || 'offline' },
        { id: 'scraper', label: 'Scraper', icon: Bot, status: systemInfo?.services?.scraper || 'offline' },
    ];

    return (
        <div className="space-y-6">
            {/* Services Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {services.map((service) => (
                    <div key={service.id} className="glass-card p-4 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "p-2 rounded-lg",
                                service.status === 'online' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                            )}>
                                <service.icon className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-medium text-sm">{service.label}</div>
                                <div className={cn(
                                    "text-xs font-medium uppercase tracking-wider",
                                    service.status === 'online' ? "text-green-500" : "text-red-500"
                                )}>
                                    {service.status}
                                </div>
                            </div>
                        </div>
                        <Activity className={cn(
                            "h-4 w-4",
                            service.status === 'online' ? "text-green-500" : "text-red-500"
                        )} />
                    </div>
                ))}
            </div>

            {/* System Info & Updates */}
            <div className="glass-card rounded-xl overflow-hidden p-6 space-y-6">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {t('admin.system_info', 'System Information')}
                </h3>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Version & Environment */}
                    <div className="space-y-6">
                        <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <div className="text-sm text-muted-foreground">{t('admin.current_version')}</div>
                            <div className="text-3xl font-mono font-bold text-primary">{systemInfo?.version}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border",
                                    isDocker
                                        ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                        : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                )}>
                                    {systemInfo?.environment}
                                </span>
                                <span>{t('admin.environment')}</span>
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-sm font-medium mb-1">{t('admin.update_channel')}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {t('admin.channel_desc', 'Select "Beta" to receive early access updates.')}
                                    </p>
                                </div>
                                <ArrowUpCircle className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <select
                                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={settings?.update_channel || 'stable'}
                                onChange={(e) => updateChannelMutation.mutate(e.target.value)}
                            >
                                <option value="stable">Stable (Releases)</option>
                                <option value="beta">Beta (Pre-releases)</option>
                            </select>
                        </div>
                    </div>

                    {/* Update Status */}
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium">{t('admin.update_status')}</h4>
                            <button
                                onClick={() => checkUpdates()}
                                disabled={isLoadingUpdate}
                                className="text-xs flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
                            >
                                {isLoadingUpdate ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                {t('admin.check_now')}
                            </button>
                        </div>

                        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
                            {updateData?.update_available ? (
                                <>
                                    <div className="p-3 bg-green-500/10 rounded-full text-green-500">
                                        <Download className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-lg text-green-500">{t('admin.update_available')}</div>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            v{systemInfo?.version} → <span className="font-mono font-bold text-foreground">{updateData.remote_version}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleUpdateClick}
                                        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
                                    >
                                        {t('admin.update_now', 'Update Now')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="p-3 bg-muted/10 rounded-full text-muted-foreground">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <div className="font-medium">{t('admin.system_up_to_date')}</div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {t('admin.latest_version_msg')}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Changelog */}
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <h3 className="font-semibold mb-4 text-sm">{t('admin.changelog')}</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-black/20 p-4 rounded-md h-48 overflow-y-auto border border-white/5">
                        <pre className="whitespace-pre-wrap font-sans text-xs">{changelogData?.changelog || 'Loading...'}</pre>
                    </div>
                </div>
            </div>

            {/* Update Progress Modal */}
            {isUpdateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                    <div className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 sm:rounded-lg">
                        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
                            <h2 className="text-lg font-semibold leading-none tracking-tight">
                                {updateStatus === 'running' ? t('admin.updating', 'Updating System...') :
                                    updateStatus === 'completed' ? t('admin.update_completed', 'Update Completed') :
                                        t('admin.update_failed', 'Update Failed')}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {t('admin.update_desc', 'Please wait while the system updates. Do not close this window.')}
                            </p>
                        </div>

                        <div className="bg-black text-green-400 font-mono text-xs p-4 rounded-md h-64 overflow-y-auto">
                            {updateLog.map((line, i) => (
                                <div key={i}>{line}</div>
                            ))}
                            {updateStatus === 'running' && (
                                <div className="animate-pulse">_</div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            {updateStatus !== 'running' && (
                                <button
                                    onClick={() => {
                                        setIsUpdateModalOpen(false);
                                        if (updateStatus === 'completed') {
                                            window.location.reload();
                                        }
                                    }}
                                    className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                                >
                                    {updateStatus === 'completed' ? t('common.reload', 'Reload') : t('common.close', 'Close')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
