import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Scale, Loader2, Save } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../lib/api';
import { useKeyboardSave } from '../hooks/useKeyboardSave';

interface Unit {
    id: number;
    name: any;
    description: any;
}



interface IngredientFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (ingredient: any) => void;
    initialData?: any; // If editing
    units: Unit[];
}

export const IngredientFormModal: React.FC<IngredientFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    units
}) => {
    const { t } = useTranslation();
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'de' | 'en'>('de');


    const [formData, setFormData] = useState({
        name_de_singular: '',
        name_de_plural: '',
        name_en_singular: '',
        name_en_plural: '',
        same_de: true,
        same_en: true,
        default_unit_id: undefined as number | undefined
    });

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Parse existing name object
                const nameObj = initialData.name || {};
                const de = nameObj.de || {};
                const en = nameObj.en || {};

                const deSingular = typeof de === 'string' ? de : (de.singular || '');
                const dePlural = typeof de === 'string' ? de : (de.plural || '');
                const enSingular = typeof en === 'string' ? en : (en.singular || '');
                const enPlural = typeof en === 'string' ? en : (en.plural || '');

                setFormData({
                    name_de_singular: deSingular,
                    name_de_plural: dePlural,
                    name_en_singular: enSingular,
                    name_en_plural: enPlural,
                    same_de: deSingular === dePlural,
                    same_en: enSingular === enPlural,
                    default_unit_id: initialData.default_unit_id
                });
            } else {
                // Reset
                setFormData({
                    name_de_singular: '',
                    name_de_plural: '',
                    name_en_singular: '',
                    name_en_plural: '',
                    same_de: true,
                    same_en: true,
                    default_unit_id: undefined
                });
            }
            setActiveTab('de');
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name_de_singular && !formData.name_en_singular) {
            toast.error(t('admin.error_name_required') || "Name is required in at least one language");
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: {
                    de: {
                        singular: formData.name_de_singular,
                        plural: formData.same_de ? formData.name_de_singular : (formData.name_de_plural || formData.name_de_singular)
                    },
                    en: {
                        singular: formData.name_en_singular || formData.name_de_singular,
                        plural: formData.same_en
                            ? (formData.name_en_singular || formData.name_de_singular)
                            : (formData.name_en_plural || formData.name_de_plural || formData.name_de_singular)
                    }
                },
                default_unit_id: formData.default_unit_id
            };

            let savedIngredient;
            if (initialData?.id) {
                const res = await api.put(`/admin/ingredients/${initialData.id}`, payload);
                savedIngredient = res.data;
            } else {
                const res = await api.post('/admin/ingredients', payload);
                savedIngredient = res.data;
            }

            onSave(savedIngredient);
            onClose();
        } catch (error) {
            console.error('Failed to save ingredient', error);
            toast.error(t('admin.save_error'));
        } finally {
            setIsSaving(false);
        }
    }

    useKeyboardSave(() => {
        if (!isSaving && (formData.name_de_singular || formData.name_en_singular)) {
            // Create a synthetic event
            const syntheticEvent = { preventDefault: () => { } } as React.FormEvent;
            handleSubmit(syntheticEvent);
        }
    });

    const getUnitName = (unitId?: number) => {
        if (!unitId) return '-';
        const unit = units.find(u => u.id === unitId);
        if (!unit) return '-';
        const descObj = unit.description;
        if (!descObj) return '';
        if (typeof descObj === 'string') return descObj;
        // @ts-ignore
        const val = descObj[activeTab] || descObj['en'] || Object.values(descObj)[0];
        return val ? String(val) : '';
    };

    if (!isOpen) return null;

    return (
        <Modal
            title={initialData ? t('admin.edit_ingredient') : t('admin.add_ingredient')}
            onClose={onClose}
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
                        <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="same_de"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.same_de}
                                    onChange={(e) => {
                                        setFormData({ ...formData, same_de: e.target.checked });

                                    }}
                                />
                                <label htmlFor="same_de" className="text-sm font-medium cursor-pointer">
                                    {t('admin.plural_same_as_singular') || "Singular = Plural"}
                                </label>
                            </div>

                            {formData.same_de ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('admin.ingredient')} (DE)</label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.name_de_singular}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name_de_singular: e.target.value });

                                        }}
                                        placeholder="z.B. Mehl"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('admin.ingredient_singular')} (DE)</label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={formData.name_de_singular}
                                            onChange={(e) => {
                                                setFormData({ ...formData, name_de_singular: e.target.value });

                                            }}
                                            placeholder="z.B. Ei"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('admin.ingredient_plural')} (DE)</label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={formData.name_de_plural}
                                            onChange={(e) => {
                                                setFormData({ ...formData, name_de_plural: e.target.value });

                                            }}
                                            placeholder="z.B. Eier"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'en' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
                            <div className="flex items-center gap-2 mb-2">
                                <input
                                    type="checkbox"
                                    id="same_en"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.same_en}
                                    onChange={(e) => {
                                        setFormData({ ...formData, same_en: e.target.checked });

                                    }}
                                />
                                <label htmlFor="same_en" className="text-sm font-medium cursor-pointer">
                                    {t('admin.plural_same_as_singular') || "Singular = Plural"}
                                </label>
                            </div>

                            {formData.same_en ? (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('admin.ingredient')} (EN)</label>
                                    <input
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={formData.name_en_singular}
                                        onChange={(e) => {
                                            setFormData({ ...formData, name_en_singular: e.target.value });

                                        }}
                                        placeholder="e.g. Flour"
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('admin.ingredient_singular')} (EN)</label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={formData.name_en_singular}
                                            onChange={(e) => {
                                                setFormData({ ...formData, name_en_singular: e.target.value });

                                            }}
                                            placeholder="e.g. Egg"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{t('admin.ingredient_plural')} (EN)</label>
                                        <input
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={formData.name_en_plural}
                                            onChange={(e) => {
                                                setFormData({ ...formData, name_en_plural: e.target.value });

                                            }}
                                            placeholder="e.g. Eggs"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Scale className="h-4 w-4" /> {t('admin.default_unit')}
                        </label>
                        <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={formData.default_unit_id || ''}
                            onChange={(e) => {
                                setFormData({ ...formData, default_unit_id: e.target.value ? Number(e.target.value) : undefined });

                            }}
                        >
                            <option value="">{t('common.none')}</option>
                            {units.map(unit => (
                                <option key={unit.id} value={unit.id}>
                                    {getUnitName(unit.id)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>


                <div className="flex justify-end gap-2 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 px-4 py-2 border rounded-md hover:bg-accent text-sm"
                    >
                        {t('admin.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || (!formData.name_de_singular && !formData.name_en_singular)}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {t('admin.save')}
                    </button>
                </div>
            </form>
        </Modal >
    );
};
