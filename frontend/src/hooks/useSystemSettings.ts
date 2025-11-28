import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface PublicSettings {
    app_name: string;
    favicon_url: string;
    allow_guest_access: string;
    enable_registration: string;
}

export function useSystemSettings() {
    const { data: settings, isLoading } = useQuery<PublicSettings>({
        queryKey: ['publicSettings'],
        queryFn: async () => {
            const res = await api.get('/settings/public');
            return res.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        retry: 1
    });

    return {
        appName: settings?.app_name || "BreadPlan",
        faviconUrl: settings?.favicon_url || "/favicon.ico",
        allowGuestAccess: settings?.allow_guest_access === 'true',
        enableRegistration: settings?.enable_registration !== 'false', // Default true
        isLoading
    };
}
