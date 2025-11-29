
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Users, Search, Plus, Edit2, Trash2, Loader2, Save, AlertTriangle, Scale, Utensils, Lock, Server, Activity, X } from 'lucide-react';
import AdminRoles from '../components/AdminRoles';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import AdminUnits from '../components/AdminUnits';
import AdminIngredients from '../components/AdminIngredients';
import AdminSystem from '../components/AdminSystem';
import SystemStatus from '../components/SystemStatus';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { GlassTabs } from '../components/ui/GlassTabs';

interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
    role_rel?: { name: string };
    is_verified?: boolean;
    created_at?: string;
}

interface Role {
    id: string;
    name: string;
    permissions: string[];
}

export default function AdminDashboard() {
    const { user, hasPermission } = useAuth();
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'units' | 'ingredients' | 'system' | 'status'>('users');

    // Allow access if user has admin role OR any manage permission
    const canAccessAdmin = user?.role === 'admin' ||
        hasPermission('manage:users') ||
        hasPermission('manage:roles') ||
        hasPermission('manage:units') ||
        hasPermission('manage:ingredients') ||
        hasPermission('manage:system');

    if (!canAccessAdmin) {
        return <Navigate to="/" />;
    }



    const UsersTab = () => {
        const queryClient = useQueryClient();
        const [selectedUser, setSelectedUser] = useState<User & { is_active: boolean } | null>(null);
        const [showDeactivateModal, setShowDeactivateModal] = useState(false);
        const [showActivateModal, setShowActivateModal] = useState(false);
        const [showDeleteModal, setShowDeleteModal] = useState(false);

        const [isSaving, setIsSaving] = useState(false);

        // Pagination state
        const [currentPage, setCurrentPage] = useState(1);
        const [pageSize, setPageSize] = useState(10);
        const [searchTerm, setSearchTerm] = useState('');

        // Role Change Modal State
        const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
        const [pendingRole, setPendingRole] = useState<string | null>(null);
        const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);

        const { data: users, isLoading: isLoadingUsers } = useQuery<(User & { is_active: boolean })[]>({
            queryKey: ['users'],
            queryFn: async () => {
                const res = await api.get('/admin/users');
                return res.data;
            },
        });

        const { data: roles } = useQuery<Role[]>({
            queryKey: ['roles'],
            queryFn: async () => {
                const res = await api.get('/admin/roles');
                return res.data;
            },
        });

        const deleteMutation = useMutation({
            mutationFn: (userId: string) => api.delete(`/admin/users/${userId}`),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowDeleteModal(false);
                setSelectedUser(null);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || t('admin.delete_failed'));
            }
        });

        const assignRoleMutation = useMutation({
            mutationFn: ({ userId, roleName }: { userId: string, roleName: string }) =>
                api.put(`/admin/users/${userId}/role?role_name=${roleName}`),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowRoleChangeModal(false);
                setPendingRole(null);
                setSelectedUserForRole(null);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to assign role');
            }
        });

        const toggleStatusMutation = useMutation({
            mutationFn: ({ userId, isActive }: { userId: string, isActive: boolean }) =>
                api.put(`/admin/users/${userId}/status?is_active=${isActive}`),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowDeactivateModal(false);
                setShowActivateModal(false);
                setSelectedUser(null);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to update status');
            }
        });

        // User Create/Edit Modal State
        const [showUserModal, setShowUserModal] = useState(false);
        const [editingUser, setEditingUser] = useState<User | null>(null);
        const [userFormData, setUserFormData] = useState({
            username: '',
            email: '',
            password: '',
            role: 'user',
            is_active: true,
            is_verified: false
        });


        const createUserMutation = useMutation({
            mutationFn: (data: any) => api.post('/admin/users', data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowUserModal(false);
                resetUserForm();
                setIsSaving(false);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to create user');
                setIsSaving(false);
            }
        });

        const updateUserMutation = useMutation({
            mutationFn: ({ id, data }: { id: string, data: any }) => api.put(`/admin/users/${id}`, data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['users'] });
                setShowUserModal(false);
                resetUserForm();
                setIsSaving(false);
            },
            onError: (err: any) => {
                alert(err.response?.data?.detail || 'Failed to update user');
                setIsSaving(false);
            }
        });

        const resetUserForm = () => {
            setUserFormData({
                username: '',
                email: '',
                password: '',
                role: 'user',
                is_active: true,
                is_verified: false
            });
            setEditingUser(null);


        };

        const handleCloseUserModal = () => {
            setShowUserModal(false);
            resetUserForm();
        };

        const handleCreateUser = () => {
            resetUserForm();
            setShowUserModal(true);

        };

        const handleEditUser = (u: User & { is_active: boolean }) => {
            setEditingUser(u);
            setUserFormData({
                username: u.username,
                email: u.email || '',
                password: '', // Don't show password
                role: u.role_rel?.name || 'User', // This might need mapping back to enum if we used enum in form
                is_active: u.is_active,
                is_verified: u.is_verified || false
            });
            setShowUserModal(true);
        };

        const handleUserSubmit = (e: React.FormEvent) => {
            e.preventDefault();
            if (editingUser) {
                const payload: any = {
                    username: userFormData.username,
                    email: userFormData.email || null,
                    is_active: userFormData.is_active,
                    is_verified: userFormData.is_verified
                };
                if (userFormData.password) {
                    payload.password = userFormData.password;
                }
                updateUserMutation.mutate({ id: editingUser.id, data: payload });
            } else {
                setIsSaving(true);
                createUserMutation.mutate(userFormData);
            }
        };

        if (isLoadingUsers) return <div>{t('common.loading')}</div>;

        // Filter users based on search term
        const filteredUsers = users?.filter(u =>
            u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.role.toLowerCase().includes(searchTerm.toLowerCase())
        ) || [];

        // Pagination logic
        const totalItems = filteredUsers.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        return (
            <div className="space-y-6">
                <div className="glass-card rounded-xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 backdrop-blur-sm">
                        <h2 className="font-semibold flex items-center gap-2 shrink-0">
                            <Users className="h-5 w-5" /> {t('admin.user_mgmt')}
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder={t('admin.search') || "Search..."}
                                    className="w-full pl-9 pr-10 h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus:bg-background"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setCurrentPage(1);
                                    }}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => {
                                            setSearchTerm('');
                                            setCurrentPage(1);
                                        }}
                                        className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <button
                                onClick={handleCreateUser}
                                className="h-9 w-9 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center justify-center shrink-0 transition-colors shadow-sm"
                                title={t('admin.add_user') || "Add User"}
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                                <tr>
                                    <th className="px-6 py-3">{t('login.username')}</th>
                                    <th className="px-6 py-3">{t('profile.stats.member_since')}</th>
                                    <th className="px-6 py-3">{t('admin.tab_roles')}</th>
                                    <th className="px-6 py-3">{t('admin.status')}</th>
                                    <th className="px-6 py-3 text-right">{t('admin.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                {paginatedUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                {u.username.charAt(0).toUpperCase()}
                                            </div>
                                            {u.username}
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <select
                                                className="h-8 rounded-md border border-input bg-background/50 px-2 text-xs"
                                                value={u.role_rel?.name || (u.role === 'user' ? 'User' : u.role === 'admin' ? 'Admin' : u.role)}
                                                onChange={(e) => {
                                                    setSelectedUserForRole(u);
                                                    setPendingRole(e.target.value);
                                                    setShowRoleChangeModal(true);
                                                }}
                                            >
                                                {roles?.map(r => (
                                                    <option key={r.id} value={r.name}>{r.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded-full text-xs font-medium border",
                                                !u.is_verified
                                                    ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                                                    : u.is_active
                                                        ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                                        : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                            )}>
                                                {!u.is_verified ? t('admin.pending_verification') : u.is_active ? t('admin.active') : t('admin.inactive')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEditUser(u)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50/10 rounded-md transition-colors"
                                                    title="Edit User"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                {u.id !== user?.id && (
                                                    <>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUser(u);
                                                                if (u.is_active) {
                                                                    setShowDeactivateModal(true);
                                                                } else {
                                                                    setShowActivateModal(true);
                                                                }
                                                            }}
                                                            className={cn(
                                                                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                                                                u.is_active
                                                                    ? "text-orange-600 border-orange-200 hover:bg-orange-50/10 dark:text-orange-400 dark:border-orange-900"
                                                                    : "text-green-600 border-green-200 hover:bg-green-50/10 dark:text-green-400 dark:border-green-900"
                                                            )}
                                                        >
                                                            {u.is_active ? t('admin.deactivate') : t('admin.activate')}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedUser(u);
                                                                setShowDeleteModal(true);
                                                            }}
                                                            className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                            title="Delete User"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="grid grid-cols-1 md:hidden divide-y divide-white/10">
                        {paginatedUsers.map((u) => (
                            <div key={u.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <span className="font-medium block">{u.username}</span>
                                            {u.created_at && (
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date(u.created_at).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-medium border",
                                        !u.is_verified
                                            ? "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                                            : u.is_active
                                                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                                : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                    )}>
                                        {!u.is_verified ? t('admin.pending_verification') : u.is_active ? t('admin.active') : t('admin.inactive')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-2">
                                    <select
                                        className="h-8 rounded-md border border-input bg-background/50 px-2 text-xs w-32"
                                        value={u.role_rel?.name || (u.role === 'user' ? 'User' : u.role === 'admin' ? 'Admin' : u.role)}
                                        onChange={(e) => {
                                            setSelectedUserForRole(u);
                                            setPendingRole(e.target.value);
                                            setShowRoleChangeModal(true);
                                        }}
                                    >
                                        {roles?.map(r => (
                                            <option key={r.id} value={r.name}>{r.name}</option>
                                        ))}
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEditUser(u)} className="p-2 text-blue-500 bg-blue-50/10 rounded-md">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        {u.id !== user?.id && (
                                            <>
                                                <button onClick={() => { setSelectedUser(u); u.is_active ? setShowDeactivateModal(true) : setShowActivateModal(true); }} className={cn("p-2 rounded-md", u.is_active ? "text-orange-600 bg-orange-50/10" : "text-green-600 bg-green-50/10")}>
                                                    <Activity className="h-4 w-4" />
                                                </button>
                                                <button onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }} className="p-2 text-destructive bg-destructive/10 rounded-md">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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

                {/* User Create/Edit Modal */}
                {showUserModal && (
                    <Modal title={editingUser ? (t('admin.edit_user') || "Edit User") : (t('admin.add_user') || "Add User")} onClose={handleCloseUserModal}>
                        <form onSubmit={handleUserSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('login.username')}</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={userFormData.username}
                                    onChange={(e) => {
                                        setUserFormData({ ...userFormData, username: e.target.value });

                                    }}
                                    required
                                    autoComplete="username"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('profile.email') || "Email"}</label>
                                <input
                                    type="email"
                                    required
                                    autoComplete="email"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={userFormData.email}
                                    onChange={(e) => {
                                        setUserFormData({ ...userFormData, email: e.target.value });
                                    }}
                                    placeholder="user@example.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('login.password')}</label>
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={userFormData.password}
                                    onChange={(e) => {
                                        setUserFormData({ ...userFormData, password: e.target.value });

                                    }}
                                    placeholder={editingUser ? (t('admin.leave_blank_pw') || "Leave blank to keep current") : ""}
                                    required={!editingUser}
                                />
                            </div>
                            {!editingUser && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">{t('admin.role') || "Role"}</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={userFormData.role}
                                        onChange={(e) => {
                                            setUserFormData({ ...userFormData, role: e.target.value });

                                        }}
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                            )}
                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={userFormData.is_active}
                                    onChange={(e) => {
                                        setUserFormData({ ...userFormData, is_active: e.target.checked });

                                    }}
                                />
                                <label htmlFor="isActive" className="text-sm font-medium leading-none">
                                    {t('admin.active')}
                                </label>
                            </div>
                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isVerified"
                                    className="h-4 w-4 rounded border-gray-300"
                                    checked={userFormData.is_verified}
                                    onChange={(e) => {
                                        setUserFormData({ ...userFormData, is_verified: e.target.checked });
                                    }}
                                />
                                <label htmlFor="isVerified" className="text-sm font-medium leading-none">
                                    {t('admin.verified') || "Verified"}
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                                <button
                                    type="button"
                                    onClick={handleCloseUserModal}
                                    className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                                >
                                    {t('admin.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {t('admin.save')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}

                {/* Role Change Modal */}
                {showRoleChangeModal && selectedUserForRole && pendingRole && (
                    <Modal title={t('admin.change_role_title') || "Change Role"} onClose={() => setShowRoleChangeModal(false)}>
                        <p className="mb-6 text-muted-foreground">
                            {t('admin.change_role_confirm') || "Are you sure you want to change the role for"} <span className="font-bold text-foreground">{selectedUserForRole.username}</span> {t('admin.to') || "to"} <span className="font-bold text-primary">{pendingRole}</span>?
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowRoleChangeModal(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('admin.cancel_edit')}
                            </button>
                            <button
                                onClick={() => assignRoleMutation.mutate({ userId: selectedUserForRole.id, roleName: pendingRole })}
                                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
                            >
                                {t('admin.confirm_role_change') || "Change Role"}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* Deactivate Modal */}
                {showDeactivateModal && selectedUser && (
                    <Modal title={t('admin.deactivate')} onClose={() => setShowDeactivateModal(false)}>
                        <p className="mb-6 text-muted-foreground">
                            {t('admin.confirm_deactivate')} <br />
                            <span className="font-bold text-foreground">{selectedUser.username}</span>
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowDeactivateModal(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('admin.cancel_edit')}
                            </button>
                            <button
                                onClick={() => toggleStatusMutation.mutate({ userId: selectedUser.id, isActive: false })}
                                className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700"
                            >
                                {t('admin.deactivate')}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* Activate Modal */}
                {showActivateModal && selectedUser && (
                    <Modal title={t('admin.activate')} onClose={() => setShowActivateModal(false)}>
                        <p className="mb-6 text-muted-foreground">
                            {t('admin.confirm_activate')} <br />
                            <span className="font-bold text-foreground">{selectedUser.username}</span>
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowActivateModal(false)}
                                className="px-4 py-2 rounded-md hover:bg-muted"
                            >
                                {t('admin.cancel_edit')}
                            </button>
                            <button
                                onClick={() => toggleStatusMutation.mutate({ userId: selectedUser.id, isActive: true })}
                                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                            >
                                {t('admin.activate')}
                            </button>
                        </div>
                    </Modal>
                )}

                {/* Delete Modal */}
                {showDeleteModal && selectedUser && (
                    <Modal title={t('admin.delete_user') || "Delete User"} onClose={() => setShowDeleteModal(false)}>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertTriangle className="h-10 w-10" />
                                <p className="text-sm text-muted-foreground">
                                    {t('admin.delete_user_confirm')} <br />
                                    <span className="font-bold text-foreground">{selectedUser.username}</span>
                                </p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 rounded-md hover:bg-muted text-sm font-medium transition-colors"
                                >
                                    {t('admin.cancel_edit')}
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(selectedUser.id)}
                                    className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md hover:bg-destructive/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t('admin.delete')}
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    };



    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col gap-6">
                {/* Top Tabs Navigation */}
                <div className="w-full overflow-x-auto">
                    <GlassTabs
                        activeTab={activeTab}
                        onChange={(id) => setActiveTab(id as any)}
                        tabs={[
                            { id: 'users', label: t('admin.tab_users'), icon: Users, perm: 'manage:users' },
                            { id: 'roles', label: t('admin.tab_roles'), icon: Lock, perm: 'manage:roles' },
                            { id: 'units', label: t('admin.tab_units'), icon: Scale, perm: 'manage:units' },
                            { id: 'ingredients', label: t('admin.tab_ingredients'), icon: Utensils, perm: 'manage:ingredients' },
                            { id: 'system', label: t('admin.tab_system') || "Server", icon: Server, perm: 'manage:system' },
                            { id: 'status', label: t('admin.tab_status') || "Status", icon: Activity, perm: 'manage:system' },
                        ]
                            .filter(item => {
                                return hasPermission(item.perm) || user?.role === 'admin';
                            })
                            .map(item => ({
                                id: item.id,
                                label: item.label,
                                icon: item.icon
                            }))}
                    />
                </div>

                {/* Content Area */}
                <div className="flex-1 min-w-0">
                    {activeTab === 'users' && <UsersTab />}
                    {activeTab === 'roles' && <AdminRoles />}
                    {activeTab === 'units' && <AdminUnits />}
                    {activeTab === 'ingredients' && <AdminIngredients />}
                    {activeTab === 'system' && <AdminSystem />}
                    {activeTab === 'status' && <SystemStatus />}
                </div>
            </div>
        </div>
    );
}
