import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Upgrade to HTTPS if we are on HTTPS but API_URL is HTTP
// This prevents Mixed Content errors when the API_URL is hardcoded to HTTP in the build
const getBaseUrl = () => {
    const url = API_URL.trim();
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.match(/^http:\/\//i)) {
        return url.replace(/^http:\/\//i, 'https://');
    }
    return url;
};

export const api = axios.create({
    baseURL: getBaseUrl(),
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Clear token and redirect to login
            localStorage.removeItem('token');
            delete api.defaults.headers.common['Authorization'];
            // We can't use useNavigate here easily as it's outside React context
            // But AuthContext will handle the state update if we trigger an event or if the component re-renders
            // For now, let's just ensure the token is gone. 
            // The AuthContext checkSession will eventually catch it, or the user will be redirected on next nav.
            // A hard redirect is also an option:
            if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export interface Ingredient {
    id?: number;
    name: { en: string; de: string };
    amount: number;
    unit: string;
    temperature?: number;
    type: 'flour' | 'liquid' | 'starter' | 'salt' | 'add_in' | 'other';
    linked_recipe_id?: string;
}

export interface Step {
    id?: number;
    order_index: number;
    description: string;
    duration_min: number;
    type: 'active' | 'passive' | 'baking';
    temperature?: number;
}

export interface Chapter {
    id?: string;
    name: string;
    order_index: number;
    ingredients: Ingredient[];
    steps: Step[];
}

export interface ChapterCreate {
    name: string;
    order_index: number;
    ingredients: Omit<Ingredient, 'id'>[];
    steps: Omit<Step, 'id'>[];
}

export interface Recipe {
    id: string;
    user_id: string;
    title: string;
    source_url?: string;
    image_url?: string;
    created_type: 'manual' | 'ai_import';
    type: 'baking' | 'cooking';
    is_public: boolean;
    yield_amount: number;
    weight_per_piece?: number;
    reference_temperature?: number;
    chapters: Chapter[];
    ingredient_overview?: Ingredient[];
    author?: string;
    average_rating?: number;
    rating_count?: number;
    is_favorited?: boolean;
}

export interface RecipeCreate {
    title: string;
    source_url?: string;
    image_url?: string;
    created_type: 'manual' | 'ai_import';
    type: 'baking' | 'cooking';
    is_public: boolean;
    yield_amount: number;
    weight_per_piece?: number;
    reference_temperature?: number;
    chapters: ChapterCreate[];
}

export interface RecipePage {
    items: Recipe[];
    total: number;
    page: number;
    size: number;
    pages: number;
}

export interface SystemInit {
    admin_username: string;
    admin_email: string;
    admin_password: string;
    app_name: string;
    gemini_api_key?: string;
    smtp_server?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    sender_email?: string;
    import_data: boolean;
    favicon_base64?: string;
    enable_registration: boolean;
    enable_email_verification: boolean;
    allow_guest_access: boolean;
}

export const checkSystemInit = async (): Promise<boolean> => {
    const response = await api.get<{ initialized: boolean }>('/system/init-status');
    return response.data.initialized;
};

export const initializeSystem = async (data: SystemInit): Promise<void> => {
    await api.post('/system/init', data);
};

