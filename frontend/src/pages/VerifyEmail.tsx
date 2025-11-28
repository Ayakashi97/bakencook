import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSystemSettings } from '../hooks/useSystemSettings';

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const { t } = useTranslation();
    useSystemSettings(); // Keep hook for potential future use or side effects, but remove unused destructuring if truly unused. 
    // Actually, if I remove appName, I might as well remove the hook call if it's not used for anything else.
    // But wait, useSystemSettings fetches data. 
    // Let's just remove appName destructuring.
    const navigate = useNavigate();

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('auth.invalid_token', 'Invalid verification token.'));
            return;
        }

        const verify = async () => {
            try {
                await api.post(`/auth/verify-email?token=${token}`);
                setStatus('success');
                setMessage(t('auth.email_verified', 'Your email has been successfully verified!'));
                // Redirect to login after 3 seconds
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (err: any) {
                setStatus('error');
                const detail = err.response?.data?.detail;
                let errorMsg = t('auth.verification_failed', 'Verification failed. The token may be invalid or expired.');

                if (detail === 'Invalid token') {
                    errorMsg = t('auth.invalid_token_error', 'The verification token is invalid.');
                } else if (detail === 'Token expired') {
                    errorMsg = t('auth.token_expired', 'The verification token has expired.');
                } else if (detail === 'User not found') {
                    errorMsg = t('auth.user_not_found', 'User associated with this token was not found.');
                }

                setMessage(errorMsg);
            }
        };

        verify();
    }, [token, t, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
            <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-lg border shadow-sm text-center">
                <div className="flex justify-center mb-4">
                    {status === 'loading' && <Loader2 className="h-16 w-16 animate-spin text-primary" />}
                    {status === 'success' && <CheckCircle2 className="h-16 w-16 text-green-500" />}
                    {status === 'error' && <XCircle className="h-16 w-16 text-destructive" />}
                </div>

                <h2 className="text-2xl font-bold">
                    {status === 'loading' && t('auth.verifying', 'Verifying Email...')}
                    {status === 'success' && t('auth.verified', 'Email Verified')}
                    {status === 'error' && t('auth.verification_error', 'Verification Error')}
                </h2>

                <p className="text-muted-foreground mt-2">
                    {message}
                </p>

                {status === 'success' && (
                    <p className="text-sm text-muted-foreground mt-4">
                        {t('auth.redirecting', 'Redirecting to login...')}
                    </p>
                )}

                {status === 'error' && (
                    <div className="pt-4">
                        <Link to="/login" className="text-primary hover:underline font-medium">
                            {t('auth.back_to_login', 'Back to Login')}
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
