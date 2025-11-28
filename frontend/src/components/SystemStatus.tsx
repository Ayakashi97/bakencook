import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { RefreshCw, Activity, Database, Server, Globe, Bot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

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
    const [checkResult, setCheckResult] = useState<SystemInfo | null>(null);

    const { data: systemInfo, isLoading } = useQuery<SystemInfo>({
        queryKey: ['systemInfo'],
        queryFn: async () => {
            const res = await api.get('/admin/system/info');
            return res.data;
        },
        refetchInterval: 30000 // Refresh every 30s
    });

    const checkUpdateMutation = useMutation({
        mutationFn: () => api.post('/admin/system/check-update'),
        onSuccess: (data) => {
            setCheckResult(data.data);
        },
        onError: (err: any) => {
            alert(err.response?.data?.detail || 'Failed to check for updates');
        }
    });

    if (isLoading) return <div>{t('common.loading')}</div>;

    const isDocker = systemInfo?.environment === 'docker';

    const services = [
        { id: 'frontend', label: 'Frontend', icon: Globe, status: systemInfo?.services?.frontend || 'online' },
        { id: 'backend', label: 'Backend', icon: Server, status: systemInfo?.services?.backend || 'offline' },
        { id: 'database', label: 'Database', icon: Database, status: systemInfo?.services?.database || 'offline' },
        { id: 'scraper', label: 'Scraper', icon: Bot, status: systemInfo?.services?.scraper || 'offline' },
    ];

    return (
        <div className="space-y-6">
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

            <div className="glass-card rounded-xl overflow-hidden p-6 space-y-6">
                <h3 className="font-semibold text-lg">{t('admin.system_info', 'System Information')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                        <div className="text-sm text-muted-foreground">{t('admin.current_version')}</div>
                        <div className="text-2xl font-mono font-bold text-primary">{systemInfo?.version}</div>
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

                    <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col justify-center items-start gap-4">
                        <div className="space-y-1">
                            <div className="font-medium">{t('admin.update_status')}</div>
                            <p className="text-sm text-muted-foreground">
                                {checkResult
                                    ? (checkResult.update_available
                                        ? t('admin.update_available')
                                        : t('admin.up_to_date'))
                                    : t('admin.check_updates_desc')
                                }
                            </p>
                        </div>
                        <button
                            onClick={() => checkUpdateMutation.mutate()}
                            disabled={checkUpdateMutation.isPending}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {checkUpdateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            {t('admin.check_updates')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
