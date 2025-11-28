import { useState, useEffect } from 'react';

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
            toast.success('System initialized successfully!');
            // Force reload to clear any cached state and ensure fresh start
            window.location.href = '/login';
        } catch (error) {
            console.error(error);
            toast.error('Failed to initialize system');
            setIsSubmitting(false);
        }
    };

    const nextStep = async () => {
        // Validation for Admin User Step (Index 1)
        if (currentStep === 1) {
            const { admin_username, admin_email, admin_password } = getValues();

            if (!admin_username || !admin_username.trim()) {
                toast.error('Please enter a username');
                return;
            }

            if (!admin_email || !admin_email.trim()) {
                toast.error('Please enter an email address');
                return;
            }

            // Basic Email Regex
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(admin_email)) {
                toast.error('Please enter a valid email address');
                return;
            }

            if (!admin_password || !admin_password.trim()) {
                toast.error('Please enter a password');
                return;
            }

            if (admin_password.length < 8) {
                toast.error('Password must be at least 8 characters');
                return;
            }
        }

        // Validation for Configuration Step (Index 2)
        if (currentStep === 2) {
            const values = getValues();

            if (values.enable_ai) {
                if (!values.gemini_api_key || !values.gemini_api_key.trim()) {
                    toast.error('Please enter a Gemini API Key');
                    return;
                }
            }

            if (values.enable_smtp) {
                if (!values.smtp_server || !values.smtp_server.trim()) {
                    toast.error('Please enter an SMTP Server');
                    return;
                }
                if (!values.smtp_port) {
                    toast.error('Please enter an SMTP Port');
                    return;
                }
                if (!values.smtp_user || !values.smtp_user.trim()) {
                    toast.error('Please enter an SMTP User');
                    return;
                }
                if (!values.smtp_password || !values.smtp_password.trim()) {
                    toast.error('Please enter an SMTP Password');
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
                            Setup
                        </h1>
                        <p className="text-gray-400 text-sm mb-8">Configure your new instance</p>

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
                                            <p className={`font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>{step.title}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="text-xs text-gray-500">
                        v1.0.0 • Bake'n'Cook
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">
                    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col">

                        <div className="flex-1">
                            {currentStep === 0 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">Welcome to Bake'n'Cook</h2>
                                    <p className="text-gray-300 mb-8">
                                        Let's get your personal cooking and baking assistant set up.
                                        We'll configure the basics so you can start creating delicious recipes right away.
                                    </p>

                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">Application Name</span>
                                            <input
                                                {...register('app_name', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder="e.g. My Kitchen"
                                            />
                                        </label>
                                    </div>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">Create Admin User</h2>
                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">Username</span>
                                            <input
                                                {...register('admin_username', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder="admin"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">Email</span>
                                            <input
                                                type="email"
                                                {...register('admin_email', { required: true })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder="admin@example.com"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="text-gray-300 text-sm font-medium mb-1 block">Password</span>
                                            <input
                                                type="password"
                                                {...register('admin_password', { required: true, minLength: 8 })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                placeholder="••••••••"
                                            />
                                            {errors.admin_password && <span className="text-red-400 text-xs mt-1">Min 8 characters</span>}
                                        </label>
                                    </div>
                                </div>
                            )}

                            {currentStep === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                                    <h2 className="text-2xl font-bold text-white mb-4">System Configuration</h2>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-medium text-amber-400">AI Integration</h3>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" {...register('enable_ai')} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                                </label>
                                            </div>

                                            {enableAi && (
                                                <label className="block animate-in fade-in slide-in-from-top-2">
                                                    <span className="text-gray-300 text-sm font-medium mb-1 block">Gemini API Key</span>
                                                    <input
                                                        {...register('gemini_api_key')}
                                                        type="password"
                                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                        placeholder="AIza..."
                                                    />
                                                </label>
                                            )}

                                            <h3 className="text-lg font-medium text-amber-400 mt-6">Branding</h3>
                                            <label className="block">
                                                <span className="text-gray-300 text-sm font-medium mb-1 block">Favicon</span>
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
                                                        Select Favicon
                                                    </button>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-medium text-amber-400">Email (SMTP)</h3>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" {...register('enable_smtp')} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                                </label>
                                            </div>

                                            {enableSmtp && (
                                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block">
                                                        <span className="text-gray-300 text-sm font-medium mb-1 block">SMTP Server</span>
                                                        <input
                                                            {...register('smtp_server')}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                            placeholder="smtp.gmail.com"
                                                        />
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <label className="block">
                                                            <span className="text-gray-300 text-sm font-medium mb-1 block">Port</span>
                                                            <input
                                                                type="number"
                                                                {...register('smtp_port')}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                                placeholder="587"
                                                            />
                                                        </label>
                                                        <label className="block">
                                                            <span className="text-gray-300 text-sm font-medium mb-1 block">User</span>
                                                            <input
                                                                {...register('smtp_user')}
                                                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                                placeholder="user@gmail.com"
                                                            />
                                                        </label>
                                                    </div>
                                                    <label className="block">
                                                        <span className="text-gray-300 text-sm font-medium mb-1 block">Password</span>
                                                        <input
                                                            type="password"
                                                            {...register('smtp_password')}
                                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-amber-400 transition-colors"
                                                            placeholder="App Password"
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
                                    <h2 className="text-2xl font-bold text-white mb-4">Access & Security</h2>
                                    <p className="text-gray-300 mb-8">
                                        Configure who can access your instance and how users are verified.
                                    </p>

                                    <div className="space-y-6">
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between">
                                            <div>
                                                <span className="text-white font-medium block">Enable Registration</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    Allow new users to create accounts.
                                                </span>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" {...register('enable_registration')} className="sr-only peer" />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                                            </label>
                                        </div>

                                        <div className={`bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-between transition-opacity ${!enableSmtp ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <div>
                                                <span className="text-white font-medium block">Require Email Verification</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    New users must verify their email before logging in. (Requires SMTP)
                                                </span>
                                                {!enableSmtp && (
                                                    <span className="text-amber-400 text-xs block mt-2 font-medium">
                                                        Requires SMTP to be enabled in Configuration step.
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
                                                <span className="text-white font-medium block">Allow Guest Access</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    Allow public access to recipes marked as public without login.
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
                                    <h2 className="text-2xl font-bold text-white mb-4">Data Initialization</h2>
                                    <p className="text-gray-300 mb-8">
                                        We can pre-fill your database with common ingredients and units to help you get started faster.
                                        This includes extensive lists for both cooking and baking in English and German.
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
                                                <span className="text-white font-medium block">Import Standard Data</span>
                                                <span className="text-gray-400 text-sm block mt-1">
                                                    Includes 50+ common ingredients (Flours, Dairy, Vegetables, Spices) and standard units (g, ml, tsp, tbsp, etc.) correctly linked.
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
                                Back
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
                                        Setting up...
                                    </>
                                ) : currentStep === steps.length - 1 ? (
                                    'Finish Setup'
                                ) : (
                                    <>
                                        Next <ChevronRight size={20} />
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
