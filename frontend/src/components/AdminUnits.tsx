import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { saveAs } from 'file-saver';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Loader2, Edit2, Save, Scale, AlertTriangle, Upload, Download, Search, MoreHorizontal } from 'lucide-react';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

// Unit interface matching backend structure
interface Unit {
    id: number;
    name: any; // JSON object: {"en": {"singular": "g", "plural": "g"}}
    description: any; // JSON object: {"en": "Gram"}
}

export default function AdminUnits() {
    const { t, i18n } = useTranslation();
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState<'de' | 'en'>('de');

    const [formData, setFormData] = useState<{
        name_en: string;
        name_de: string;
        symbol_singular_en: string;
        symbol_plural_en: string;
        symbol_singular_de: string;
        symbol_plural_de: string;
        same_en: boolean;
        same_de: boolean;
    }>({
        name_en: '',
        name_de: '',
        symbol_singular_en: '',
        symbol_plural_en: '',
        symbol_singular_de: '',
        symbol_plural_de: '',
        same_en: true,
        same_de: true
    });

    useEffect(() => {
        loadUnits();
    }, []);

    const loadUnits = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/units');
            setUnits(res.data || []);
        } catch (error) {
            console.error('Failed to load units', error);
            setUnits([]);
        } finally {
            setIsLoading(false);
        }
    };

    const getLocalizedDescription = (descObj: any): string => {
        if (!descObj) return '';
        if (typeof descObj === 'string') return descObj;
        const lang = i18n.language.split('-')[0];
        const val = descObj[lang] || descObj['en'] || Object.values(descObj)[0];
        return val ? String(val) : '';
    };

    const getLocalizedSymbol = (nameObj: any, type: 'singular' | 'plural'): string => {
        if (!nameObj) return '';
        // Handle if nameObj is just a string (legacy/fallback)
        if (typeof nameObj === 'string') return nameObj;

        const lang = i18n.language.split('-')[0];
        const langObj = nameObj[lang] || nameObj['en'] || Object.values(nameObj)[0];
        if (!langObj) return '';
        if (typeof langObj === 'string') return langObj;
        return langObj[type] ? String(langObj[type]) : '';
    };

    const resetForm = () => {
        setFormData({
            name_en: '',
            name_de: '',
            symbol_singular_en: '',
            symbol_plural_en: '',
            symbol_singular_de: '',
            symbol_plural_de: '',
            same_en: true,
            same_de: true
        });
        setEditingId(null);
        setShowModal(false);
        setIsDirty(false);
        setShowDiscardModal(false);
    };

    const handleCloseModal = () => {
        if (isDirty) {
            setShowDiscardModal(true);
        } else {
            resetForm();
        }
    };

    const handleDiscardChanges = () => {
        setShowDiscardModal(false);
        resetForm();
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/admin/units/${id}`);
            loadUnits();
            setShowDeleteModal(false);
            setDeletingId(null);
            toast.success(t('admin.delete_success'));
        } catch (error) {
            console.error('Failed to delete unit', error);
            toast.error(t('admin.delete_error'));
        }
    };

    const handleEdit = (unit: Unit) => {
        setEditingId(unit.id);
        setFormData({
            name_en: unit.description?.en || '',
            name_de: unit.description?.de || '',
            symbol_singular_en: unit.name?.en?.singular || '',
            symbol_plural_en: unit.name?.en?.plural || '',
            symbol_singular_de: unit.name?.de?.singular || '',
            symbol_plural_de: unit.name?.de?.plural || '',
            same_en: (unit.name?.en?.singular || '') === (unit.name?.en?.plural || ''),
            same_de: (unit.name?.de?.singular || '') === (unit.name?.de?.plural || '')
        });
        setShowModal(true);
        setIsDirty(false);
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({
            name_en: '', name_de: '',
            symbol_singular_en: '', symbol_plural_en: '',
            symbol_singular_de: '', symbol_plural_de: '',
            same_en: true, same_de: true
        });
        setShowModal(true);
        setIsDirty(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name_en || !formData.symbol_singular_en) return;

        setIsCreating(true);
        try {
            const payload = {
                description: {
                    en: formData.name_en,
                    de: formData.name_de || formData.name_en
                },
                name: {
                    en: {
                        singular: formData.symbol_singular_en,
                        plural: formData.same_en ? formData.symbol_singular_en : (formData.symbol_plural_en || formData.symbol_singular_en)
                    },
                    de: {
                        singular: formData.symbol_singular_de || formData.symbol_singular_en,
                        plural: formData.same_de
                            ? (formData.symbol_singular_de || formData.symbol_singular_en)
                            : (formData.symbol_plural_de || formData.symbol_plural_en || formData.symbol_singular_en)
                    }
                }
            };

            if (editingId) {
                // For edit, we might want to merge with existing data, but we don't have it easily accessible here without fetching individual unit
                // So we'll just overwrite.
                await api.put(`/admin/units/${editingId}`, payload);
            } else {
                await api.post('/admin/units', payload);
            }
            resetForm();
            loadUnits();
            toast.success(t('admin.save_success'));
        } catch (error) {
            console.error('Failed to save unit', error);
            toast.error(t('admin.save_error'));
        } finally {
            setIsCreating(false);
        }
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
            const response = await api.get('/admin/units/export');
            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json;charset=utf-8' });
            saveAs(blob, `units_export_${dateStr}.json`);
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
                await api.post('/admin/units/bulk', data);
                toast.success(t('admin.import_success'));
                loadUnits();
            } catch (error) {
                console.error('Import failed', error);
                toast.error(t('admin.import_error'));
            }
        };
        reader.readAsText(file);
    };

    // Filter units based on search term
    const filteredUnits = units.filter(u => {
        const name = getLocalizedDescription(u.description).toLowerCase();
        const singular = getLocalizedSymbol(u.name, 'singular').toLowerCase();
        const plural = getLocalizedSymbol(u.name, 'plural').toLowerCase();
        const term = searchTerm.toLowerCase();

        return name.includes(term) || singular.includes(term) || plural.includes(term);
    });

    // Pagination logic
    const totalItems = filteredUnits.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedUnits = filteredUnits.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 bg-white/5 backdrop-blur-sm">
                    <h2 className="font-semibold flex items-center gap-2 shrink-0">
                        <Scale className="h-5 w-5" /> {t('admin.units_title')}
                    </h2>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="relative max-w-xs w-full">
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
                        <div className="flex items-center gap-2">
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
                                className="h-9 px-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors shadow-sm"
                            >
                                <Plus className="h-4 w-4" /> {t('admin.add_unit')}
                            </button>
                        </div>
                    </div>
                </div>

                {showModal && (
                    <Modal
                        title={editingId ? t('admin.edit_unit') : t('admin.add_unit')}
                        onClose={handleCloseModal}
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Language Tabs */}
                            <div className="flex border-b">
                                <button
                                    type="button"
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'de'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => setActiveTab('de')}
                                >
                                    Deutsch
                                </button>
                                <button
                                    type="button"
                                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'en'
                                        ? 'border-primary text-primary'
                                        : 'border-transparent text-muted-foreground hover:text-foreground'
                                        }`}
                                    onClick={() => setActiveTab('en')}
                                >
                                    English
                                </button>
                            </div>

                            <div className="pt-2">
                                {activeTab === 'de' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id="same_de"
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={formData.same_de}
                                                onChange={(e) => setFormData({ ...formData, same_de: e.target.checked })}
                                            />
                                            <label htmlFor="same_de" className="text-sm font-medium cursor-pointer">
                                                {t('admin.plural_same_as_singular') || "Singular = Plural"}
                                            </label>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">{t('admin.unit_full_name')}</label>
                                            <input
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={formData.name_de}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, name_de: e.target.value });
                                                    setIsDirty(true);
                                                }}
                                                placeholder="z.B. Gramm"
                                            />
                                        </div>

                                        {formData.same_de ? (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">{t('admin.unit_singular')}</label>
                                                <input
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.symbol_singular_de}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, symbol_singular_de: e.target.value });
                                                        setIsDirty(true);
                                                    }}
                                                    placeholder="z.B. g"
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">{t('admin.unit_singular')}</label>
                                                    <input
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                        value={formData.symbol_singular_de}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, symbol_singular_de: e.target.value });
                                                            setIsDirty(true);
                                                        }}
                                                        placeholder="z.B. g"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">{t('admin.unit_plural')}</label>
                                                    <input
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                        value={formData.symbol_plural_de}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, symbol_plural_de: e.target.value });
                                                            setIsDirty(true);
                                                        }}
                                                        placeholder="z.B. g"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {activeTab === 'en' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="checkbox"
                                                id="same_en"
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={formData.same_en}
                                                onChange={(e) => setFormData({ ...formData, same_en: e.target.checked })}
                                            />
                                            <label htmlFor="same_en" className="text-sm font-medium cursor-pointer">
                                                {t('admin.plural_same_as_singular') || "Singular = Plural"}
                                            </label>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">{t('admin.unit_full_name')}</label>
                                            <input
                                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                value={formData.name_en}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, name_en: e.target.value });
                                                    setIsDirty(true);
                                                }}
                                                placeholder="e.g. Gram"
                                            />
                                        </div>

                                        {formData.same_en ? (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">{t('admin.unit_singular')}</label>
                                                <input
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.symbol_singular_en}
                                                    onChange={(e) => {
                                                        setFormData({ ...formData, symbol_singular_en: e.target.value });
                                                        setIsDirty(true);
                                                    }}
                                                    placeholder="e.g. g"
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">{t('admin.unit_singular')}</label>
                                                    <input
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                        value={formData.symbol_singular_en}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, symbol_singular_en: e.target.value });
                                                            setIsDirty(true);
                                                        }}
                                                        placeholder="e.g. g"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-sm font-medium">{t('admin.unit_plural')}</label>
                                                    <input
                                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                        value={formData.symbol_plural_en}
                                                        onChange={(e) => {
                                                            setFormData({ ...formData, symbol_plural_en: e.target.value });
                                                            setIsDirty(true);
                                                        }}
                                                        placeholder="e.g. g"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="h-10 px-4 py-2 border rounded-md hover:bg-accent text-sm"
                                >
                                    {t('admin.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating || !formData.name_en || !formData.symbol_singular_en}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {t('admin.save')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}

                {showDeleteModal && (
                    <Modal title={t('admin.delete_unit') || "Delete Unit"} onClose={() => setShowDeleteModal(false)}>
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

                {showDiscardModal && (
                    <Modal title={t('admin.discard_changes_title') || "Discard changes?"} onClose={() => setShowDiscardModal(false)}>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertTriangle className="h-10 w-10" />
                                <p className="text-sm text-muted-foreground">
                                    {t('admin.discard_changes_confirm') || "You have unsaved changes. Are you sure you want to discard them?"}
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    onClick={() => setShowDiscardModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                                >
                                    {t('admin.keep_editing') || "Keep editing"}
                                </button>
                                <button
                                    onClick={handleDiscardChanges}
                                    className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t('admin.discard') || "Discard"}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                            <tr>
                                <th className="px-6 py-3">{t('admin.unit_name')}</th>
                                <th className="px-6 py-3">{t('admin.unit_singular')}</th>
                                <th className="px-6 py-3">{t('admin.unit_plural')}</th>
                                <th className="px-6 py-3 text-right">{t('admin.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                                        {t('common.loading')}
                                    </td>
                                </tr>
                            ) : units.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                                        {t('admin.no_units')}
                                    </td>
                                </tr>
                            ) : (
                                paginatedUnits.map((unit) => (
                                    <tr key={unit.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium">{getLocalizedDescription(unit.description)}</td>
                                        <td className="px-6 py-4">{getLocalizedSymbol(unit.name, 'singular')}</td>
                                        <td className="px-6 py-4">{getLocalizedSymbol(unit.name, 'plural')}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(unit)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50/10 rounded-md transition-colors"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(unit.id)}
                                                    className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
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
