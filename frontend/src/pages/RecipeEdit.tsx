import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api, RecipeCreate, Ingredient, Step } from '../lib/api';
import { Button } from '../components/ui/Button';
import { NumberInput } from '../components/ui/NumberInput';
import { PageHeader } from '../components/ui/PageHeader';
import { Loader2, Plus, Trash2, Save, Wand2, Check, Image as ImageIcon, ChefHat, Utensils, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { IngredientFormModal } from '../components/IngredientFormModal';
import { ImageUploadModal } from '../components/ImageUploadModal';
import { ImportProgressModal } from '../components/ImportProgressModal';
import { toast } from 'sonner';

import { useKeyboardSave } from '../hooks/useKeyboardSave';

export default function RecipeEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const isNew = !id;

    const { data: systemConfig } = useQuery({
        queryKey: ['systemConfig'],
        queryFn: async () => {
            const res = await api.get('/system/config');
            return res.data;
        }
    });

    const isAiEnabled = systemConfig?.enable_ai === true;



    const [formData, setFormData] = useState<RecipeCreate>({
        title: '',
        source_url: '',
        image_url: '',
        created_type: 'manual',
        type: 'baking',
        is_public: false,
        yield_amount: 1,
        weight_per_piece: undefined as number | undefined,
        reference_temperature: 20,
        chapters: [
            {
                name: 'Main Chapter',
                order_index: 0,
                ingredients: [],
                steps: []
            }
        ]
    });

    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importStatus, setImportStatus] = useState<'idle' | 'checking' | 'scraping' | 'analyzing' | 'completed' | 'error' | 'duplicate'>('idle');
    const [importError, setImportError] = useState<string | undefined>(undefined);
    const [reviewMode, setReviewMode] = useState(false);

    // Duplicate handling
    const [duplicateRecipeId, setDuplicateRecipeId] = useState<string | null>(null);
    const [redirectCountdown, setRedirectCountdown] = useState(5);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Success handling
    const [importedData, setImportedData] = useState<any>(null);

    const [availableIngredients, setAvailableIngredients] = useState<any[]>([]);
    const [availableUnits, setAvailableUnits] = useState<any[]>([]);
    const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);

    // Image Upload State
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);

    // Ingredient Creation Modal State
    const [showIngredientModal, setShowIngredientModal] = useState(false);
    const [pendingChapterIndex, setPendingChapterIndex] = useState<number | null>(null);
    const [pendingIngredientIndex, setPendingIngredientIndex] = useState<number | null>(null);
    const [pendingSearchTerm, setPendingSearchTerm] = useState('');

    // Combobox State
    const [openCombobox, setOpenCombobox] = useState<{ chapterIdx: number, ingIdx: number } | null>(null);
    const [comboboxSearch, setComboboxSearch] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [ingRes, unitRes, recipeRes] = await Promise.all([
                    api.get('/admin/ingredients'),
                    api.get('/admin/units'),
                    api.get('/recipes?limit=1000')
                ]);
                setAvailableIngredients(ingRes.data);
                setAvailableUnits(unitRes.data);
                // Handle paginated response for recipes
                const recipes = recipeRes.data.items ? recipeRes.data.items : (Array.isArray(recipeRes.data) ? recipeRes.data : []);
                setAvailableRecipes(recipes.filter((r: any) => r.id !== id));
            } catch (error) {
                console.error('Failed to load form data', error);
            }
        };
        loadData();
    }, [id]);

    const { data: existingRecipe, isLoading: isLoadingRecipe } = useQuery({
        queryKey: ['recipe', id],
        queryFn: async () => {
            if (isNew) return null;
            const res = await api.get(`/recipes/${id}`);
            const data = res.data;
            // Sort chapters by order_index
            if (data.chapters) {
                data.chapters.sort((a: any, b: any) => a.order_index - b.order_index);
                // Sort steps and ingredients if needed, though usually backend handles this or they are lists
                data.chapters.forEach((ch: any) => {
                    if (ch.steps) ch.steps.sort((a: any, b: any) => a.order_index - b.order_index);
                });
            }
            return data;
        },
        enabled: !isNew,
    });

    useEffect(() => {
        if (existingRecipe) {
            setFormData(existingRecipe);
        }
    }, [existingRecipe]);

    const createMutation = useMutation({
        mutationFn: (newRecipe: RecipeCreate) => api.post('/recipes/', newRecipe),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            toast.success(t('edit.save_success'));
            // Navigate to the new recipe
            const newId = (data as any).data?.id || (data as any).id;
            if (newId) {
                navigate(`/recipe/${newId}`);
            } else {
                navigate('/');
            }
        },
        onError: (error: any) => {
            console.error("Create recipe failed:", error.response?.data || error.message);
            const detail = error.response?.data?.detail;
            let errorMessage = "Create failed";

            if (Array.isArray(detail)) {
                // Pydantic validation error
                errorMessage = detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join('\n');
            } else if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage, { duration: 10000 }); // Long duration to read
        }
    });

    const importMutation = useMutation({
        mutationFn: async (url: string) => {
            setImportStatus('scraping');
            // Simulate progress for better UX
            await new Promise(resolve => setTimeout(resolve, 1500));
            setImportStatus('analyzing');

            return api.post('/import/url', {
                url,
                language: i18n.language.split('-')[0] // Send current language (e.g. 'de' or 'en')
            });
        },
        onSuccess: (data) => {
            setImportStatus('completed');

            // Process data
            const imported = data.data;
            if (!imported.chapters && (imported.ingredients || imported.steps)) {
                imported.chapters = [{
                    name: 'Imported Chapter',
                    order_index: 0,
                    ingredients: imported.ingredients || [],
                    steps: imported.steps || []
                }];
                delete imported.ingredients;
                delete imported.steps;
            }

            setImportedData(imported);
            setRedirectCountdown(5); // Reuse for success countdown

            // Start countdown
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = setInterval(() => {
                setRedirectCountdown((prev) => {
                    if (prev <= 1) return 0;
                    return prev - 1;
                });
            }, 1000);
        },
        onError: (error: any) => {
            if (error.response?.status === 409) {
                try {
                    const detail = JSON.parse(error.response.data.detail);
                    const recipeId = detail.recipe_id;

                    setImportStatus('duplicate');
                    setDuplicateRecipeId(recipeId);
                    setRedirectCountdown(5);
                    setIsImporting(true); // Ensure modal is open

                    // Clear any existing interval
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

                    countdownIntervalRef.current = setInterval(() => {
                        setRedirectCountdown((prev) => {
                            if (prev <= 1) {
                                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                                navigate(`/recipe/${recipeId}`);
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);

                    return;
                } catch (e) {
                    console.error("Failed to parse duplicate error", e);
                }
            }

            setImportStatus('error');
            setImportError(error.message || 'Import failed');
            // setIsImporting(false); // Keep open to show error
            toast.error(t('admin.import_error'));
        }
    });

    // Handle redirect when countdown hits 0 (Duplicate)
    useEffect(() => {
        if (redirectCountdown === 0 && duplicateRecipeId && importStatus === 'duplicate') {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            navigate(`/recipe/${duplicateRecipeId}`);
        }
    }, [redirectCountdown, duplicateRecipeId, importStatus, navigate]);

    // Handle success transition when countdown hits 0
    useEffect(() => {
        if (redirectCountdown === 0 && importStatus === 'completed' && importedData) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            // Apply data and switch mode
            setFormData(importedData);
            setReviewMode(true);
            setIsImporting(false);
            setImportedData(null);
        }
    }, [redirectCountdown, importStatus, importedData]);

    const handleImport = async () => {
        if (!importUrl) return;

        setIsImporting(true);
        setImportStatus('checking');
        setImportError(undefined);

        try {
            // Artificial delay to show "Checking" state
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Pre-check for duplicate
            const checkRes = await api.post<{ exists: boolean, recipe_id: string | null }>('/recipes/check-url', {
                url: importUrl
            });

            if (checkRes.data.exists && checkRes.data.recipe_id) {
                // Open duplicate warning in same modal
                setImportStatus('duplicate');
                setDuplicateRecipeId(checkRes.data.recipe_id);
                setRedirectCountdown(5);

                // Clear any existing interval
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

                countdownIntervalRef.current = setInterval(() => {
                    setRedirectCountdown((prev) => {
                        if (prev <= 1) return 0;
                        return prev - 1;
                    });
                }, 1000);
                return;
            }
        } catch (error) {
            console.error("Failed to check url", error);
            setImportStatus('error');
            setImportError(t('edit.check_failed', 'Failed to check for duplicates'));
            return;
        }

        // Proceed with import
        importMutation.mutate(importUrl);
    };

    const updateMutation = useMutation({
        mutationFn: (updatedRecipe: RecipeCreate) => api.put(`/recipes/${id}`, updatedRecipe),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            queryClient.invalidateQueries({ queryKey: ['recipe', id] });
            toast.success(t('edit.save_success'));
            navigate(`/recipe/${id}`);
        },
        onError: (error: any) => {
            console.error("Update recipe failed:", error.response?.data || error.message);
            const detail = error.response?.data?.detail;
            let errorMessage = "Update failed";

            if (Array.isArray(detail)) {
                errorMessage = detail.map((e: any) => `${e.loc.join('.')}: ${e.msg}`).join('\n');
            } else if (typeof detail === 'string') {
                errorMessage = detail;
            } else if (error.message) {
                errorMessage = error.message;
            }

            toast.error(errorMessage, { duration: 10000 });
        }
    });

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        let finalImageUrl = formData.image_url;

        if (imageFile) {
            try {

                const uploadData = new FormData();
                uploadData.append('file', imageFile);
                const res = await api.post('/upload', uploadData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                finalImageUrl = res.data.url;

            } catch (error) {
                console.error('Upload failed', error);
                toast.error('Image upload failed');

                return;
            }
        }

        const recipeData = { ...formData, image_url: finalImageUrl };

        if (isNew) {
            createMutation.mutate(recipeData);
        } else {
            updateMutation.mutate(recipeData);
        }
    };

    useKeyboardSave(() => handleSubmit());

    const handleIngredientSave = (newIngredient: any) => {
        // Add to available ingredients
        setAvailableIngredients(prev => [...prev, newIngredient]);

        // If we were searching for this ingredient in a specific row, select it there
        if (pendingChapterIndex !== null && pendingIngredientIndex !== null) {
            const chapterIdx = pendingChapterIndex;
            const ingIdx = pendingIngredientIndex;

            const newChapters = [...formData.chapters];
            const newIngredients = [...newChapters[chapterIdx].ingredients];

            const lang = i18n.language.split('-')[0];
            const unitNameObj = newIngredient.default_unit?.name;
            const unitName = unitNameObj?.[lang]?.singular || unitNameObj?.en?.singular || '';

            newIngredients[ingIdx] = {
                ...newIngredients[ingIdx],
                name: newIngredient.name,
                unit: unitName,
                linked_recipe_id: undefined
            };

            newChapters[chapterIdx] = { ...newChapters[chapterIdx], ingredients: newIngredients };
            setFormData(prev => ({ ...prev, chapters: newChapters }));
            setOpenCombobox(null);
        }

        setShowIngredientModal(false);
        setPendingChapterIndex(null);
        setPendingIngredientIndex(null);
        setPendingSearchTerm('');
    };

    const addChapter = () => {
        setFormData({
            ...formData,
            chapters: [
                ...formData.chapters,
                {
                    name: `Chapter ${formData.chapters.length + 1}`,
                    order_index: formData.chapters.length,
                    ingredients: [],
                    steps: []
                }
            ]
        });
    };

    const removeChapter = (index: number) => {
        const newChapters = [...formData.chapters];
        newChapters.splice(index, 1);
        setFormData({ ...formData, chapters: newChapters });
    };

    const updateChapterName = (index: number, name: string) => {
        const newChapters = [...formData.chapters];
        newChapters[index] = { ...newChapters[index], name };
        setFormData({ ...formData, chapters: newChapters });
    };

    const addIngredient = (chapterIdx: number) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].ingredients.push({ name: { en: '', de: '' }, amount: 0, unit: '', type: 'other' });
        setFormData({ ...formData, chapters: newChapters });

        // Focus the new row's combobox
        setTimeout(() => {
            setOpenCombobox({ chapterIdx, ingIdx: newChapters[chapterIdx].ingredients.length - 1 });
            setComboboxSearch('');
        }, 0);
    };

    const removeIngredient = (chapterIdx: number, ingIdx: number) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].ingredients.splice(ingIdx, 1);
        setFormData({ ...formData, chapters: newChapters });
    };

    const updateIngredient = (chapterIdx: number, ingIdx: number, field: keyof Ingredient, value: any) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].ingredients[ingIdx] = { ...newChapters[chapterIdx].ingredients[ingIdx], [field]: value };
        setFormData({ ...formData, chapters: newChapters });
    };

    const handleIngredientSelect = (chapterIdx: number, ingIdx: number, value: string) => {
        if (!value) return;

        const newChapters = [...formData.chapters];
        const newIngredients = [...newChapters[chapterIdx].ingredients];

        if (value.startsWith("recipe:")) {
            const recipeId = value.split(":")[1];
            const selectedRecipe = availableRecipes.find(r => r.id === recipeId);
            if (selectedRecipe) {
                newIngredients[ingIdx] = {
                    ...newIngredients[ingIdx],
                    name: { en: selectedRecipe.title, de: selectedRecipe.title },
                    unit: 'g',
                    linked_recipe_id: selectedRecipe.id,
                    type: 'other'
                };
            }
        } else {
            const selectedIng = availableIngredients.find(i => i.id.toString() === value);
            if (selectedIng) {
                const lang = i18n.language ? i18n.language.split('-')[0] : 'en';
                const unitNameObj = selectedIng.default_unit?.name;
                const unitName = unitNameObj?.[lang]?.singular || unitNameObj?.en?.singular || '';

                // Flatten name object for RecipeIngredient (simple Dict[str, str])
                const nameEn = selectedIng.name.en?.singular || selectedIng.name.en || '';
                const nameDe = selectedIng.name.de?.singular || selectedIng.name.de || '';

                newIngredients[ingIdx] = {
                    ...newIngredients[ingIdx],
                    name: { en: nameEn, de: nameDe },
                    unit: unitName,
                    linked_recipe_id: undefined
                };
            }
        }


        newChapters[chapterIdx] = { ...newChapters[chapterIdx], ingredients: newIngredients };
        setFormData({ ...formData, chapters: newChapters });
        setOpenCombobox(null);
    };

    const getLocalizedName = (nameObj: any, amount: number = 1) => {
        const lang = i18n.language ? i18n.language.split('-')[0] : 'en';
        const form = amount === 1 ? 'singular' : 'plural';

        if (typeof nameObj?.[lang] === 'string') return nameObj[lang];
        if (nameObj?.[lang]?.[form]) return nameObj[lang][form];
        if (nameObj?.[lang]?.singular) return nameObj[lang].singular;

        if (typeof nameObj?.en === 'string') return nameObj.en;
        if (nameObj?.en?.[form]) return nameObj.en[form];
        if (nameObj?.en?.singular) return nameObj.en.singular;

        return '';
    };

    const addStep = (chapterIdx: number) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].steps.push({
            order_index: newChapters[chapterIdx].steps.length + 1,
            description: '',
            duration_min: 0,
            type: 'active'
        });
        setFormData({ ...formData, chapters: newChapters });
    };

    const removeStep = (chapterIdx: number, stepIdx: number) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].steps.splice(stepIdx, 1);
        // Re-index
        newChapters[chapterIdx].steps.forEach((step, i) => step.order_index = i + 1);
        setFormData({ ...formData, chapters: newChapters });
    };

    const updateStep = (chapterIdx: number, stepIdx: number, field: keyof Step, value: any) => {
        const newChapters = [...formData.chapters];
        newChapters[chapterIdx].steps[stepIdx] = { ...newChapters[chapterIdx].steps[stepIdx], [field]: value };
        setFormData({ ...formData, chapters: newChapters });
    };

    if (isLoadingRecipe) return <div>Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <PageHeader
                title={id ? t('edit.edit_title') : t('edit.new_title')}
                showBack
                actions={
                    <Button onClick={() => handleSubmit()} disabled={createMutation.isPending || updateMutation.isPending}>
                        {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        {t('edit.save_btn')}
                    </Button>
                }
            />



            {isNew && (
                <div className={cn("bg-muted/50 p-6 rounded-lg border mb-8", !isAiEnabled && "opacity-75")}>
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Wand2 className={cn("h-5 w-5", isAiEnabled ? "text-purple-500" : "text-muted-foreground")} />
                        {t('edit.magic_import')}
                        {!isAiEnabled && <span className="text-xs font-normal text-muted-foreground ml-2">({t('edit.ai_disabled') || "AI Disabled"})</span>}
                    </h2>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            placeholder={t('edit.import_placeholder')}
                            className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            disabled={!isAiEnabled}
                        />
                        <Button
                            onClick={handleImport}
                            disabled={isImporting || !importUrl || !isAiEnabled}
                            className={cn("text-white", isAiEnabled ? "bg-purple-600 hover:bg-purple-700" : "bg-muted-foreground")}
                        >
                            {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                            {t('edit.import_btn')}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        {isAiEnabled ? t('edit.import_desc') : (t('edit.ai_disabled_desc') || "AI automation is currently disabled by the administrator.")}
                    </p>
                </div>
            )}

            {reviewMode && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                <span className="font-bold">{t('edit.review_required')}</span> {t('edit.review_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Basic Info */}
                {/* Basic Info */}
                <div className="glass-card p-6 rounded-xl space-y-6">
                    <h3 className="text-xl font-semibold">{t('edit.basic_info')}</h3>
                    <div className="grid gap-4">
                        <div>
                            <label className="text-sm font-medium">{t('edit.title_label')}</label>
                            <input
                                required
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-2 block">{t('recipe.type') || "Recipe Type"}</label>
                            <div className="flex gap-4">
                                <label className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                                    formData.type === 'baking' ? "bg-primary/10 border-primary text-primary" : "bg-background border-input hover:bg-muted"
                                )}>
                                    <input
                                        type="radio"
                                        name="recipeType"
                                        className="hidden"
                                        checked={formData.type === 'baking' || !formData.type}
                                        onChange={() => setFormData({ ...formData, type: 'baking' })}
                                    />
                                    <ChefHat className="w-4 h-4" />
                                    <span>{t('recipe.type.baking') || "Baking"}</span>
                                </label>
                                <label className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all",
                                    formData.type === 'cooking' ? "bg-primary/10 border-primary text-primary" : "bg-background border-input hover:bg-muted"
                                )}>
                                    <input
                                        type="radio"
                                        name="recipeType"
                                        className="hidden"
                                        checked={formData.type === 'cooking'}
                                        onChange={() => setFormData({ ...formData, type: 'cooking' })}
                                    />
                                    <Utensils className="w-4 h-4" />
                                    <span>{t('recipe.type.cooking') || "Cooking"}</span>
                                </label>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('recipe.portions') || "Portionen"}</label>
                                    <NumberInput
                                        min={1}
                                        className="bg-background/50 focus:bg-background transition-colors"
                                        value={formData.yield_amount}
                                        onChange={(val) => setFormData({ ...formData, yield_amount: val || 1 })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('recipe.weight_per_piece') || "Gewicht pro Stück (g)"} <span className="text-muted-foreground font-normal text-xs">(optional)</span></label>
                                    <NumberInput
                                        min={0}
                                        className="bg-background/50 focus:bg-background transition-colors"
                                        value={formData.weight_per_piece}
                                        onChange={(val) => setFormData({ ...formData, weight_per_piece: val })}
                                        placeholder="z.B. 80"
                                    />
                                </div>
                            </div>
                            {formData.type === 'baking' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('recipe.reference_temp') || "Referenztemperatur (°C)"}</label>
                                    <NumberInput
                                        className="bg-background/50 focus:bg-background transition-colors"
                                        value={formData.reference_temperature}
                                        onChange={(val) => setFormData({ ...formData, reference_temperature: val || 20 })}
                                    />
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">{t('edit.image_url_label')}</label>
                            <div className="flex gap-4 items-center">
                                {/* Preview */}
                                {(formData.image_url || imageFile) && (
                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                        <img
                                            src={imageFile ? URL.createObjectURL(imageFile) : formData.image_url}
                                            alt="Recipe"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                <Button
                                    type="button"
                                    variant={formData.image_url || imageFile ? "outline" : "default"}
                                    onClick={() => setShowImageModal(true)}
                                >
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    {formData.image_url || imageFile ? t('image.change') : t('image.add')}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Chapters */}
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-semibold">Chapters</h3>
                        <Button type="button" variant="ghost" onClick={addChapter} className="text-primary hover:text-primary/90 p-0 h-auto hover:bg-transparent">
                            <Plus className="h-4 w-4 mr-1" /> Add Chapter
                        </Button>
                    </div>

                    {formData.chapters.map((chapter, chapterIdx) => (
                        <div key={chapterIdx} className="glass-card p-6 rounded-xl space-y-6 relative">
                            <div className="flex justify-between items-center border-b pb-4">
                                <input
                                    className="text-lg font-semibold bg-transparent border-none focus:ring-0 p-0 w-full"
                                    value={chapter.name}
                                    onChange={(e) => updateChapterName(chapterIdx, e.target.value)}
                                    placeholder="Chapter Name"
                                />
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeChapter(chapterIdx)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Ingredients for Chapter */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm text-muted-foreground">{t('recipe.ingredients')}</h4>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => addIngredient(chapterIdx)} className="text-primary h-auto p-0 hover:bg-transparent hover:underline">
                                        <Plus className="h-3 w-3 mr-1" /> {t('edit.add_ingredient')}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {chapter.ingredients.map((ing, ingIdx) => {
                                        const getDisplayValue = () => {
                                            if (openCombobox?.chapterIdx === chapterIdx && openCombobox?.ingIdx === ingIdx) return comboboxSearch;
                                            if (typeof ing.name === 'string') return ing.name;
                                            return getLocalizedName(ing.name, 1);
                                        };

                                        return (
                                            <div key={ingIdx} className="flex gap-2 items-start">
                                                <NumberInput
                                                    placeholder={t('edit.amount')}
                                                    className="w-24"
                                                    value={ing.amount}
                                                    onChange={(val) => updateIngredient(chapterIdx, ingIdx, 'amount', val || 0)}
                                                />
                                                <div className="h-10 px-3 py-2 text-sm flex items-center bg-muted rounded-md min-w-[60px] justify-center text-muted-foreground">
                                                    {ing.unit || '-'}
                                                </div>
                                                {formData.type === 'baking' && (
                                                    <div className="relative w-24">
                                                        <NumberInput
                                                            placeholder="Temp"
                                                            className="pr-6"
                                                            value={ing.temperature}
                                                            onChange={(val) => updateIngredient(chapterIdx, ingIdx, 'temperature', val)}
                                                        />
                                                        <span className="absolute right-2 top-2.5 text-xs text-muted-foreground pointer-events-none">°C</span>
                                                    </div>
                                                )}
                                                <div className="flex-1 relative">
                                                    <div className="relative">
                                                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                        <input
                                                            ref={chapterIdx === formData.chapters.length - 1 && ingIdx === chapter.ingredients.length - 1 ? (el) => {
                                                                if (el && !ing.name.en && !ing.name.de && openCombobox?.chapterIdx === chapterIdx && openCombobox?.ingIdx === ingIdx) {
                                                                    el.focus();
                                                                }
                                                            } : null}
                                                            className="flex h-10 w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm"
                                                            placeholder={t('planer.choose_recipe') || "Select ingredient"}
                                                            value={getDisplayValue()}
                                                            onFocus={() => {
                                                                setOpenCombobox({ chapterIdx, ingIdx });
                                                                setComboboxSearch(typeof ing.name === 'string' ? ing.name : getLocalizedName(ing.name, 1));
                                                            }}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                if (openCombobox?.chapterIdx === chapterIdx && openCombobox?.ingIdx === ingIdx) {
                                                                    setComboboxSearch(val);
                                                                }
                                                                // Also update formData immediately to support "type and save"
                                                                updateIngredient(chapterIdx, ingIdx, 'name', { en: val, de: val });
                                                                // Default unit to 'g' if empty and user is typing
                                                                if (val && !ing.unit) {
                                                                    updateIngredient(chapterIdx, ingIdx, 'unit', 'g');
                                                                }
                                                            }}
                                                        />
                                                    </div>

                                                    {openCombobox?.chapterIdx === chapterIdx && openCombobox?.ingIdx === ingIdx && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setOpenCombobox(null)} />
                                                            <div className="absolute z-20 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md max-h-60 overflow-auto py-1">
                                                                {availableIngredients
                                                                    .filter(ai => {
                                                                        const name = getLocalizedName(ai.name, 1).toLowerCase();
                                                                        return name.includes(comboboxSearch.toLowerCase());
                                                                    })
                                                                    .map(ai => (
                                                                        <button
                                                                            key={ai.id}
                                                                            type="button"
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                                                                            onClick={() => handleIngredientSelect(chapterIdx, ingIdx, ai.id.toString())}
                                                                        >
                                                                            <span>{getLocalizedName(ai.name, 1)}</span>
                                                                            {ing.name.en === getLocalizedName(ai.name, 1) && <Check className="h-4 w-4" />}
                                                                        </button>
                                                                    ))}

                                                                {/* Recipes Section */}
                                                                {availableRecipes.length > 0 && <div className="px-2 py-1 text-xs font-semibold text-muted-foreground border-t mt-1">{t('dashboard.recipes') || "Recipes"}</div>}
                                                                {availableRecipes
                                                                    .filter(r => r.title.toLowerCase().includes(comboboxSearch.toLowerCase()))
                                                                    .map(r => (
                                                                        <button
                                                                            key={`recipe-${r.id}`}
                                                                            type="button"
                                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                                                                            onClick={() => handleIngredientSelect(chapterIdx, ingIdx, `recipe:${r.id}`)}
                                                                        >
                                                                            <span className="flex items-center gap-2">
                                                                                <ChefHat className="w-3 h-3 text-muted-foreground" />
                                                                                {r.title}
                                                                            </span>
                                                                            {ing.linked_recipe_id === r.id && <Check className="h-4 w-4" />}
                                                                        </button>
                                                                    ))}
                                                                {comboboxSearch && !availableIngredients.some(ai => getLocalizedName(ai.name, 1).toLowerCase() === comboboxSearch.toLowerCase()) && (
                                                                    <button
                                                                        type="button"
                                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-primary font-medium flex items-center gap-2 border-t"
                                                                        onClick={() => {
                                                                            setPendingChapterIndex(chapterIdx);
                                                                            setPendingIngredientIndex(ingIdx);
                                                                            setPendingSearchTerm(comboboxSearch);
                                                                            setShowIngredientModal(true);
                                                                            setOpenCombobox(null);
                                                                        }}
                                                                    >
                                                                        <Plus className="h-4 w-4" />
                                                                        {t('create_ingredient')} "{comboboxSearch}"
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => removeIngredient(chapterIdx, ingIdx)} className="text-destructive hover:bg-destructive/10 h-8 w-8">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Steps for Chapter */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-sm text-muted-foreground">{t('recipe.steps')}</h4>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => addStep(chapterIdx)} className="text-primary h-auto p-0 hover:bg-transparent hover:underline">
                                        <Plus className="h-3 w-3 mr-1" /> {t('edit.add_step')}
                                    </Button>
                                </div>
                                <div className="space-y-4">
                                    {chapter.steps.map((step, stepIdx) => (
                                        <div key={stepIdx} className="flex gap-2 items-start border-b pb-4 last:border-0">
                                            <div className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-sm font-bold shrink-0">
                                                {stepIdx + 1}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <textarea
                                                    placeholder={t('edit.step_desc')}
                                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={step.description}
                                                    onChange={(e) => updateStep(chapterIdx, stepIdx, 'description', e.target.value)}
                                                />
                                                <div className="flex gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs text-muted-foreground">{t('edit.duration')}</label>
                                                        <input
                                                            type="number"
                                                            className="w-24 h-8 rounded-md border border-input bg-background px-2 text-sm no-spinner"
                                                            onFocus={(e) => e.target.select()}
                                                            value={step.duration_min}
                                                            onChange={(e) => updateStep(chapterIdx, stepIdx, 'duration_min', parseInt(e.target.value))}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-xs text-muted-foreground">{t('edit.type')}</label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                            value={step.type}
                                                            onChange={e => updateStep(chapterIdx, stepIdx, 'type', e.target.value as any)}
                                                        >
                                                            <option value="active">{t('step.type.active')}</option>
                                                            <option value="passive">{t('step.type.passive')}</option>
                                                            <option value="baking">{t('step.type.baking')}</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(chapterIdx, stepIdx)} className="text-destructive hover:bg-destructive/10 h-8 w-8 self-center">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end">
                    {/* Save button moved to header */}
                </div>
            </form >

            {/* Create Ingredient Modal */}
            {/* Ingredient Form Modal */}
            <IngredientFormModal
                isOpen={showIngredientModal}
                onClose={() => {
                    setShowIngredientModal(false);
                    setPendingChapterIndex(null);
                    setPendingIngredientIndex(null);
                    setPendingSearchTerm('');
                }}
                onSave={handleIngredientSave}
                units={availableUnits}
                recipes={availableRecipes}
                initialData={pendingSearchTerm ? {
                    name: {
                        de: { singular: pendingSearchTerm, plural: pendingSearchTerm },
                        en: { singular: pendingSearchTerm, plural: pendingSearchTerm }
                    }
                } : undefined}
            />
            <ImageUploadModal
                isOpen={showImageModal}
                onClose={() => setShowImageModal(false)}
                currentImage={formData.image_url || (imageFile ? URL.createObjectURL(imageFile) : undefined)}
                onUpload={(file) => {
                    setImageFile(file);
                    setFormData({ ...formData, image_url: '' }); // Clear URL if file is uploaded
                }}
                onUrl={(url) => {
                    setFormData({ ...formData, image_url: url });
                    setImageFile(null); // Clear file if URL is set
                }}
                onRemove={() => {
                    setFormData({ ...formData, image_url: '' });
                    setImageFile(null);
                }}
            />

            <ImportProgressModal
                isOpen={isImporting}
                onClose={() => {
                    setIsImporting(false);
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                }}
                status={importStatus}
                error={importError}
                duplicateRecipeId={duplicateRecipeId}
                redirectCountdown={redirectCountdown}
                successCountdown={importStatus === 'completed' ? redirectCountdown : undefined}
                onRedirect={() => {
                    if (duplicateRecipeId) {
                        navigate(`/recipe/${duplicateRecipeId}`);
                    }
                }}
                onCancel={() => {
                    setIsImporting(false);
                    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                }}
            />
        </div >
    );
}
