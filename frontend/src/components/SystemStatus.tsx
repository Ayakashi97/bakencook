import { useState, useEffect, useRef } from 'react';
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

    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [updateLog]);

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
    const { data: updateData, isLoading: isLoadingUpdate, isRefetching: isRefetchingUpdate, refetch: checkUpdates } = useQuery({
        queryKey: ['systemUpdateCheck'],
        queryFn: async () => {
            const res = await api.get('/system/check-update');
            return res.data;
        },
        // enabled: false // Auto check on mount via useEffect
    });

    // ... (rest of code)

    {/* Update Status */ }
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">{t('admin.update_status')}</h4>
            <button
                onClick={() => checkUpdates()}
                disabled={isLoadingUpdate || isRefetchingUpdate}
                className="text-xs flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
            >
                {(isLoadingUpdate || isRefetchingUpdate) ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {t('admin.check_now')}
            </button>
        </div>

        <div className="flex-1 flex flex-col justify-center items-center text-center space-y-4">
            {updateData?.error ? (
                <div className="text-red-500">
                    <div className="font-bold">{t('admin.update_check_failed', 'Update Check Failed')}</div>
                    <div className="text-xs mt-1">{updateData.error}</div>
                </div>
            ) : updateData?.update_available ? (
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
                        {updateData?.remote_version && (
                            <p className="text-xs text-muted-foreground mt-1">
                                Latest: <span className="font-mono">{updateData.remote_version}</span>
                            </p>
                        )}
                    </div>
                </>
            )}
        </div>
    </div>
                </div >

        {/* Changelog */ }
        < div className = "p-4 rounded-lg bg-white/5 border border-white/10" >
                    <h3 className="font-semibold mb-4 text-sm">{t('admin.changelog')}</h3>
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-black/20 p-4 rounded-md h-48 overflow-y-auto border border-white/5">
                        <pre className="whitespace-pre-wrap font-sans text-xs">{changelogData?.changelog || 'Loading...'}</pre>
                    </div>
                </div >
            </div >

        {/* Confirmation Modal */ }
    {
        showConfirmModal && (
            <Modal title={t('admin.confirm_update_title', 'Confirm Update')} onClose={() => setShowConfirmModal(false)}>
                <div className="space-y-4">
                    <p>{t('admin.confirm_update', 'Are you sure you want to update? The system will be restarted.')}</p>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={() => setShowConfirmModal(false)}
                            className="px-4 py-2 rounded-md text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                            {t('admin.cancel', 'Cancel')}
                        </button>
                        <button
                            onClick={confirmUpdate}
                            className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium"
                        >
                            {t('admin.confirm', 'Confirm')}
                        </button>
                    </div>
                </div>
            </Modal>
        )
    }

    {/* Update Progress Modal */ }
    {
        isUpdateModalOpen && (
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

                    <div
                        ref={logContainerRef}
                        className="bg-black text-green-400 font-mono text-xs p-4 rounded-md h-64 overflow-y-auto"
                    >
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
        )
    }
        </div >
    );
}
