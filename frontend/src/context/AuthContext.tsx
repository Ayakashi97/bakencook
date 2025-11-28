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
            api.get('/users/me', { timeout: 5000 })
                .then(res => setUser(res.data))
                .catch(() => {
                    localStorage.removeItem('token');
                    delete api.defaults.headers.common['Authorization'];
                })
                .finally(() => setIsLoading(false));
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
