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
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { user, isLoading: authLoading } = useAuth();
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccessMessage('');

        try {
            const res = await api.post('/register', { username, password, email });
            if (res.data.is_verified === false) {
                setSuccessMessage(t('auth.verification_sent', 'Registration successful! Please check your email to verify your account.'));
                setUsername('');
                setPassword('');
                setEmail('');
            } else {
                navigate('/login');
            }
        } catch (err: any) {
            setError(err.response?.data?.detail || t('auth.register_failed'));
        } finally {
            setIsLoading(false);
        }
    };

    if (settingsLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    if (!enableRegistration) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
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
        <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border shadow-sm">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        <ChefHat className="h-12 w-12" />
                    </div>
                    <h2 className="text-3xl font-bold">{t('auth.register_title')}</h2>
                    <p className="text-muted-foreground mt-2">{t('register.subtitle', { appName })}</p>
                </div>

                {successMessage ? (
                    <div className="bg-green-500/10 text-green-600 p-4 rounded-lg text-center space-y-4 border border-green-500/20">
                        <Mail className="h-12 w-12 mx-auto text-green-500" />
                        <p className="font-medium">{successMessage}</p>
                        <div className="pt-2">
                            <Link to="/login" className="text-primary hover:underline font-medium">
                                {t('auth.proceed_to_login', 'Proceed to Login')}
                            </Link>
                        </div>
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
