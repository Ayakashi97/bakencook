import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { initializeSystem, SystemInit } from '../lib/api';
import { Check, ChevronRight, Loader2, Upload, Settings, User, Database, Globe } from 'lucide-react';
import { FaviconPicker } from '../components/FaviconPicker';
import { Modal } from '../components/Modal';

const steps = [
    { id: 'welcome', title: 'Welcome', icon: Globe },
    { id: 'admin', title: 'Admin User', icon: User },
    { id: 'config', title: 'Configuration', icon: Settings },
    { id: 'access', title: 'Access & Security', icon: User },
    { id: 'data', title: 'Data Import', icon: Database },
];

interface OnboardingForm extends SystemInit {
    enable_ai: boolean;
    enable_smtp: boolean;
    enable_registration: boolean;
    enable_email_verification: boolean;
    allow_guest_access: boolean;
}

export default function Onboarding() {
    const { t } = useTranslation();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showFaviconModal, setShowFaviconModal] = useState(false);

    const { register, handleSubmit, setValue, watch, getValues, formState: { errors } } = useForm<OnboardingForm>({
        defaultValues: {
            app_name: 'Bake’n’Cook',
            import_data: true,
            smtp_port: 587,
            favicon_base64: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👨‍🍳</text></svg>',
            enable_ai: true,
            enable_smtp: false,
            enable_registration: true,
            enable_email_verification: false,
            allow_guest_access: false
        }
    });

    const faviconPreview = watch('favicon_base64');
    const enableAi = watch('enable_ai');
    const enableSmtp = watch('enable_smtp');

    // Effect to handle dependency: Email Verification requires SMTP
    useEffect(() => {
        if (!enableSmtp) {
            setValue('enable_email_verification', false);
        }
    }, [enableSmtp, setValue]);

    const onSubmit = async (data: OnboardingForm) => {
        setIsSubmitting(true);
        try {
            // Clean up data based on toggles
            const payload: SystemInit = {
                ...data,
                gemini_api_key: data.enable_ai ? data.gemini_api_key : undefined,
                smtp_server: data.enable_smtp ? data.smtp_server : undefined,
                smtp_port: data.enable_smtp ? data.smtp_port : undefined,
                smtp_user: data.enable_smtp ? data.smtp_user : undefined,
                smtp_password: data.enable_smtp ? data.smtp_password : undefined,
                sender_email: data.enable_smtp ? data.sender_email : undefined,
            };

            await initializeSystem(payload);
            toast.success(t('onboarding.success.init_complete'));
            // Force reload to clear any cached state and ensure fresh start
            window.location.href = '/login';
        } catch (error) {
            console.error(error);
            toast.error(t('onboarding.errors.init_failed'));
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (e.target instanceof HTMLButtonElement) return;
            e.preventDefault();
            nextStep();
        }
    };

    const nextStep = async () => {
        // Validation for Admin User Step (Index 1)
        if (currentStep === 1) {
            const { admin_username, admin_email, admin_password } = getValues();

            if (!admin_username || !admin_username.trim()) {
                toast.error(t('onboarding.errors.username_required'));
                return;
            }

            if (!admin_email || !admin_email.trim()) {
                toast.error(t('onboarding.errors.email_required'));
                return;
            }

            // Basic Email Regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(admin_email)) {
                toast.error(t('onboarding.errors.email_invalid'));
                return;
            }

            if (!admin_password || !admin_password.trim()) {
                toast.error(t('onboarding.errors.password_required'));
                return;
            }

            if (admin_password.length < 8) {
                toast.error(t('onboarding.errors.password_length'));
                return;
            }
        }

        // Validation for Configuration Step (Index 2)
        if (currentStep === 2) {
            const values = getValues();

            if (values.enable_ai) {
                if (!values.gemini_api_key || !values.gemini_api_key.trim()) {
                    toast.error(t('onboarding.errors.gemini_key_required'));
                    return;
                }
            }

            if (values.enable_smtp) {
                if (!values.smtp_server || !values.smtp_server.trim()) {
                    toast.error(t('onboarding.config.smtp_server') + ' required');
                    return;
                }
                if (!values.smtp_port) {
                    toast.error(t('onboarding.config.smtp_port') + ' required');
                    return;
                }
                if (!values.smtp_user || !values.smtp_user.trim()) {
                    toast.error(t('onboarding.config.smtp_user') + ' required');
                    return;
                }
                if (!values.smtp_password || !values.smtp_password.trim()) {
                    toast.error(t('onboarding.config.smtp_password') + ' required');
                    return;
                }
                if (!values.sender_email || !values.sender_email.trim()) {
                    toast.error(t('onboarding.config.sender_email') + ' required');
                    return;
                }
            }
        }

        if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit(onSubmit)();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">

                {/* Sidebar */}
                <div className="w-full md:w-1/3 bg-black/20 p-8 flex flex-col justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
                            {t('onboarding.sidebar.title')}
                        </h1>
                        <p className="text-gray-400 text-sm mb-8">{t('onboarding.sidebar.subtitle')}</p>

                        <div className="space-y-6">
                            {steps.map((step, index) => {
                                const Icon = step.icon;
                                const isActive = index === currentStep;
                                const isCompleted = index < currentStep;

                                return (
                                    <div key={step.id} className={`flex items-center gap-4 transition-all duration-300 ${isActive ? 'translate-x-2' : ''}`}>
                                        <div className={`
                                            w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                                            ${isActive ? 'border-amber-400 bg-amber-400/20 text-amber-400' :
                                                isCompleted ? 'border-green-500 bg-green-500/20 text-green-500' :
                                                    'border-gray-600 text-gray-600'}
                                        `}>
                                            {isCompleted ? <Check size={20} /> : <Icon size={20} />}
                                        </div>
                                        <div>
                                            <p className={`font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>{t(`onboarding.steps.${step.id}`)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-xs text-gray-500">
                        {t('onboarding.sidebar.version', { appName: "Bake'n'Cook", version: __APP_VERSION__ })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">
                    <form onSubmit={handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="h-full flex flex-col">

                        <div className="flex-1">
                            {currentStep === 0 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('onboarding.welcome.title', { appName: "Bake'n'Cook" })}</h2>
                                    <p className="text-gray-300 mb-8">
                                        {t('onboarding.welcome.subtitle')}
                                    </p>

                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.welcome.app_name')}</span>
                                            <input
                                                {...register('app_name', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder={t('onboarding.welcome.app_name_placeholder')}
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('onboarding.admin.title')}</h2>
                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.admin.username')}</span>
                                            <input
                                                {...register('admin_username', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder={t('onboarding.admin.username_placeholder')}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.admin.email')}</span>
                                            <input
                                                type="email"
                                                {...register('admin_email', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder={t('onboarding.admin.email_placeholder')}
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.admin.password')}</span>
                                            <input
                                                type="password"
                                                {...register('admin_password', { required: true, minLength: 8 })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder={t('onboarding.admin.password_placeholder')}
                                            />
                                            {errors.admin_password && <span className="text-red-400 text-xs mt-1">{t('onboarding.admin.password_hint')}</span>}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('onboarding.config.title')}</h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-medium text-amber-400">{t('onboarding.config.ai_integration')}</h3>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" {...register('enable_ai')} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                                </label>
                                            </div>

                                            {enableAi && (
                                                <label className="block animate-in fade-in slide-in-from-top-2">
                                                    <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.gemini_key')}</span>
                                                    <input
                                                        {...register('gemini_api_key')}
                                                        type="password"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                        placeholder={t('onboarding.config.gemini_key_placeholder')}
                                                    />
                                                </label>
                                            )}

                                            <h3 className="text-lg font-medium text-amber-400 mt-6">{t('onboarding.config.branding')}</h3>
                                            <label className="block">
                                                <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.favicon')}</span>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                                        {faviconPreview ? (
                                                            <img src={faviconPreview} alt="Preview" className="w-full h-full object-contain" />
                                                        ) : (
                                                            <Upload size={20} className="text-gray-500" />
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowFaviconModal(true)}
                                                        className="text-sm text-amber-400 hover:text-amber-300 hover:underline font-medium"
                                                    >
                                                        {t('onboarding.config.select_favicon')}
                                                    </button>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-medium text-amber-400">{t('onboarding.config.email_smtp')}</h3>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" {...register('enable_smtp')} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                                </label>
                                            </div>

                                            {enableSmtp && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block">
                                                        <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.smtp_server')}</span>
                                                        <input
                                                            {...register('smtp_server')}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                            placeholder={t('onboarding.config.smtp_server_placeholder')}
                                                        />
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <label className="block">
                                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.smtp_port')}</span>
                                                            <input
                                                                type="number"
                                                                {...register('smtp_port')}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                                placeholder={t('onboarding.config.smtp_port_placeholder')}
                                                            />
                                                        </label>
                                                        <label className="block">
                                                            <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.smtp_user')}</span>
                                                            <input
                                                                {...register('smtp_user')}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                                placeholder={t('onboarding.config.smtp_user_placeholder')}
                                                            />
                                                        </label>
                                                    </div>
                                                    <label className="block">
                                                        <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.smtp_password')}</span>
                                                        <input
                                                            type="password"
                                                            {...register('smtp_password')}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                            placeholder={t('onboarding.config.smtp_password_placeholder')}
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <span className="text-gray-300 text-sm font-medium mb-1 block">{t('onboarding.config.sender_email')}</span>
                                                        <input
                                                            type="email"
                                                            {...register('sender_email')}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                            placeholder={t('onboarding.config.sender_email_placeholder')}
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('onboarding.access.title')}</h2>
                                    <p className="text-gray-300 mb-8">
                                        {t('onboarding.access.subtitle')}
                                    </p>

                                    <div className="space-y-6">
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between">
                                            <div>
                                                <span className="text-white font-medium block">{t('onboarding.access.enable_registration')}</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    {t('onboarding.access.enable_registration_desc')}
                                                </span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" {...register('enable_registration')} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                            </label>
                                        </div>

                                        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between transition-opacity ${!enableSmtp ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div>
                                                <span className="text-white font-medium block">{t('onboarding.access.require_verification')}</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    {t('onboarding.access.require_verification_desc')}
                                                </span>
                                                {!enableSmtp && (
                                                    <span className="text-amber-400 text-xs block mt-2 font-medium">
                                                        {t('onboarding.access.require_verification_warning')}
                                                    </span>
                                                )}
                                            </div>
                                            <label className={`relative inline-flex items-center ${!enableSmtp ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    {...register('enable_email_verification')}
                                                    disabled={!enableSmtp}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                            </label>
                                        </div>

                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between">
                                            <div>
                                                <span className="text-white font-medium block">{t('onboarding.access.allow_guest')}</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    {t('onboarding.access.allow_guest_desc')}
                                                </span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" {...register('allow_guest_access')} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {currentStep === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">{t('onboarding.data.title')}</h2>
                                    <p className="text-gray-300 mb-8">
                                        {t('onboarding.data.subtitle')}
                                    </p>

                                    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                                        <label className="flex items-start gap-4 cursor-pointer">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    {...register('import_data')}
                                                    className="peer h-6 w-6 cursor-pointer appearance-none rounded-md border border-gray-500 bg-transparent checked:border-amber-400 checked:bg-amber-400 transition-all"
                                                />
                                                <Check size={16} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                            </div>
                                            <div>
                                                <span className="text-white font-medium block">{t('onboarding.data.import_standard')}</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    {t('onboarding.data.import_standard_desc')}
                                                </span>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Navigation */}
                        <div className="flex justify-between items-center pt-8 border-t border-white/10 mt-4">
                            <button
                                type="button"
                                onClick={prevStep}
                                className={`px-6 py-2 rounded-lg text-gray-400 hover:text-white transition-colors ${currentStep === 0 ? 'invisible' : ''}`}
                            >
                                {t('onboarding.buttons.back')}
                            </button>

                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={isSubmitting}
                                className="bg-gradient-to-r from-amber-400 to-orange-500 text-black font-bold px-8 py-3 rounded-xl hover:shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        {t('onboarding.buttons.setting_up')}
                                    </>
                                ) : currentStep === steps.length - 1 ? (
                                    t('onboarding.buttons.finish')
                                ) : (
                                    <>
                                        {t('onboarding.buttons.next')} <ChevronRight size={20} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {showFaviconModal && (
                <Modal title="Select Favicon" onClose={() => setShowFaviconModal(false)}>
                    <div className="space-y-4">
                        <FaviconPicker
                            value={faviconPreview || ''}
                            onChange={(url) => setValue('favicon_base64', url)}
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowFaviconModal(false)}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 text-sm font-medium"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
