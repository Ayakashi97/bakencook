import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { createPortal } from 'react-dom';

interface ImportProgressModalProps {
    isOpen: boolean;
    onClose: () => void;
    status: 'idle' | 'checking' | 'scraping' | 'analyzing' | 'completed' | 'error' | 'duplicate';
    error?: string;
    duplicateRecipeId?: string | null;
    redirectCountdown?: number;
    successCountdown?: number;
    onRedirect?: () => void;
    onCancel?: () => void;
}

export function ImportProgressModal({ isOpen, onClose, status, error, redirectCountdown, successCountdown, onRedirect, onCancel }: ImportProgressModalProps) {
    const { t } = useTranslation();
    const [steps, setSteps] = useState([
        { id: 'checking', label: t('import.step_checking', 'Checking for duplicates'), status: 'pending' },
        { id: 'scraping', label: t('import.step_scraping', 'Scraping Website'), status: 'pending' },
        { id: 'analyzing', label: t('import.step_analyzing', 'Analyzing with AI'), status: 'pending' },
        { id: 'completed', label: t('import.step_completed', 'Import Completed'), status: 'pending' }
    ]);

    useEffect(() => {
        if (status === 'idle') {
            setSteps(prev => prev.map(s => ({ ...s, status: 'pending' })));
            return;
        }

        setSteps(prev => {
            const newSteps = [...prev];

            if (status === 'checking') {
                newSteps[0].status = 'current';
                newSteps[1].status = 'pending';
                newSteps[2].status = 'pending';
                newSteps[3].status = 'pending';
            } else if (status === 'duplicate') {
                newSteps[0].status = 'warning';
                newSteps[1].status = 'pending';
                newSteps[2].status = 'pending';
                newSteps[3].status = 'pending';
            } else if (status === 'scraping') {
                newSteps[0].status = 'completed';
                newSteps[1].status = 'current';
                newSteps[2].status = 'pending';
                newSteps[3].status = 'pending';
            } else if (status === 'analyzing') {
                newSteps[0].status = 'completed';
                newSteps[1].status = 'completed';
                newSteps[2].status = 'current';
                newSteps[3].status = 'pending';
            } else if (status === 'completed') {
                newSteps[0].status = 'completed';
                newSteps[1].status = 'completed';
                newSteps[2].status = 'completed';
                newSteps[3].status = 'completed';
            } else if (status === 'error') {
                // Find the current step and mark as error
                const currentIdx = newSteps.findIndex(s => s.status === 'current');
                if (currentIdx !== -1) {
                    newSteps[currentIdx].status = 'error';
                } else {
                    // Fallback
                    newSteps[0].status = 'error';
                }
            }
            return newSteps;
        });

    }, [status]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-6 scale-100 animate-in zoom-in-95 duration-200">
                <h3 className="text-lg font-semibold">{t('import.progress_title', 'Importing Recipe')}</h3>

                <div className="space-y-4">
                    {steps.map((step) => (
                        <div key={step.id} className="flex items-center gap-3">
                            <div className="shrink-0 w-6 h-6 flex items-center justify-center">
                                {step.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                                {step.status === 'current' && <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />}
                                {step.status === 'pending' && <Circle className="w-4 h-4 text-muted-foreground" />}
                                {step.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                                {step.status === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-500" />}
                            </div>
                            <span className={cn(
                                "text-sm font-medium",
                                step.status === 'completed' && "text-foreground",
                                step.status === 'current' && "text-purple-600",
                                step.status === 'pending' && "text-muted-foreground",
                                step.status === 'error' && "text-red-500",
                                step.status === 'warning' && "text-yellow-600 dark:text-yellow-500"
                            )}>
                                {step.label}
                            </span>
                        </div>
                    ))}
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                        {error}
                    </div>
                )}

                {status === 'completed' && (
                    <div className="space-y-4 pt-2 border-t">
                        <div className="p-3 bg-green-500/10 text-green-600 dark:text-green-500 text-sm rounded-md border border-green-500/20">
                            {t('import.success_redirect_msg', { seconds: successCountdown })}
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                        >
                            {t('common.continue', 'Continue')}
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <button
                        onClick={onClose}
                        className="w-full py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md font-medium transition-colors"
                    >
                        {t('common.close', 'Close')}
                    </button>
                )}
                {status === 'duplicate' && (
                    <div className="space-y-4 pt-2 border-t">
                        <div className="p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 text-sm rounded-md border border-yellow-500/20">
                            {t('edit.duplicate_msg', { seconds: redirectCountdown })}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                            >
                                {t('edit.stay')}
                            </button>
                            <button
                                onClick={onRedirect}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium transition-colors"
                            >
                                {t('edit.go_now')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
