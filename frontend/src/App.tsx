import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import RecipeEdit from './pages/RecipeEdit';
import RecipeDetail from './pages/RecipeDetail';
import Planer from './pages/Planer';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import { Toaster } from 'sonner';
import { useSystemSettings } from './hooks/useSystemSettings';
import Onboarding from './pages/Onboarding';
import { checkSystemInit } from './lib/api';


const queryClient = new QueryClient();

function ProtectedRoute({ children, requireAdmin, allowGuest }: { children: React.ReactNode, requireAdmin?: boolean, allowGuest?: boolean }) {
    const { user, isLoading } = useAuth();
    const { allowGuestAccess, isLoading: settingsLoading } = useSystemSettings();

    if (isLoading || settingsLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

    if (!user) {
        if (allowGuest && allowGuestAccess) {
            return <>{children}</>;
        }
        return <Navigate to="/login" />;
    }

    if (requireAdmin && user.role !== 'admin') {
        return <Navigate to="/" />;
    }

    return <>{children}</>;
}



function App() {
    const [isInitialized, setIsInitialized] = React.useState<boolean | null>(null);
    const [connectionError, setConnectionError] = React.useState<boolean>(false);

    const checkStatus = React.useCallback(() => {
        setConnectionError(false);
        checkSystemInit()
            .then(setIsInitialized)
            .catch((err) => {
                console.error("Failed to check init status", err);
                setConnectionError(true);
            });
    }, []);

    React.useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    if (connectionError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
                <div className="text-xl font-semibold text-red-400">Could not connect to Backend</div>
                <p className="text-gray-400">Please check if the backend service is running.</p>
                <button
                    onClick={checkStatus}
                    className="px-4 py-2 bg-amber-500 text-black rounded hover:bg-amber-400 transition-colors"
                >
                    Retry Connection
                </button>
            </div>
        );
    }

    if (isInitialized === null) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading system status...</div>;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AuthProvider>
                    <Routes>
                        {!isInitialized ? (
                            <Route path="*" element={<Onboarding />} />
                        ) : (
                            <>
                                <Route path="/login" element={<Login />} />

                                <Route path="/register" element={<Register />} />
                                <Route path="/verify-email" element={<VerifyEmail />} />

                                <Route path="/" element={
                                    <ProtectedRoute allowGuest>
                                        <Layout>
                                            <Dashboard />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/recipe/new" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <RecipeEdit />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/recipe/:id" element={
                                    <ProtectedRoute allowGuest>
                                        <Layout>
                                            <RecipeDetail />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/recipe/:id/edit" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <RecipeEdit />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/planer" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <Planer />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/profile" element={
                                    <ProtectedRoute>
                                        <Layout>
                                            <Profile />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="/admin" element={
                                    <ProtectedRoute requireAdmin>
                                        <Layout>
                                            <AdminDashboard />
                                        </Layout>
                                    </ProtectedRoute>
                                } />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                        )}
                    </Routes>
                    <Toaster richColors position="top-right" />
                </AuthProvider>
            </Router>
        </QueryClientProvider>
    );
}

export default App;
