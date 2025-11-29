import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function LanguageToggle() {
    const { i18n } = useTranslation();
    const { user } = useAuth();

    const toggleLanguage = async () => {
        const newLang = i18n.language === 'en' ? 'de' : 'en';
        i18n.changeLanguage(newLang);

        if (user) {
            try {
                await api.put('/users/me/settings', { language: newLang });
            } catch (error) {
                console.error('Failed to save language preference', error);
            }
        }
    };

    return (
        <button
            onClick={toggleLanguage}
            className="rounded-md p-2 hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            title="Switch Language"
        >
            <Languages className="h-[1.2rem] w-[1.2rem]" />
            <span className="text-sm font-medium uppercase">{i18n.language.split('-')[0]}</span>
        </button>
    );
}
