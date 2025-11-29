import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';
import { Trash2, Plus, Loader2, Edit2, Save, Lock, AlertTriangle, Search, Shield } from 'lucide-react';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

interface Role {
    id: string;
    name: string;
    permissions: string[];
    user_count: number;
}

export default function AdminRoles() {
    const { t } = useTranslation();
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        name: string;
        permissions: string[];
    }>({
        name: '',
        permissions: []
    });
    const [isDirty, setIsDirty] = useState(false);
    const [showDiscardModal, setShowDiscardModal] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');

    // Delete modal state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const availablePermissions = [
        "read:recipes", "write:recipes", "delete:recipes",
        "manage:users", "manage:roles", "manage:system",
        "manage:units", "manage:ingredients"
    ];

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setIsLoading(true);
        try {
            const res = await api.get('/admin/roles');
            setRoles(res.data);
        } catch (error) {
            console.error('Failed to load roles', error);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({ name: '', permissions: [] });
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

    const handleCreate = () => {
        setEditingId(null);
        setFormData({ name: '', permissions: [] });
        setShowModal(true);
        setIsDirty(false);
    };

    const handleEdit = (role: Role) => {
        setEditingId(role.id);
        setFormData({
            name: role.name,
            permissions: role.permissions
        });
        setShowModal(true);
        setIsDirty(false); // When opening for edit, form is not dirty initially
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return;

        setIsSaving(true);
        try {
            if (editingId) {
                await api.put(`/admin/roles/${editingId}`, formData);
            } else {
                await api.post('/admin/roles', formData);
            }
            resetForm();
            loadRoles();
            toast.success(t('admin.save_success'));
        } catch (error) {
            console.error('Failed to save role', error);
            toast.error(t('admin.save_error'));
        } finally {
            setIsSaving(false);
        }
    };

    const togglePermission = (perm: string) => {
        setFormData(prev => {
            const perms = prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm];
            return { ...prev, permissions: perms };
        });
        setIsDirty(true);
    };

    const handleDeleteClick = (role: Role) => {
        if (role.user_count > 0) return;
        setDeletingId(role.id);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        try {
            await api.delete(`/admin/roles/${deletingId}`);
            loadRoles();
            setShowDeleteModal(false);
            setDeletingId(null);
            toast.success(t('admin.delete_success'));
        } catch (error) {
            console.error('Failed to delete role', error);
            toast.error(t('admin.delete_error'));
        }
    };

    // Filter roles based on search term
    const filteredRoles = roles.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination logic
    const totalItems = filteredRoles.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const paginatedRoles = filteredRoles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    return (
        <div className="space-y-6">
            <div className="glass-card rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 backdrop-blur-sm">
                    <h2 className="font-semibold flex items-center gap-2 shrink-0">
                        <Lock className="h-5 w-5" /> {t('admin.role_mgmt')}
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
                        <button
                            onClick={handleCreate}
                            className="h-9 w-9 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center justify-center shadow-sm"
                            title={t('admin.add_role')}
                        >
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {showModal && (
                    <Modal
                        title={editingId ? t('admin.edit_role') : t('admin.add_role')}
                        onClose={handleCloseModal}
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('admin.role_name')}</label>
                                <input
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={formData.name}
                                    onChange={(e) => {
                                        setFormData({ ...formData, name: e.target.value });
                                        setIsDirty(true);
                                    }}
                                    placeholder="e.g. Editor"
                                    disabled={!!editingId && (formData.name === 'Admin' || formData.name === 'User')}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">{t('admin.permissions')}</label>
                                <div className="grid grid-cols-2 gap-2 border rounded-md p-4 max-h-60 overflow-y-auto">
                                    {availablePermissions.map(perm => (
                                        <label key={perm} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300"
                                                checked={formData.permissions.includes(perm)}
                                                onChange={() => togglePermission(perm)}
                                            />
                                            <span>{perm}</span>
                                        </label>
                                    ))}
                                </div>
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
                                    disabled={isSaving || !formData.name}
                                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 flex items-center gap-2 text-sm font-medium transition-colors"
                                >
                                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    {t('admin.save')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}

                {showDeleteModal && (
                    <Modal title={t('admin.delete_role') || "Delete Role"} onClose={() => setShowDeleteModal(false)}>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-destructive">
                                <AlertTriangle className="h-10 w-10" />
                                <p className="text-sm text-muted-foreground">
                                    {t('admin.delete_role_confirm') || "Are you sure you want to delete this role? This action cannot be undone."}
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
                                    onClick={confirmDelete}
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

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30">
                            <tr>
                                <th className="px-6 py-3">{t('admin.role_name')}</th>
                                <th className="px-6 py-3">{t('admin.permissions')}</th>
                                <th className="px-6 py-3 text-center">{t('admin.user_count') || "Users"}</th>
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
                            ) : roles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="h-24 text-center text-muted-foreground">
                                        {t('admin.no_roles')}
                                    </td>
                                </tr>
                            ) : (
                                paginatedRoles.map((role) => (
                                    <tr key={role.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                            {role.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {role.permissions.map(p => (
                                                    <span key={p} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                                        {p}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-bold ${role.user_count > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                                                {role.user_count}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(role)}
                                                    className="p-1.5 text-blue-500 hover:bg-blue-50/10 rounded-md transition-colors"
                                                    title={t('admin.edit_role')}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(role)}
                                                    disabled={role.user_count > 0}
                                                    className={`p-1.5 rounded-md transition-colors ${role.user_count > 0 ? 'text-muted-foreground cursor-not-allowed opacity-50' : 'text-destructive hover:bg-destructive/10'}`}
                                                    title={role.user_count > 0 ? (t('admin.cannot_delete_role_with_users') || "Cannot delete role with assigned users") : t('admin.delete_role')}
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

                {/* Mobile Card View */}
                <div className="grid grid-cols-1 md:hidden divide-y divide-white/10">
                    {isLoading ? (
                        <div className="p-8 text-center text-muted-foreground">{t('common.loading')}</div>
                    ) : roles.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">{t('admin.no_roles')}</div>
                    ) : (
                        paginatedRoles.map((role) => (
                            <div key={role.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Shield className="h-4 w-4 text-muted-foreground" />
                                        {role.name}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleEdit(role)} className="p-2 text-blue-500 bg-blue-50/10 rounded-md">
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteClick(role)}
                                            disabled={role.user_count > 0}
                                            className={`p-2 rounded-md ${role.user_count > 0 ? 'text-muted-foreground bg-muted/10' : 'text-destructive bg-destructive/10'}`}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {role.permissions.map(p => (
                                        <span key={p} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold border-transparent bg-secondary text-secondary-foreground">
                                            {p}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center justify-between">
                                    <span className="opacity-70">{t('admin.user_count') || "Users"}:</span>
                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold ${role.user_count > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-muted text-muted-foreground'}`}>
                                        {role.user_count}
                                    </span>
                                </div>
                            </div>
                        ))
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
