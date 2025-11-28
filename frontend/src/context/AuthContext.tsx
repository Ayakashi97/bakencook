import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
    role_rel?: {
        name: string;
        permissions: string[];
    };
    session_duration_minutes?: number;
}

interface AuthContextType {
    user: User | null;
    login: (token: string) => void;
    logout: () => void;
    isLoading: boolean;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    // Session Management Refs
    const lastActivityRef = useRef<number>(Date.now());
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Helper to decode JWT manually to avoid extra dependencies
    const parseJwt = (token: string) => {
        try {
            return JSON.parse(atob(token.split('.')[1]));
        } catch (e) {
            return null;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setUser(null);
        if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
        }
        navigate('/login');
    };

    const refreshSession = async () => {
        try {
            const res = await api.post('/auth/refresh');
            const newToken = res.data.access_token;
            localStorage.setItem('token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            console.log('Session refreshed');
        } catch (error) {
            console.error('Failed to refresh session', error);
            // If refresh fails (e.g. token expired or invalid), logout
            logout();
        }
    };

    const checkSession = () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        const payload = parseJwt(token);
        if (!payload) {
            logout();
            return;
        }

        const now = Date.now() / 1000;
        const exp = payload.exp;

        // If expired, logout
        if (now >= exp) {
            console.log('Session expired');
            logout();
            return;
        }

        // Check activity
        const lastActivity = lastActivityRef.current;
        const timeSinceActivity = (Date.now() - lastActivity) / 1000; // seconds

        // Dynamic thresholds based on user settings
        const durationMin = user?.session_duration_minutes || 15;
        const durationSec = durationMin * 60;

        // 1. Idle Check: If user has been idle longer than the session duration, do not refresh.
        // Allow a small buffer (e.g. 10s) to avoid race conditions where they move mouse right at the end.
        if (timeSinceActivity > durationSec) {
            return;
        }

        // 2. Refresh Window: When to trigger refresh?
        // If we are within the last 30% of the token life, or 5 minutes, whichever is smaller.
        // For 1 min session -> refresh in last 18s.
        const refreshWindow = Math.min(5 * 60, durationSec * 0.3);
        const timeRemaining = exp - now;

        if (timeRemaining < refreshWindow) {
            refreshSession();
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

            const fetchUser = async (retries = 3, delay = 1000) => {
                try {
                    const res = await api.get('/users/me', { timeout: 5000 });
                    setUser(res.data);
                    setIsLoading(false);
                } catch (error: any) {
                    if (error.response && error.response.status === 401) {
                        // Invalid token, logout immediately
                        localStorage.removeItem('token');
                        delete api.defaults.headers.common['Authorization'];
                        setIsLoading(false);
                    } else if (retries > 0) {
                        // Transient error, retry
                        console.log(`Failed to fetch user, retrying in ${delay}ms...`, error);
                        setTimeout(() => fetchUser(retries - 1, delay * 2), delay);
                    } else {
                        // Failed after retries, but don't logout if it's just network error
                        // We might want to show an error state instead of redirecting to login
                        // For now, we keep isLoading true? No, that blocks the UI forever.
                        // If we set isLoading false and user null, it redirects to login.
                        // Ideally we should show a "Reconnecting..." screen.
                        // But for the update case, retrying 3 times (1s, 2s, 4s) + initial should cover ~7s.
                        // Plus the 5s countdown. Total 12s. Backend should be up.
                        console.error("Failed to fetch user after retries", error);

                        // If it's a 500 error, maybe we should logout? No.
                        // Only logout on 401.
                        // If we fail here, we are in a weird state: Token exists, but we can't get user.
                        // If we stop loading, App redirects to login.
                        // So we MUST eventually logout or show error.
                        // Let's try one final desperate measure: keep retrying slowly?
                        // Or just let it fail and redirect to login, assuming 12s is enough.
                        // But to be safe, let's increase retries.

                        // Let's just logout if we really can't connect after multiple attempts,
                        // otherwise the user is stuck.
                        localStorage.removeItem('token');
                        delete api.defaults.headers.common['Authorization'];
                        setIsLoading(false);
                    }
                }
            };

            fetchUser(5, 1000); // Retry 5 times: 1s, 2s, 4s, 8s, 16s. Total > 30s coverage.
        } else {
            setIsLoading(false);
        }

        // Activity Listeners
        const updateActivity = () => {
            lastActivityRef.current = Date.now();
        };

        window.addEventListener('mousemove', updateActivity);
        window.addEventListener('keydown', updateActivity);
        window.addEventListener('click', updateActivity);
        window.addEventListener('scroll', updateActivity);

        // Check session frequently (every 5 seconds) to handle short durations
        checkIntervalRef.current = setInterval(checkSession, 5 * 1000);

        return () => {
            window.removeEventListener('mousemove', updateActivity);
            window.removeEventListener('keydown', updateActivity);
            window.removeEventListener('click', updateActivity);
            window.removeEventListener('scroll', updateActivity);
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [user?.session_duration_minutes]); // Re-run if duration changes

    const login = (token: string) => {
        localStorage.setItem('token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        api.get('/users/me').then(res => {
            setUser(res.data);
            lastActivityRef.current = Date.now(); // Reset activity on login
            navigate('/');
        });
    };

    const hasPermission = (permission: string) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role_rel?.permissions?.includes(permission)) return true;
        return false;
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading, hasPermission }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
