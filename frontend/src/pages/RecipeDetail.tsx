import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Recipe } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Edit, Trash2, Clock, Users, ArrowLeft, Globe, ChefHat, Calendar, Heart, Star, StarHalf, Scale, Printer, Plus, X, Check, Search, Image as ImageIcon, Utensils } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Modal } from '../components/Modal';
import { IngredientFormModal } from '../components/IngredientFormModal';
import { ImageUploadModal } from '../components/ImageUploadModal';

import { useKeyboardSave } from '../hooks/useKeyboardSave';

export default function RecipeDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPlanningModal, setShowPlanningModal] = useState(false);
    const [showIngredientsModal, setShowIngredientsModal] = useState(false);

    const { data: recipe, isLoading } = useQuery({
        queryKey: ['recipe', id],
        queryFn: async () => {
            const res = await api.get(`/recipes/${id}`);
            return res.data as Recipe;
        },
    });

    const [currentYield, setCurrentYield] = useState<number>(1);

    useEffect(() => {
        if (recipe) setCurrentYield(recipe.yield_amount);
    }, [recipe]);

    const deleteMutation = useMutation({
        mutationFn: () => api.delete(`/recipes/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            navigate('/');
        },
    });

    const favoriteMutation = useMutation({
        mutationFn: () => api.post(`/recipes/${id}/favorite`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipe', id] });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    const rateMutation = useMutation({
        mutationFn: (score: number) => api.post(`/recipes/${id}/rate`, { score }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipe', id] });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
        },
    });

    const [isEditing, setIsEditing] = useState(false);
    const [editedRecipe, setEditedRecipe] = useState<Recipe | null>(null);

    useEffect(() => {
        if (recipe) {
            setEditedRecipe(JSON.parse(JSON.stringify(recipe)));
        }
    }, [recipe]);

    const updateMutation = useMutation({
        mutationFn: (updated: Recipe) => api.put(`/recipes/${id}`, updated),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipe', id] });
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            setIsEditing(false);
            toast.success(t('edit.save_success') || "Recipe saved successfully");
        },
        onError: () => {
            toast.error(t('edit.save_error') || "Failed to save recipe");
        }
    });

    const handleSave = async () => {
        if (editedRecipe) {
            let finalImageUrl = editedRecipe.image_url;

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

            updateMutation.mutate({ ...editedRecipe, image_url: finalImageUrl });
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (recipe) {
            setEditedRecipe(JSON.parse(JSON.stringify(recipe)));
        }
    };

    const [availableIngredients, setAvailableIngredients] = useState<any[]>([]);
    const [availableUnits, setAvailableUnits] = useState<any[]>([]);
    const [availableRecipes, setAvailableRecipes] = useState<any[]>([]);
    const [openCombobox, setOpenCombobox] = useState<{ chapterIdx: number, ingIdx: number } | null>(null);
    const [comboboxSearch, setComboboxSearch] = useState('');
    const [pendingChapterIndex, setPendingChapterIndex] = useState<number | null>(null);
    const [pendingIngredientIndex, setPendingIngredientIndex] = useState<number | null>(null);
    const [pendingSearchTerm, setPendingSearchTerm] = useState('');
    const [showCreateIngredientModal, setShowCreateIngredientModal] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);

    useEffect(() => {
        if (isEditing) {
            const loadData = async () => {
                try {
                    const [ingRes, unitRes, recipeRes] = await Promise.all([
                        api.get('/admin/ingredients'),
                        api.get('/admin/units'),
                        api.get('/recipes')
                    ]);
                    setAvailableIngredients(Array.isArray(ingRes.data) ? ingRes.data : []);
                    setAvailableUnits(Array.isArray(unitRes.data) ? unitRes.data : []);
                    const recipes = Array.isArray(recipeRes.data) ? recipeRes.data : [];
                    setAvailableRecipes(recipes.filter((r: any) => r.id !== id));
                } catch (error) {
                    console.error('Failed to load form data', error);
                }
            };
            loadData();
        }
    }, [isEditing, id]);

    useKeyboardSave(() => {
        if (isEditing) {
            handleSave();
        }
    });

    if (isLoading) return <div className="flex justify-center p-8">Loading...</div>;
    if (!recipe || !editedRecipe) return <div className="flex justify-center p-8">Recipe not found</div>;

    const isOwner = user?.id === recipe.user_id;
    const canEdit = isOwner || user?.role === 'admin' || user?.role === 'editor';

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

    const handleIngredientSelect = (chapterIdx: number, ingIdx: number, value: string) => {
        if (!value || !editedRecipe) return;

        const newChapters = [...editedRecipe.chapters];
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
        setEditedRecipe({ ...editedRecipe, chapters: newChapters });
        setOpenCombobox(null);
    };

    const handleIngredientSave = (newIngredient: any) => {
        if (!editedRecipe) return;
        // Add to available ingredients
        setAvailableIngredients(prev => [...prev, newIngredient]);

        // If we were searching for this ingredient in a specific row, select it there
        if (pendingChapterIndex !== null && pendingIngredientIndex !== null) {
            const chapterIdx = pendingChapterIndex;
            const ingIdx = pendingIngredientIndex;

            const newChapters = [...editedRecipe.chapters];
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
            setEditedRecipe(prev => prev ? { ...prev, chapters: newChapters } : null);
            setOpenCombobox(null);
        }

        setShowCreateIngredientModal(false);
        setPendingChapterIndex(null);
        setPendingIngredientIndex(null);
        setPendingSearchTerm('');
    };

    const getIngredientName = (ing: any) => {
        if (typeof ing.name === 'string') return ing.name;
        return ing.name[i18n.language] || ing.name['en'] || Object.values(ing.name)[0];
    };

    const scaleAmount = (amount: number) => {
        if (!recipe || !recipe.yield_amount) return amount;
        const scaled = (amount / recipe.yield_amount) * currentYield;
        return scaled.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
    };


    return (
        <div className="w-full space-y-8 pb-20">
            {/* Header / Actions */}
            <div className="flex justify-between items-center print:hidden">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="pl-0 hover:bg-transparent hover:text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {t('common.back') || "Back"}
                </Button>

                <div className="flex gap-2">
                    {!isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="glass"
                                onClick={() => setShowIngredientsModal(true)}
                            >
                                <ChefHat className="w-4 h-4 mr-2" />
                                {t('recipe.ingredients') || "Ingredients"}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="glass"
                                onClick={() => setShowPlanningModal(true)}
                            >
                                <Calendar className="w-4 h-4 mr-2" />
                                {t('recipe.planning_example') || "Planning Example"}
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="glass"
                                onClick={() => window.print()}
                            >
                                <Printer className="w-4 h-4 mr-2" />
                                {t('common.print') || "Print"}
                            </Button>

                            {canEdit && (
                                <>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="glass"
                                        onClick={() => setIsEditing(true)}
                                    >
                                        <Edit className="w-4 h-4 mr-2" />
                                        {t('common.edit') || "Edit"}
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setShowDeleteModal(true)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {t('common.delete') || "Delete"}
                                    </Button>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={handleCancel}>
                                {t('common.cancel') || "Cancel"}
                            </Button>
                            <Button onClick={handleSave} disabled={updateMutation.isPending}>
                                {updateMutation.isPending ? t('common.saving') || "Saving..." : t('common.save') || "Save"}
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Hero Section */}
            <div className="relative h-[400px] rounded-2xl overflow-hidden shadow-xl group">
                {isEditing && (
                    <div className="absolute top-4 left-4 z-30">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="shadow-lg bg-white/90 hover:bg-white text-black"
                            onClick={() => setShowImageModal(true)}
                        >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            {editedRecipe?.image_url ? (t('image.change') || "Change Image") : (t('image.add') || "Add Image")}
                        </Button>
                    </div>
                )}

                {(isEditing ? (imageFile ? URL.createObjectURL(imageFile) : editedRecipe?.image_url) : recipe.image_url) ? (
                    <img
                        src={isEditing ? (imageFile ? URL.createObjectURL(imageFile) : editedRecipe?.image_url) : recipe.image_url}
                        alt={recipe.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                        <ChefHat className="w-24 h-24 text-muted-foreground/20" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
                <div className="absolute bottom-0 left-0 p-6 md:p-10 w-full z-20">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                        <div className="space-y-4 max-w-2xl w-full">
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={editedRecipe?.title || ''}
                                    onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, title: e.target.value } : null)}
                                    className="w-full text-4xl md:text-5xl font-bold text-white bg-transparent border-b border-white/30 focus:border-white focus:outline-none placeholder:text-white/50"
                                    placeholder={t('edit.title_label') || "Recipe Title"}
                                />
                            ) : (
                                <h1 className="text-4xl md:text-5xl font-bold text-white shadow-sm leading-tight">
                                    {recipe.title}
                                </h1>
                            )}

                            <div className="flex flex-wrap gap-3 text-white/90 text-sm font-medium items-center">
                                <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                    <Users className="w-4 h-4" /> {recipe.author || "Unknown"}
                                </div>

                                {isEditing ? (
                                    <>
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                            {editedRecipe?.type === 'cooking' ? <Utensils className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
                                            <select
                                                value={editedRecipe?.type || 'baking'}
                                                onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, type: e.target.value as 'baking' | 'cooking' } : null)}
                                                className="bg-transparent border-none focus:outline-none text-white font-medium appearance-none cursor-pointer pr-2"
                                            >
                                                <option value="baking" className="text-black">{t('recipe.type.baking')}</option>
                                                <option value="cooking" className="text-black">{t('recipe.type.cooking')}</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                            <ChefHat className="w-4 h-4" />
                                            <input
                                                type="number"
                                                value={editedRecipe?.yield_amount || 1}
                                                onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, yield_amount: parseFloat(e.target.value) || 1 } : null)}
                                                className="w-16 bg-transparent border-b border-white/30 text-center focus:outline-none focus:border-white"
                                            />
                                            {t('recipe.portions') || "Portionen"}
                                        </div>
                                        {(editedRecipe?.type === 'baking' || !editedRecipe?.type) && (
                                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                                <Scale className="w-4 h-4" />
                                                <input
                                                    type="number"
                                                    value={editedRecipe?.weight_per_piece || ''}
                                                    onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, weight_per_piece: parseFloat(e.target.value) || undefined } : null)}
                                                    className="w-16 bg-transparent border-b border-white/30 text-center focus:outline-none focus:border-white"
                                                    placeholder="0"
                                                />
                                                g/Stk
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 w-full md:w-auto">
                                            <Globe className="w-4 h-4" />
                                            <input
                                                type="text"
                                                value={editedRecipe?.source_url || ''}
                                                onChange={(e) => setEditedRecipe(prev => prev ? { ...prev, source_url: e.target.value } : null)}
                                                className="bg-transparent border-b border-white/30 focus:outline-none focus:border-white flex-1 min-w-[200px]"
                                                placeholder={t('recipe.source_url') || "Source URL"}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                            {recipe.type === 'cooking' ? <Utensils className="w-4 h-4" /> : <ChefHat className="w-4 h-4" />}
                                            {recipe.type === 'cooking' ? (t('recipe.type.cooking') || "Kochen") : (t('recipe.type.baking') || "Backen")}
                                        </div>
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                            <Users className="w-4 h-4" /> {recipe.yield_amount} {t('recipe.portions') || "Portionen"}
                                        </div>
                                        {!!recipe.weight_per_piece && (recipe.type === 'baking' || !recipe.type) && (
                                            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                                <Scale className="w-4 h-4" /> {recipe.weight_per_piece} g/Stk
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                            <div className="flex items-center">
                                                {[1, 2, 3, 4, 5].map((star) => {
                                                    const rating = recipe.average_rating || 0;
                                                    let StarIcon = Star;
                                                    let className = "w-3 h-3 text-white/30";
                                                    if (rating >= star) className = "w-3 h-3 fill-yellow-400 text-yellow-400";
                                                    else if (rating >= star - 0.5) { StarIcon = StarHalf; className = "w-3 h-3 fill-yellow-400 text-yellow-400"; }
                                                    return <button key={star} onClick={() => rateMutation.mutate(star)}><StarIcon className={className} /></button>;
                                                })}
                                            </div>
                                            <span className="font-bold">{recipe.average_rating?.toFixed(1) || "0.0"}</span>
                                            <span className="text-xs opacity-70">({recipe.rating_count})</span>
                                        </div>
                                        {recipe.source_url && (
                                            <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 hover:bg-white/20 transition-colors">
                                                <Globe className="w-4 h-4" /> {t('recipe.source')}
                                            </a>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        {!isEditing && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); favoriteMutation.mutate(); }}
                                className="text-white hover:bg-white/20 rounded-full h-12 w-12 shrink-0"
                            >
                                <Heart className={`w-8 h-8 ${recipe.is_favorited ? 'fill-red-500 text-red-500' : ''}`} />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="space-y-8">
                {/* Main Content: Chapters & Steps */}
                <div className="space-y-8">
                    {/* Portion Control */}
                    {!isEditing && (
                        <div className="flex justify-center mb-4">
                            <div className="glass-card px-6 py-3 rounded-full flex items-center gap-4 shadow-sm">
                                <span className="text-sm font-medium text-muted-foreground">{t('recipe.for') || "Für"}</span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setCurrentYield(Math.max(0.1, currentYield - 0.5))}
                                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                    >
                                        -
                                    </button>
                                    <div className="flex items-center gap-1 min-w-[3rem] justify-center">
                                        <input
                                            type="number"
                                            min="0.1"
                                            step="0.1"
                                            className="w-12 bg-transparent text-center font-bold text-lg focus:outline-none no-spinner"
                                            value={currentYield}
                                            onChange={(e) => setCurrentYield(parseFloat(e.target.value) || 0)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => setCurrentYield(currentYield + 0.5)}
                                        className="w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                                    >
                                        +
                                    </button>
                                </div>
                                <span className="text-sm font-medium text-muted-foreground">{t('recipe.portions') || "Portionen"}</span>
                            </div>
                        </div>
                    )}

                    {(isEditing ? editedRecipe?.chapters : recipe.chapters)?.sort((a, b) => a.order_index - b.order_index).map((chapter, idx) => (
                        <div key={idx} className="glass-card rounded-xl p-6 md:p-8 relative group/chapter">
                            {isEditing && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 opacity-0 group-hover/chapter:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                        if (!editedRecipe) return;
                                        const newChapters = [...editedRecipe.chapters];
                                        newChapters.splice(idx, 1);
                                        setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}

                            <div className="mb-6 flex items-center gap-3">
                                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm shrink-0">
                                    {idx + 1}
                                </span>
                                {isEditing ? (
                                    <input
                                        value={chapter.name}
                                        onChange={(e) => {
                                            if (!editedRecipe) return;
                                            const newChapters = [...editedRecipe.chapters];
                                            newChapters[idx] = { ...newChapters[idx], name: e.target.value };
                                            setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                        }}
                                        className="text-2xl font-bold bg-transparent border-b border-border focus:border-primary focus:outline-none w-full"
                                        placeholder="Chapter Name"
                                    />
                                ) : (
                                    <h2 className="text-2xl font-bold">{chapter.name}</h2>
                                )}
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Chapter Ingredients */}
                                <div>
                                    <h3 className="font-medium mb-4 text-muted-foreground uppercase text-xs tracking-wider flex items-center gap-2">
                                        <ChefHat className="w-3 h-3" /> {t('recipe.ingredients')}
                                    </h3>
                                    <ul className="space-y-3">
                                        {chapter.ingredients.map((ing, i) => (
                                            <li key={i} className="text-sm group">
                                                {isEditing ? (
                                                    <div className="flex items-start gap-2">
                                                        <div className="grid grid-cols-[1fr_1fr_2fr] gap-2 flex-1">
                                                            <input
                                                                type="number"
                                                                value={ing.amount}
                                                                onChange={(e) => {
                                                                    if (!editedRecipe) return;
                                                                    const newChapters = [...editedRecipe.chapters];
                                                                    newChapters[idx].ingredients[i].amount = parseFloat(e.target.value) || 0;
                                                                    setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                }}
                                                                className="w-full bg-muted/50 rounded px-2 py-1 border border-transparent focus:border-primary focus:outline-none"
                                                                placeholder="Amount"
                                                            />
                                                            <input
                                                                value={ing.unit}
                                                                onChange={(e) => {
                                                                    if (!editedRecipe) return;
                                                                    const newChapters = [...editedRecipe.chapters];
                                                                    newChapters[idx].ingredients[i].unit = e.target.value;
                                                                    setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                }}
                                                                className="w-full bg-muted/50 rounded px-2 py-1 border border-transparent focus:border-primary focus:outline-none"
                                                                placeholder="Unit"
                                                            />
                                                            <div className="relative w-full">
                                                                <div className="relative">
                                                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                                                    <input
                                                                        value={openCombobox?.chapterIdx === idx && openCombobox?.ingIdx === i ? comboboxSearch : (typeof ing.name === 'string' ? ing.name : getLocalizedName(ing.name, 1))}
                                                                        onFocus={() => {
                                                                            setOpenCombobox({ chapterIdx: idx, ingIdx: i });
                                                                            setComboboxSearch(typeof ing.name === 'string' ? ing.name : getLocalizedName(ing.name, 1));
                                                                        }}
                                                                        onChange={(e) => {
                                                                            const val = e.target.value;
                                                                            if (openCombobox?.chapterIdx === idx && openCombobox?.ingIdx === i) {
                                                                                setComboboxSearch(val);
                                                                            }

                                                                            if (!editedRecipe) return;
                                                                            const newChapters = [...editedRecipe.chapters];

                                                                            // Always update as object since API requires it
                                                                            const lang = i18n.language;
                                                                            const currentName = newChapters[idx].ingredients[i].name;
                                                                            newChapters[idx].ingredients[i].name = {
                                                                                ...currentName,
                                                                                [lang]: val
                                                                            };
                                                                            setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                        }}
                                                                        className="w-full bg-muted/50 rounded pl-8 pr-3 py-1 border border-transparent focus:border-primary focus:outline-none"
                                                                        placeholder="Name"
                                                                    />
                                                                </div>

                                                                {openCombobox?.chapterIdx === idx && openCombobox?.ingIdx === i && (
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
                                                                                        onClick={() => handleIngredientSelect(idx, i, ai.id.toString())}
                                                                                    >
                                                                                        <span>{getLocalizedName(ai.name, 1)}</span>
                                                                                        {getLocalizedName(ing.name, 1) === getLocalizedName(ai.name, 1) && <Check className="h-4 w-4" />}
                                                                                    </button>
                                                                                ))}
                                                                            {comboboxSearch && !availableIngredients.some(ai => getLocalizedName(ai.name, 1).toLowerCase() === comboboxSearch.toLowerCase()) && (
                                                                                <button
                                                                                    type="button"
                                                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-primary font-medium flex items-center gap-2 border-t"
                                                                                    onClick={() => {
                                                                                        setPendingChapterIndex(idx);
                                                                                        setPendingIngredientIndex(i);
                                                                                        setPendingSearchTerm(comboboxSearch);
                                                                                        setShowCreateIngredientModal(true);
                                                                                        setOpenCombobox(null);
                                                                                    }}
                                                                                >
                                                                                    <Plus className="h-4 w-4" />
                                                                                    {t('create_ingredient') || "Create"} "{comboboxSearch}"
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                            onClick={() => {
                                                                if (!editedRecipe) return;
                                                                const newChapters = [...editedRecipe.chapters];
                                                                newChapters[idx].ingredients.splice(i, 1);
                                                                setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center">
                                                        <span className="group-hover:text-primary transition-colors">
                                                            {ing.linked_recipe_id ? (
                                                                <Link to={`/recipe/${ing.linked_recipe_id}`} className="hover:underline flex items-center gap-1">
                                                                    {getIngredientName(ing)}
                                                                    <ArrowLeft className="w-3 h-3 rotate-180 opacity-50" />
                                                                </Link>
                                                            ) : (
                                                                getIngredientName(ing)
                                                            )}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-mono font-medium">
                                                                {scaleAmount(ing.amount)} {ing.unit}
                                                            </span>
                                                            {(recipe.type === 'baking' || !recipe.type) && !!ing.temperature && (
                                                                <span className="bg-muted px-1.5 py-0.5 rounded text-xs text-muted-foreground">
                                                                    {ing.temperature}°C
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                        {chapter.ingredients.length === 0 && !isEditing && (
                                            <li className="text-muted-foreground italic text-sm">No ingredients</li>
                                        )}
                                        {isEditing && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full mt-2 border-dashed text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                    if (!editedRecipe) return;
                                                    const newChapters = [...editedRecipe.chapters];
                                                    newChapters[idx].ingredients.push({
                                                        name: { en: '', de: '' },
                                                        amount: 0,
                                                        unit: 'g',
                                                        type: 'other'
                                                    });
                                                    setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                }}
                                            >
                                                <Plus className="w-3 h-3 mr-2" /> {t('common.add') || "Add"}
                                            </Button>
                                        )}
                                    </ul>
                                </div>

                                {/* Chapter Steps */}
                                <div>
                                    <h3 className="font-medium mb-4 text-muted-foreground uppercase text-xs tracking-wider flex items-center gap-2">
                                        <Clock className="w-3 h-3" /> {t('recipe.steps')}
                                    </h3>
                                    <div className={`space-y-6 relative ${!isEditing ? 'before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border/50' : ''}`}>
                                        {chapter.steps.sort((a, b) => a.order_index - b.order_index).map((step, i) => (
                                            <div key={i} className={`relative ${!isEditing ? 'pl-8' : ''}`}>
                                                {!isEditing && (
                                                    <div className="absolute left-0 top-0 w-6 h-6 rounded-full bg-background border-2 border-primary/20 text-xs font-medium flex items-center justify-center z-10">
                                                        {i + 1}
                                                    </div>
                                                )}

                                                {isEditing ? (
                                                    <div className="flex gap-2 items-start bg-muted/30 p-3 rounded-lg border border-transparent hover:border-border/50 transition-colors">
                                                        <div className="flex-1 space-y-2">
                                                            <textarea
                                                                value={step.description}
                                                                onChange={(e) => {
                                                                    if (!editedRecipe) return;
                                                                    const newChapters = [...editedRecipe.chapters];
                                                                    newChapters[idx].steps[i].description = e.target.value;
                                                                    setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                }}
                                                                className="w-full bg-background rounded px-3 py-2 text-sm border border-input focus:border-primary focus:outline-none min-h-[60px]"
                                                                placeholder="Step description..."
                                                            />
                                                            <div className="flex items-center gap-2">
                                                                <Clock className="w-3 h-3 text-muted-foreground" />
                                                                <input
                                                                    type="number"
                                                                    value={step.duration_min}
                                                                    onChange={(e) => {
                                                                        if (!editedRecipe) return;
                                                                        const newChapters = [...editedRecipe.chapters];
                                                                        newChapters[idx].steps[i].duration_min = parseFloat(e.target.value) || 0;
                                                                        setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                    }}
                                                                    className="w-20 bg-background rounded px-2 py-1 text-xs border border-input focus:border-primary focus:outline-none"
                                                                    placeholder="Min"
                                                                />
                                                                <span className="text-xs text-muted-foreground">min</span>

                                                                <select
                                                                    value={step.type}
                                                                    onChange={(e) => {
                                                                        if (!editedRecipe) return;
                                                                        const newChapters = [...editedRecipe.chapters];
                                                                        newChapters[idx].steps[i].type = e.target.value as any;
                                                                        setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                                    }}
                                                                    className="bg-background rounded px-2 py-1 text-xs border border-input focus:border-primary focus:outline-none ml-auto"
                                                                >
                                                                    <option value="active">Active</option>
                                                                    <option value="passive">Passive</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                                            onClick={() => {
                                                                if (!editedRecipe) return;
                                                                const newChapters = [...editedRecipe.chapters];
                                                                newChapters[idx].steps.splice(i, 1);
                                                                setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                            }}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p className="text-sm leading-relaxed text-foreground/90">{step.description}</p>
                                                        {step.duration_min > 0 && (
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2 font-medium">
                                                                <Clock className="w-3 h-3" />
                                                                <span>{step.duration_min} min</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {chapter.steps.length === 0 && !isEditing && (
                                            <div className="text-muted-foreground italic text-sm pl-8">No steps</div>
                                        )}
                                        {isEditing && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full mt-2 border-dashed text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                    if (!editedRecipe) return;
                                                    const newChapters = [...editedRecipe.chapters];
                                                    newChapters[idx].steps.push({
                                                        description: '',
                                                        duration_min: 0,
                                                        type: 'active',
                                                        order_index: newChapters[idx].steps.length
                                                    });
                                                    setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                                                }}
                                            >
                                                <Plus className="w-3 h-3 mr-2" /> {t('common.add') || "Add"}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {isEditing && (
                        <Button
                            variant="outline"
                            className="w-full py-8 border-dashed text-muted-foreground hover:text-primary text-lg"
                            onClick={() => {
                                if (!editedRecipe) return;
                                const newChapters = [...editedRecipe.chapters];
                                newChapters.push({
                                    name: `Chapter ${newChapters.length + 1}`,
                                    ingredients: [],
                                    steps: [],
                                    order_index: newChapters.length
                                });
                                setEditedRecipe({ ...editedRecipe, chapters: newChapters });
                            }}
                        >
                            <Plus className="w-5 h-5 mr-2" /> {t('common.add_chapter') || "Add Chapter"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Delete Modal */}
            {showDeleteModal && (
                <Modal
                    title={t('common.delete_confirm_title') || "Delete Recipe?"}
                    onClose={() => setShowDeleteModal(false)}
                >
                    <p className="mb-6 text-muted-foreground">
                        {t('common.delete_confirm_desc') || "Are you sure you want to delete this recipe? This action cannot be undone."}
                    </p>
                    <div className="flex justify-end gap-3">
                        <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
                            {t('common.cancel') || "Cancel"}
                        </Button>
                        <Button variant="destructive" onClick={() => deleteMutation.mutate()}>
                            {t('common.delete') || "Delete"}
                        </Button>
                    </div>
                </Modal>
            )}

            {/* Planning Modal */}
            {showPlanningModal && (
                <PlanningModal
                    recipe={recipe}
                    onClose={() => setShowPlanningModal(false)}
                />
            )}

            {/* Ingredients Modal */}
            {showIngredientsModal && (
                <IngredientOverviewModal
                    recipe={recipe}
                    currentYield={currentYield}
                    onClose={() => setShowIngredientsModal(false)}
                />
            )}
            {/* Ingredient Form Modal */}
            <IngredientFormModal
                isOpen={showCreateIngredientModal}
                onClose={() => {
                    setShowCreateIngredientModal(false);
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
            {/* Image Upload Modal */}
            <ImageUploadModal
                isOpen={showImageModal}
                onClose={() => setShowImageModal(false)}
                onUpload={(file) => {
                    setImageFile(file);
                    // Clear URL if file is selected, or keep it?
                    // Usually file takes precedence.
                    // We can also clear the editedRecipe.image_url to reflect that a new file is pending
                    // But we might want to keep it as fallback.
                    // Let's just set the file.
                }}
                onUrl={(url) => {
                    setImageFile(null);
                    setEditedRecipe(prev => prev ? { ...prev, image_url: url } : null);
                }}
                onRemove={() => {
                    setImageFile(null);
                    setEditedRecipe(prev => prev ? { ...prev, image_url: '' } : null);
                }}
                currentImage={imageFile ? URL.createObjectURL(imageFile) : editedRecipe?.image_url}
            />
        </div>
    );
}

function PlanningModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [timeMode, setTimeMode] = useState<'start' | 'end'>('end');
    const [timeValue, setTimeValue] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    const [realTemperature, setRealTemperature] = useState<number>(recipe.reference_temperature || 20);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    // Calculate Schedule
    const calculateSchedule = () => {
        if (!recipe.chapters || recipe.chapters.length === 0) return [];

        const chapters = [...recipe.chapters].sort((a, b) => a.order_index - b.order_index);
        const mainChapter = chapters[chapters.length - 1];
        const preChapters = chapters.slice(0, chapters.length - 1);

        const getAdjustedDuration = (step: any) => {
            if (step.type !== 'passive') return step.duration_min;
            const refTemp = recipe.reference_temperature || 20;
            const factor = Math.pow(0.5, (realTemperature - refTemp) / 5);
            return Math.round(step.duration_min * factor);
        };

        const getDuration = (c: any) => c.steps.reduce((acc: number, s: any) => acc + getAdjustedDuration(s), 0);
        const preDurations = preChapters.map(c => getDuration(c));
        const maxPreDuration = Math.max(0, ...preDurations);
        const mainDuration = getDuration(mainChapter);

        // Calculate Anchor Points
        // If Start Mode: Start Time is the start of the process.
        // If End Mode: End Time is the end of the main chapter.

        let startTime: Date;
        let mergeTime: Date;

        if (timeMode === 'start') {
            startTime = new Date(timeValue);
            mergeTime = new Date(startTime.getTime() + maxPreDuration * 60000);
        } else {
            // End Mode
            const endTime = new Date(timeValue);
            mergeTime = new Date(endTime.getTime() - mainDuration * 60000);
            startTime = new Date(mergeTime.getTime() - maxPreDuration * 60000);
        }

        const schedule: any[] = [];

        // Schedule Pre-Chapters
        preChapters.forEach((chapter) => {
            const duration = getDuration(chapter);
            // Start such that it finishes at mergeTime
            let current = new Date(mergeTime.getTime() - duration * 60000);

            const sortedSteps = [...chapter.steps].sort((a, b) => a.order_index - b.order_index);

            sortedSteps.forEach((step: any) => {
                const stepDuration = getAdjustedDuration(step);
                schedule.push({
                    time: new Date(current),
                    description: `${chapter.name}: ${step.description}`,
                    chapter: chapter.name,
                    originalDuration: step.duration_min,
                    adjustedDuration: stepDuration,
                    isPassive: step.type === 'passive'
                });
                current = new Date(current.getTime() + stepDuration * 60000);
            });
        });

        // Schedule Main Chapter
        let current = new Date(mergeTime);
        const sortedMainSteps = [...mainChapter.steps].sort((a, b) => a.order_index - b.order_index);
        sortedMainSteps.forEach((step: any) => {
            const stepDuration = getAdjustedDuration(step);
            schedule.push({
                time: new Date(current),
                description: `${mainChapter.name}: ${step.description}`,
                chapter: mainChapter.name,
                originalDuration: step.duration_min,
                adjustedDuration: stepDuration,
                isPassive: step.type === 'passive'
            });
            current = new Date(current.getTime() + stepDuration * 60000);
        });

        return schedule.sort((a, b) => a.time.getTime() - b.time.getTime());
    };

    const schedule = calculateSchedule();

    // Calculate Total Duration
    let totalDurationText = "";
    if (schedule.length > 0) {
        const firstStart = schedule[0].time;
        const lastItem = schedule[schedule.length - 1];
        const diff = (lastItem.time.getTime() + lastItem.adjustedDuration * 60000) - firstStart.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        totalDurationText = `${hours} h ${minutes} min`;
    }

    const addToPlanMutation = useMutation({
        mutationFn: async () => {
            // We need to determine the target_time for the API.
            // The API expects target_time. In the backend logic (Planer.tsx analysis),
            // it seems target_time is often treated as the END time or the Anchor time.
            // However, looking at Planer.tsx:133, targetTime is parsed.
            // And Planer.tsx:152: let currentTime = targetTime; then it works backwards.
            // So target_time SHOULD BE THE END TIME of the baking process.

            let targetTime: Date;
            if (timeMode === 'end') {
                targetTime = new Date(timeValue);
            } else {
                // If start mode, we need to calculate the end time
                if (schedule.length === 0) return;
                const lastItem = schedule[schedule.length - 1];
                targetTime = new Date(lastItem.time.getTime() + lastItem.adjustedDuration * 60000);
            }

            const payload = {
                recipe_id: recipe.id,
                event_type: 'baking',
                target_time: targetTime.toISOString(),
                start_time: targetTime.toISOString(), // Backend seems to use these interchangeably or one as fallback
                real_temperature: realTemperature
            };

            await api.post('/schedules', payload);
        },
        onSuccess: () => {
            toast.success(t('planer.add_success') || "Added to plan");
            onClose();
            navigate('/planer');
        },
        onError: () => {
            toast.error(t('planer.add_error') || "Failed to add to plan");
        }
    });

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background border border-border w-full max-w-2xl rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        {t('recipe.planning_example') || "Planning Example"}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6 overflow-y-auto flex-1 pr-2">
                    {/* Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-lg border">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-muted-foreground">
                                    {timeMode === 'end' ? (t('planer.target_time_label') || "Target Time") : (t('planer.start_time_label') || "Start Time")}
                                </label>
                                <div
                                    className="relative w-24 h-7 bg-muted rounded-full cursor-pointer border border-input/50 p-0.5 flex items-center"
                                    onClick={() => setTimeMode(prev => prev === 'start' ? 'end' : 'start')}
                                >
                                    <div
                                        className={cn(
                                            "absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-background shadow-sm transition-all duration-300",
                                            timeMode === 'start' ? "left-0.5" : "left-[calc(50%+1px)]"
                                        )}
                                    />
                                    <span className={cn("flex-1 text-center text-[10px] font-bold z-10 transition-colors", timeMode === 'start' ? "text-foreground" : "text-muted-foreground")}>START</span>
                                    <span className={cn("flex-1 text-center text-[10px] font-bold z-10 transition-colors", timeMode === 'end' ? "text-foreground" : "text-muted-foreground")}>END</span>
                                </div>
                            </div>
                            <input
                                type="datetime-local"
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={timeValue}
                                onChange={(e) => setTimeValue(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">{t('recipe.real_temp') || "Room Temperature"}</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.1"
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={realTemperature}
                                    onChange={(e) => setRealTemperature(parseFloat(e.target.value) || 20)}
                                />
                                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">°C</span>
                            </div>
                        </div>
                    </div>

                    {/* Schedule List */}
                    {schedule.length > 0 ? (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground mb-2">
                                <span>{t('recipe.schedule') || "Schedule"}</span>
                                <span>{t('recipe.total_duration') || "Total"}: ~{totalDurationText}</span>
                            </div>
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground font-semibold">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Day</th>
                                            <th className="px-4 py-2 text-left">Time</th>
                                            <th className="px-4 py-2 text-left">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {schedule.map((item, i) => {
                                            const itemDate = new Date(item.time);
                                            const firstDate = schedule[0].time;

                                            // Calculate day relative to start based on calendar days
                                            const itemDay = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
                                            const firstDay = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate());
                                            const dayDiff = Math.round((itemDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                                            return (
                                                <tr key={i} className="bg-card hover:bg-accent/50 transition-colors">
                                                    <td className="px-4 py-3 w-20 text-muted-foreground font-medium">
                                                        {t('common.day') || "Day"} {dayDiff}
                                                    </td>
                                                    <td className="px-4 py-3 w-24 font-mono font-medium text-primary">
                                                        {format(item.time, 'HH:mm')}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium">{item.description.split(': ')[1]}</div>
                                                        <div className="text-xs text-muted-foreground">{item.chapter}</div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            No steps to schedule.
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border flex justify-end gap-3 mt-auto">
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel') || "Cancel"}
                    </Button>
                    <Button onClick={() => addToPlanMutation.mutate()} className="gap-2">
                        <Plus className="w-4 h-4" />
                        {t('recipe.add_to_plan') || "Add to Plan"}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
function IngredientOverviewModal({ recipe, currentYield, onClose }: { recipe: Recipe; currentYield: number; onClose: () => void }) {
    const { t, i18n } = useTranslation();

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const getIngredientName = (ing: any) => {
        if (typeof ing.name === 'string') return ing.name;
        return ing.name[i18n.language] || ing.name['en'] || Object.values(ing.name)[0];
    };

    const scaleAmount = (amount: number) => {
        if (!recipe || !recipe.yield_amount) return amount;
        const scaled = (amount / recipe.yield_amount) * currentYield;
        return scaled.toLocaleString(i18n.language, { maximumFractionDigits: 3 });
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background border border-border w-full max-w-md rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary" />
                        {t('recipe.ingredient_overview') || "Ingredients"}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-2 overflow-y-auto flex-1 pr-2">
                    {recipe.ingredient_overview && recipe.ingredient_overview.length > 0 ? (
                        recipe.ingredient_overview.map((ing, i) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-sm border border-transparent hover:border-border/50">
                                <span className="font-medium">
                                    {ing.linked_recipe_id ? (
                                        <Link to={`/recipe/${ing.linked_recipe_id}`} className="hover:underline flex items-center gap-1">
                                            {getIngredientName(ing)}
                                            <ArrowLeft className="w-3 h-3 rotate-180 opacity-50" />
                                        </Link>
                                    ) : (
                                        getIngredientName(ing)
                                    )}
                                </span>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <span className="font-mono font-bold text-foreground">
                                        {scaleAmount(ing.amount)} {ing.unit}
                                    </span>
                                    {!!ing.temperature && (
                                        <span className="bg-secondary px-1.5 py-0.5 rounded text-xs">
                                            {ing.temperature}°C
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">
                            {t('common.none') || "None"}
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-border flex justify-end mt-auto">
                    <Button onClick={onClose}>
                        {t('common.close') || "Close"}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
