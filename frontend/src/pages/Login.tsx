import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, ChefHat, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSystemSettings } from '../hooks/useSystemSettings';

import { Modal } from '../components/Modal';
import { toast } from 'sonner';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const { login, user, isLoading: authLoading } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { appName, faviconUrl, enableRegistration } = useSystemSettings();

    useEffect(() => {
        document.title = `${t('auth.login_title')} - ${appName}`;
        const link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (link) {
            link.href = faviconUrl;
        }
    }, [appName, faviconUrl, t]);

    useEffect(() => {
        if (user && !authLoading) {
            navigate('/');
        }
    }, [user, authLoading, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const res = await api.post('/token', formData);
            login(res.data.access_token);
        } catch (err: any) {
            const detail = err.response?.data?.detail;
            if (detail === 'USER_INACTIVE') {
                setError(t('errors.USER_INACTIVE'));
            } else if (detail === 'System is in maintenance mode') {
                setError(t('auth.maintenance_mode_error', 'System is in maintenance mode. Only admins can log in.'));
            } else if (detail === 'Email not verified') {
                setError(t('auth.email_not_verified', 'Please verify your email address before logging in.'));
                setShowVerificationModal(true);
            } else {
                setError(detail || t('auth.login_failed'));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            const res = await api.post('/auth/verify-email', { token: verificationCode });
            toast.success(t('auth.verification_success', 'Email verified successfully!'));
            setShowVerificationModal(false);

            // Auto login if token is returned
            if (res.data.access_token) {
                login(res.data.access_token);
            } else {
                // Fallback to manual login if no token (shouldn't happen with new backend)
                handleSubmit(e);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || t('auth.verification_failed', 'Verification failed'));
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendCode = async () => {
        try {
            // We need email for resend, but we only have username. 
            // Ideally backend should handle resend by username or we ask user for email.
            // But for now let's assume username is email or we can't resend easily without asking email.
            // Let's ask user to check email.
            // Or we can add a step to ask for email if username is not email.
            // For simplicity, let's try to use username as email if it looks like one.
            if (username.includes('@')) {
                await api.post('/auth/resend-verification', null, { params: { email: username } });
            } else {
                await api.post('/auth/resend-verification', null, { params: { username: username } });
            }
            toast.success(t('auth.code_resent', 'Verification code resent!'));
        } catch (err: any) {
            toast.error(err.response?.data?.detail || 'Failed to resend code');
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border shadow-sm">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <ChefHat className="h-12 w-12" />
                    </div>
                    <h2 className="text-3xl font-bold">{t('auth.login_title')}</h2>
                    <p className="text-muted-foreground mt-2">{appName}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('auth.username')}</label>
                        <input
                            required
                            autoComplete="username"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('auth.password')}</label>
                        <input
                            required
                            type="password"
                            autoComplete="current-password"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary text-primary-foreground h-10 rounded-md font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
                    >
                        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('auth.login_btn')}
                    </button>
                </form>

                {enableRegistration && (
                    <div className="text-center text-sm">
                        {t('auth.no_account')}{' '}
                        <Link to="/register" className="text-primary hover:underline font-medium">
                            {t('auth.register_link')}
                        </Link>
                    </div>
                )}
            </div>

            {showVerificationModal && (
                <Modal title={t('auth.verify_email', 'Verify Email')} onClose={() => setShowVerificationModal(false)}>
                    <p className="mb-4 text-muted-foreground">
                        {t('auth.enter_code_desc', 'Please enter the 6-digit code sent to your email.')}
                    </p>
                    <form onSubmit={handleVerification} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('auth.verification_code', 'Verification Code')}</label>
                            <input
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest text-lg"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                                placeholder="000000"
                                maxLength={6}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <button
                                type="button"
                                onClick={handleResendCode}
                                className="text-sm text-primary hover:underline"
                            >
                                {t('auth.resend_code', 'Resend Code')}
                            </button>
                            <button
                                type="submit"
                                disabled={isVerifying}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2"
                            >
                                {isVerifying && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t('auth.verify_btn', 'Verify')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
