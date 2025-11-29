import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Loader2, ChefHat, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSystemSettings } from '../hooks/useSystemSettings';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Verification state
    const [needsVerification, setNeedsVerification] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { login, user, isLoading: authLoading } = useAuth();
    const { appName, faviconUrl, enableRegistration, isLoading: settingsLoading } = useSystemSettings();

    useEffect(() => {
        document.title = `${t('auth.register_title')} - ${appName}`;
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

    const performLogin = async () => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            const res = await api.post('/token', formData);
            login(res.data.access_token);
        } catch (err) {
            // Should not happen if registration was successful, but just in case
            navigate('/login');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await api.post('/register', { username, password, email, language: i18n.language });
            if (res.data.is_verified === false) {
                setNeedsVerification(true);
            } else {
                // Auto login
                await performLogin();
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.register_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerification = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        try {
            const res = await api.post('/auth/verify-email', { token: verificationCode });
            // Verify endpoint returns access_token
            if (res.data.access_token) {
                login(res.data.access_token);
            } else {
                await performLogin();
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.verification_failed', 'Verification failed'));
        } finally {
            setIsVerifying(false);
        }
    };

    const handleResendCode = async () => {
        try {
            if (email) {
                await api.post('/auth/resend-verification', null, { params: { email } });
            } else {
                await api.post('/auth/resend-verification', null, { params: { username } });
            }
            // toast.success(t('auth.code_resent', 'Verification code resent!')); 
            // We don't have toast here, maybe add it or just ignore
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to resend code');
        }
    };

    if (settingsLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (!enableRegistration) {
        return (
            <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 px-4 py-8 overflow-y-auto">
                <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border shadow-sm text-center">
                    <div className="flex justify-center mb-4">
                        <ChefHat className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold">{t('auth.registration_disabled', 'Registration Disabled')}</h2>
                    <p className="text-muted-foreground mt-2">{t('auth.registration_disabled_desc', 'New user registration is currently disabled by the administrator.')}</p>
                    <div className="pt-4">
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            {t('auth.back_to_login', 'Back to Login')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-muted/30 px-4 py-8 overflow-y-auto">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border shadow-sm">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <ChefHat className="h-12 w-12" />
                    </div>
                    <h2 className="text-3xl font-bold">{t('auth.register_title')}</h2>
                    <p className="text-muted-foreground mt-2">{t('register.subtitle', { appName })}</p>
                </div>

                {needsVerification ? (
                    <div className="space-y-6">
                        <div className="bg-primary/10 text-primary p-4 rounded-lg text-center text-sm">
                            <Mail className="h-8 w-8 mx-auto mb-2" />
                            {t('auth.verification_sent', 'Please check your email for the verification code.')}
                        </div>

                        <form onSubmit={handleVerification} className="space-y-4">
                            {error && (
                                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('auth.verification_code', 'Verification Code')}</label>
                                <input
                                    required
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center tracking-widest text-lg"
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value)}
                                    placeholder="000000"
                                    maxLength={6}
                                    autoFocus
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
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('auth.username')}</label>
                            <input
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('auth.email', 'Email')}</label>
                            <input
                                type="email"
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('auth.password')}</label>
                            <input
                                required
                                type="password"
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
                            {t('auth.register_btn')}
                        </button>
                    </form>
                )}

                <div className="text-center text-sm">
                    {t('auth.has_account')}{' '}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                        {t('auth.login_link')}
                    </Link>
                </div>
            </div>
        </div>
    );
}
