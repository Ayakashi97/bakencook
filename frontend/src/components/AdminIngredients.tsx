import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, AlertTriangle, Upload, Download, CheckCircle, MoreHorizontal } from 'lucide-react';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { IngredientFormModal } from './IngredientFormModal';

interface Ingredient {
    id: number;
    name: any; // JSON: { "en": { "singular": "...", "plural": "..." }, "de": ... }
    linked_recipe_id?: string; // UUID string
    default_unit_id?: number;
    is_verified?: boolean;
}

interface Recipe {
    id: string; // UUID
    title: string; // Changed from name to title to match backend
}

interface Unit {
    id: number;
    name: any;
    description: any;
}

export default function AdminIngredients() {
    const { t, i18n } = useTranslation();
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showMenu, setShowMenu] = useState(false);


    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadIngredients();
        loadRecipes();
        loadUnits();
    }, []);

    const loadIngredients = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/ingredients');
            if (Array.isArray(res.data)) {
                setIngredients(res.data);
            } else {
                console.error('Ingredients data is not an array:', res.data);
                setIngredients([]);
            }
        } catch (error) {
            console.error('Failed to load ingredients', error);
            setIngredients([]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadRecipes = async () => {
        try {
            const res = await api.get('/recipes', { params: { limit: 1000 } });
            if (res.data && Array.isArray(res.data.items)) {
                setRecipes(res.data.items);
            } else if (Array.isArray(res.data)) {
                setRecipes(res.data);
            } else {
                console.error('Recipes data format invalid:', res.data);
                setRecipes([]);
            }
        } catch (error) {
            console.error('Failed to load recipes', error);
            setRecipes([]);
        }
    };

    const loadUnits = async () => {
        try {
            const res = await api.get('/admin/units');
            if (Array.isArray(res.data)) {
                setUnits(res.data);
            } else {
                console.error('Units data is not an array:', res.data);
                setUnits([]);
            }
        } catch (error) {
            console.error('Failed to load units', error);
            setUnits([]);
        }
    };

    const getLocalizedName = (nameObj: any): string => {
        if (!nameObj) return '';
        if (typeof nameObj === 'string') return nameObj;

        const lang = i18n.language.split('-')[0] || 'en';
        let value = nameObj[lang] || nameObj['en'];

        // Handle nested singular/plural structure
        if (value && typeof value === 'object') {
            return value.singular || Object.values(value)[0] as string || '';
        }

        if (!value) {
            const values = Object.values(nameObj);
            if (values.length > 0) {
                const firstVal = values[0];
                if (typeof firstVal === 'object') {
                    return (firstVal as any).singular || '';
                }
                return String(firstVal);
            }
        }

        if (value === undefined || value === null) return '';
        return String(value);
    };

    const getUnitName = (unitId?: number) => {
        if (!unitId) return '-';
        const unit = units.find(u => u.id === unitId);
        if (!unit) return '-';

        // Reuse logic from AdminUnits but simplified
        const descObj = unit.description;
        if (!descObj) return '';
        if (typeof descObj === 'string') return descObj;
        const lang = i18n.language.split('-')[0];
        const val = descObj[lang] || descObj['en'] || Object.values(descObj)[0];
        return val ? String(val) : '';
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingId(null);
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/admin/ingredients/${id}`);
            loadIngredients();
            setShowDeleteModal(false);
            setDeletingId(null);
            toast.success(t('admin.delete_success'));
        } catch (error) {
            console.error('Failed to delete ingredient', error);
            toast.error(t('admin.delete_error'));
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await api.put(`/admin/ingredients/${id}/approve`);
            loadIngredients();
            toast.success(t('admin.approve_success'));
        } catch (error) {
            console.error('Failed to approve ingredient', error);
            toast.error(t('admin.approve_error'));
        }
    };

    const handleEdit = (ingredient: Ingredient) => {
        setEditingId(ingredient.id);
        setShowModal(true);
    };

    const handleCreate = () => {
        setEditingId(null);
        setShowModal(true);
    };



    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDeleteClick = (id: number) => {
        setDeletingId(id);
        setShowDeleteModal(true);
    };

    // Import/Export Handlers
    const handleExport = async () => {
        try {
            const response = await api.get('/admin/ingredients/export');
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json;charset=utf-8' });
            saveAs(blob, `ingredients_export_${dateStr}.json`);
            toast.success(t('admin.export_success'));
        } catch (error) {
            console.error('Export failed', error);
            toast.error(t('admin.export_error'));
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                await api.post('/admin/ingredients/bulk', data);
                toast.success(t('admin.import_success'));
                loadIngredients();
            } catch (error) {
                console.error('Import failed', error);
                toast.error(t('admin.import_error'));
            }
        };
        reader.readAsText(file);
    };

    // Filter ingredients based on search term
    const filteredIngredients = Array.isArray(ingredients) ? ingredients.filter(i => {
        if (!i) return false;
        const name = getLocalizedName(i.name).toLowerCase();
        return name.includes(searchTerm.toLowerCase());
    }) : [];

    // Pagination logic
    const totalItems = filteredIngredients.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedIngredients = filteredIngredients.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 backdrop-blur-sm">
                    <h2 className="font-semibold flex items-center gap-2 shrink-0">
                        <Search className="h-5 w-5" /> {t('admin.ingredients_title')}
                    </h2>
                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder={t('admin.search') || "Search..."}
                                className="w-full pl-9 h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus:bg-background"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto relative">
                            <div className="relative">
                                <button
                                    onClick={() => setShowMenu(!showMenu)}
                                    className="h-9 w-9 border rounded-md hover:bg-accent/50 flex items-center justify-center transition-colors bg-background/30"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>

                                {showMenu && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                        <div className="absolute right-0 top-full mt-2 w-48 rounded-md border bg-popover p-1 shadow-md z-20 animate-in fade-in zoom-in-95 duration-100">
                                            <label className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground cursor-pointer">
                                                <Upload className="h-4 w-4" />
                                                {t('admin.import')}
                                                <input
                                                    type="file"
                                                    accept=".json"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        handleImport(e);
                                                        setShowMenu(false);
                                                    }}
                                                />
                                            </label>
                                            <button
                                                onClick={() => {
                                                    handleExport();
                                                    setShowMenu(false);
                                                }}
                                                className="flex w-full items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground text-left"
                                            >
                                                <Download className="h-4 w-4" />
                                                {t('admin.export')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={handleCreate}
                                className="h-9 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center justify-center gap-2 text-sm font-medium transition-colors shadow-sm flex-1 sm:flex-none"
                            >
                                <Plus className="h-4 w-4" /> {t('admin.add_ingredient')}
                            </button>
                        </div>
                    </div>
                </div>

                <IngredientFormModal
                    isOpen={showModal}
                    onClose={handleCloseModal}
                    onSave={() => {
                        loadIngredients();
                        setShowModal(false);
                        toast.success(t('admin.save_success'));
                    }}
                    initialData={editingId ? ingredients.find(i => i.id === editingId) : undefined}
                    units={units}
                    recipes={recipes}
                />

                {showDeleteModal && (
                    <Modal title={t('admin.delete_ingredient') || "Delete Ingredient"} onClose={() => setShowDeleteModal(false)}>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertTriangle className="h-10 w-10" />
                                <p className="text-sm text-muted-foreground">
                                    {t('admin.delete_confirm') || "Are you sure? This cannot be undone."}
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                                >
                                    {t('admin.cancel')}
                                </button>
                                <button
                                    onClick={() => deletingId && handleDelete(deletingId)}
                                    className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t('admin.delete')}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                            <tr>
                                <th className="px-6 py-3">{t('admin.ingredient_name')}</th>
                                <th className="px-6 py-3">{t('admin.default_unit')}</th>
                                <th className="px-6 py-3">{t('admin.linked_recipe')}</th>
                                <th className="px-6 py-3">{t('admin.status')}</th>
                                <th className="px-6 py-3 text-right">{t('admin.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : ingredients.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {t('admin.no_ingredients')}
                                    </td>
                                </tr>
                            ) : (
                                paginatedIngredients.map((ingredient) => ingredient ? (
                                    <tr key={ingredient.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium">{getLocalizedName(ingredient.name)}</td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {getUnitName(ingredient.default_unit_id)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {recipes.find(r => r && r.id === ingredient.linked_recipe_id)?.title || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            {ingredient.is_verified ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                    <CheckCircle className="h-3 w-3" />
                                                    {t('verified')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                                                    {t('pending_approval')}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {!ingredient.is_verified && (
                                                    <button
                                                        onClick={() => handleApprove(ingredient.id)}
                                                        className="p-1.5 text-green-600 hover:bg-green-50/10 rounded-md transition-colors"
                                                        title={t('approve')}
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEdit(ingredient)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50/10 rounded-md transition-colors"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(ingredient.id)}
                                                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ) : null)
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="grid grid-cols-1 md:hidden divide-y divide-white/10">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
                    ) : ingredients.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">{t('admin.no_ingredients')}</div>
                    ) : (
                        paginatedIngredients.map((ingredient) => ingredient ? (
                            <div key={ingredient.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{getLocalizedName(ingredient.name)}</span>
                                    {ingredient.is_verified ? (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                                            <CheckCircle className="h-3 w-3" />
                                            {t('verified')}
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                                            {t('pending_approval')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>{t('admin.default_unit')}: {getUnitName(ingredient.default_unit_id)}</span>
                                    <span>{recipes.find(r => r && r.id === ingredient.linked_recipe_id)?.title || '-'}</span>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                                    {!ingredient.is_verified && (
                                        <button onClick={() => handleApprove(ingredient.id)} className="p-2 text-green-600 bg-green-50/10 rounded-md">
                                            <CheckCircle className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button onClick={() => handleEdit(ingredient)} className="p-2 text-blue-500 bg-blue-50/10 rounded-md">
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => handleDeleteClick(ingredient.id)} className="p-2 text-destructive bg-destructive/10 rounded-md">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ) : null)
                    )}
                </div>

                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalItems={totalItems}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(size) => {
                        setPageSize(size);
                        setCurrentPage(1);
                    }}
                />
            </div>
        </div>
    );
}
