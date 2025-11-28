import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, Recipe } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useSystemSettings } from '../hooks/useSystemSettings';

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { appName } = useSystemSettings();

    // Toggle with Ctrl+K or Cmd+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 10);
            setQuery('');
        }
    }, [isOpen]);

    // Search Query
    const { data: results, isLoading } = useQuery<Recipe[]>({
        queryKey: ['global-search', query],
        queryFn: async () => {
            if (!query.trim()) return [];
            const res = await api.get('/recipes/', {
                params: {
                    tab: 'search',
                    search: query
                }
            });
            return res.data.items || [];
        },
        enabled: query.length > 0,
    });

    const handleSelect = (recipeId: string) => {
        navigate(`/recipe/${recipeId}`);
        setIsOpen(false);
    };

    // Keyboard navigation for results
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (results?.length) {
                    setSelectedIndex(prev => (prev + 1) % results.length);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (results?.length) {
                    setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results?.length) {
                    handleSelect(results[selectedIndex].id);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-background text-foreground rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="flex items-center border-b px-4 py-3 gap-3">
                    <Search className="w-5 h-5 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        className="flex-1 bg-transparent border-none outline-none text-lg placeholder:text-muted-foreground"
                        placeholder={t('search.placeholder')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-muted rounded">
                            <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">ESC</span>
                        </button>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {!query && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            {t('search.type_to_search')}
                        </div>
                    )}

                    {query && !isLoading && results?.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                            {t('search.no_results')}
                        </div>
                    )}

                    {results && results.map((recipe, idx) => (
                        <button
                            key={recipe.id}
                            onClick={() => handleSelect(recipe.id)}
                            className={cn(
                                "w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors",
                                idx === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
                            )}
                            onMouseEnter={() => setSelectedIndex(idx)}
                        >
                            {recipe.image_url ? (
                                <img src={recipe.image_url} alt="" className="w-10 h-10 rounded object-cover bg-muted" />
                            ) : (
                                <div className="w-10 h-10 rounded bg-secondary flex items-center justify-center">
                                    <Search className="w-5 h-5 opacity-50" />
                                </div>
                            )}
                            <div>
                                <div className="font-medium">{recipe.title}</div>
                                <div className="text-xs text-muted-foreground flex gap-2">
                                    <span>{recipe.author || t('common.unknown')}</span>
                                    {recipe.average_rating && <span>★ {recipe.average_rating.toFixed(1)}</span>}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground border-t flex justify-between">
                    <div className="flex gap-2">
                        <span>{t('search.select')} <kbd className="font-sans border rounded px-1">↵</kbd></span>
                        <span>{t('search.navigate')} <kbd className="font-sans border rounded px-1">↑↓</kbd></span>
                    </div>
                    <span>{t('search.brand', { appName })}</span>
                </div>
            </div>
        </div>
    );
}
