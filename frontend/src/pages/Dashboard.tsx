import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, RecipePage } from '../lib/api';
import { Clock, Users, ChefHat, Search, Star, Heart, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/Pagination';
import { GlassTabs } from '../components/ui/GlassTabs';

export default function Dashboard() {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'discover' | 'my_recipes' | 'cooking' | 'baking'>('discover');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(12);

    // Simple debounce for search
    const [submittedSearch, setSubmittedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setSubmittedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const { data: recipePage, isLoading, error } = useQuery<RecipePage>({
        queryKey: ['recipes', activeTab, submittedSearch, sortBy, page, pageSize],
        queryFn: async () => {
            const res = await api.get('/recipes', {
                params: {
                    tab: activeTab,
                    search: submittedSearch,
                    sort_by: sortBy,
                    skip: (page - 1) * pageSize,
                    limit: pageSize
                }
            });
            return res.data;
        },
    });

    const recipes = recipePage?.items || [];
    const totalPages = recipePage?.pages || 0;
    const totalItems = recipePage?.total || 0;

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Immediate update on submit
        setSubmittedSearch(searchQuery);
        setPage(1); // Reset page on search
    };

    return (
        <div className="w-full space-y-6">
            {/* Tabs & Actions */}
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex-1 overflow-x-auto">
                    <GlassTabs
                        activeTab={activeTab}
                        onChange={(id) => { setActiveTab(id as any); setPage(1); }}
                        tabs={[
                            { id: 'discover', label: t('dashboard.discover', 'Entdecken') },
                            { id: 'my_recipes', label: t('dashboard.my_recipes', 'Meine Rezepte') },
                            { id: 'cooking', label: t('recipe.type.cooking', 'Kochen') },
                            { id: 'baking', label: t('recipe.type.baking', 'Backen') },
                        ]}
                    />
                </div>

                <div className="shrink-0">
                    <Link to="/recipe/new">
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            {t('dashboard.create_btn')}
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder={t('dashboard.search_placeholder', 'Suche nach Rezepten...')}
                            className="w-full pl-9 pr-4 py-2 border rounded-md bg-background"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                </form>

                <div className="flex items-center gap-2 ml-auto">
                    <span className="text-sm text-muted-foreground">{t('common.sort_by', 'Sortieren nach')}:</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="border rounded-md px-3 py-2 bg-background text-sm"
                    >
                        <option value="newest">{t('sort.newest', 'Neueste')}</option>
                        <option value="oldest">{t('sort.oldest', 'Älteste')}</option>
                        <option value="rating">{t('sort.rating', 'Beste Bewertung')}</option>
                        <option value="favorites">{t('sort.favorites', 'Beliebteste')}</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20">{t('common.loading')}...</div>
            ) : error ? (
                <div className="text-center py-20 text-red-500">{t('common.error')}</div>
            ) : recipes?.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-lg border border-dashed">
                    <h3 className="text-xl font-semibold mb-2">{t('dashboard.no_recipes')}</h3>
                    <p className="text-muted-foreground">
                        {submittedSearch
                            ? t('dashboard.no_search_results', 'Keine Ergebnisse gefunden.')
                            : t('dashboard.start_creating')}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {recipes?.map((recipe) => (
                        <Link key={recipe.id} to={`/recipe/${recipe.id}`} className="block group h-full">
                            <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col">
                                <div className="h-48 bg-muted relative overflow-hidden">
                                    {recipe.image_url ? (
                                        <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-secondary/20">
                                            <ChefHat className="h-12 w-12 opacity-20" />
                                        </div>
                                    )}
                                    <div className="absolute top-2 right-2 flex gap-2">
                                        {recipe.is_favorited && (
                                            <div className="bg-white/90 p-1.5 rounded-full text-red-500 shadow-sm">
                                                <Heart className="w-3 h-3 fill-current" />
                                            </div>
                                        )}
                                        <div className="bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                                            {recipe.created_type === 'ai_import' ? 'AI' : 'Manuell'}
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors line-clamp-1">{recipe.title}</h3>
                                    <div className="text-xs text-muted-foreground mb-3">
                                        {t('recipe.by', 'von')} {recipe.author || 'Unknown'}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between text-sm text-muted-foreground pt-3 border-t">
                                        <div className="flex items-center gap-1">
                                            <Star className={`h-4 w-4 ${recipe.average_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                            <span className="font-medium text-foreground">{recipe.average_rating?.toFixed(1) || "-"}</span>
                                            <span className="text-xs">({recipe.rating_count})</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                <span>{recipe.yield_amount}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                <span>
                                                    {(() => {
                                                        const totalMin = recipe.chapters.reduce((acc, ch) => acc + ch.steps.reduce((sAcc, s) => sAcc + (s.duration_min || 0), 0), 0);
                                                        if (totalMin === 0) return "-";
                                                        const h = Math.floor(totalMin / 60);
                                                        const m = totalMin % 60;
                                                        return h > 0 ? `${h}h ${m}min` : `${m}min`;
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {totalPages > 0 && (
                <div className="mt-8 flex justify-center">
                    <Pagination
                        currentPage={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        pageSize={pageSize}
                        totalItems={totalItems}
                        onPageSizeChange={setPageSize}
                    />
                </div>
            )}
        </div>
    );
}
