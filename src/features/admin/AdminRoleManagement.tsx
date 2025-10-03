import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Loader2,
  Shield,
  Users
} from 'lucide-react';
import { supabase } from '../../supabaseClient.ts';

// Types
interface RoleData {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  is_default: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

interface CreateRoleForm {
  name: string;
  description: string;
  permissions: string[];
}

interface EditRoleForm {
  name: string;
  description: string;
  permissions: string[];
}

const availablePermissions = [
  'users:read',
  'users:write',
  'roles:read',
  'roles:write',
  'system:admin',
  'profile:write',
  'content:read',
  'content:write',
  'content:moderate',
  'reports:view',
  'reports:manage'
];

// Supabase API functions
const fetchRoles = async (): Promise<RoleData[]> => {
  const { data, error } = await supabase
    .from('roles')
    .select(`
      *,
      user_roles(count)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }

  // Transform the data to match our RoleData interface
  return data.map(role => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: role.permissions || [],
    is_default: role.is_default,
    user_count: role.user_roles?.[0]?.count || 0,
    created_at: role.created_at,
    updated_at: role.updated_at
  }));
};

const createRole = async (role: CreateRoleForm): Promise<RoleData> => {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      is_default: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating role:', error);
    throw error;
  }

  return {
    ...data,
    user_count: 0
  };
};

const updateRole = async (roleId: string, updates: EditRoleForm): Promise<RoleData> => {
  const { data, error } = await supabase
    .from('roles')
    .update({
      name: updates.name,
      description: updates.description,
      permissions: updates.permissions,
      updated_at: new Date().toISOString()
    })
    .eq('id', roleId)
    .select(`
      *,
      user_roles(count)
    `)
    .single();

  if (error) {
    console.error('Error updating role:', error);
    throw error;
  }

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    permissions: data.permissions || [],
    is_default: data.is_default,
    user_count: data.user_roles?.[0]?.count || 0,
    created_at: data.created_at,
    updated_at: data.updated_at
  };
};

const deleteRole = async (roleId: string): Promise<void> => {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', roleId);

  if (error) {
    console.error('Error deleting role:', error);
    throw error;
  }
};

const RoleManagement: React.FC = () => {
  // State management
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<RoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdownRoleId, setOpenDropdownRoleId] = useState<string | null>(null);
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleData | null>(null);
  
  // Form states
  const [newRole, setNewRole] = useState<CreateRoleForm>({
    name: '',
    description: '',
    permissions: []
  });
  
  const [editRole, setEditRole] = useState<EditRoleForm>({
    name: '',
    description: '',
    permissions: []
  });

  // Loading states for actions
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Clear messages after timeout
  useEffect(() => {
    if (errorMessage || successMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage, successMessage]);

  // Load roles on component mount
  const loadRoles = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const rolesData = await fetchRoles();
      setRoles(rolesData);
      setFilteredRoles(rolesData);
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  // Filter roles based on search
  useEffect(() => {
    let result = roles;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(role => 
        role.name.toLowerCase().includes(term) ||
        role.description.toLowerCase().includes(term) ||
        role.permissions.some(permission => permission.toLowerCase().includes(term))
      );
    }

    setFilteredRoles(result);
  }, [roles, searchTerm]);

  // Role management handlers
  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      setErrorMessage('Role name is required');
      return;
    }

    if (newRole.permissions.length === 0) {
      setErrorMessage('At least one permission is required');
      return;
    }

    try {
      setCreatingRole(true);
      const createdRole = await createRole(newRole);
      setRoles(prev => [...prev, createdRole]);
      setSuccessMessage(`Role "${createdRole.name}" created successfully`);
      setIsCreateDialogOpen(false);
      setNewRole({ name: '', description: '', permissions: [] });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    if (!editRole.name.trim()) {
      setErrorMessage('Role name is required');
      return;
    }

    if (editRole.permissions.length === 0) {
      setErrorMessage('At least one permission is required');
      return;
    }

    try {
      setUpdatingRole(true);
      const updatedRole = await updateRole(selectedRole.id, editRole);
      setRoles(prev => prev.map(role => 
        role.id === selectedRole.id ? updatedRole : role
      ));
      setSuccessMessage(`Role "${updatedRole.name}" updated successfully`);
      setIsEditDialogOpen(false);
      setSelectedRole(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    if (selectedRole.user_count > 0) {
      setErrorMessage(`Cannot delete role "${selectedRole.name}" because it is assigned to ${selectedRole.user_count} user(s)`);
      return;
    }

    try {
      setDeletingRoleId(selectedRole.id);
      await deleteRole(selectedRole.id);
      setRoles(prev => prev.filter(role => role.id !== selectedRole.id));
      setSuccessMessage(`Role "${selectedRole.name}" deleted successfully`);
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete role');
    } finally {
      setDeletingRoleId(null);
    }
  };

  // Dialog handlers
  const openEditDialog = (role: RoleData) => {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions]
    });
    setIsEditDialogOpen(true);
    setOpenDropdownRoleId(null);
  };

  const openDeleteDialog = (role: RoleData) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
    setOpenDropdownRoleId(null);
  };

  // Permission handlers
  const togglePermission = (permission: string, form: 'create' | 'edit') => {
    const setForm = form === 'create' ? setNewRole : setEditRole;
    const currentForm = form === 'create' ? newRole : editRole;

    setForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const selectAllPermissions = (form: 'create' | 'edit') => {
    const setForm = form === 'create' ? setNewRole : setEditRole;
    setForm(prev => ({
      ...prev,
      permissions: [...availablePermissions]
    }));
  };

  const clearAllPermissions = (form: 'create' | 'edit') => {
    const setForm = form === 'create' ? setNewRole : setEditRole;
    setForm(prev => ({
      ...prev,
      permissions: []
    }));
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Messages */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700">
            {successMessage}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Role Management</h1>
            <p className="text-gray-600 mt-2">Manage system roles and permissions</p>
          </div>
          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'}
            </div>
            <button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Role
            </button>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search roles by name, description, or permissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Roles Table */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600 mt-2">Loading roles...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Permissions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-100 p-2 rounded-lg">
                            <Shield className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{role.name}</div>
                            <div className="text-sm text-gray-500">{role.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {role.permissions.slice(0, 3).map((permission) => (
                            <span
                              key={permission}
                              className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                            >
                              {permission}
                            </span>
                          ))}
                          {role.permissions.length > 3 && (
                            <span className="inline-block bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs">
                              +{role.permissions.length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="w-4 h-4" />
                          {role.user_count}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {formatDate(role.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        {role.is_default ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Default
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Custom
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative">
                          <button
                            onClick={() => setOpenDropdownRoleId(
                              openDropdownRoleId === role.id ? null : role.id
                            )}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-400" />
                          </button>
                          
                          {openDropdownRoleId === role.id && (
                            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                              <button
                                onClick={() => openEditDialog(role)}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Role
                              </button>
                              <button
                                onClick={() => openDeleteDialog(role)}
                                disabled={role.is_default || role.user_count > 0}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Role
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredRoles.length === 0 && (
              <div className="text-center py-12">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No roles found</p>
                <p className="text-gray-400 mt-2">
                  {searchTerm ? 'Try adjusting your search terms' : 'Get started by creating your first role'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create Role Dialog */}
        {isCreateDialogOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Create New Role</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={newRole.name}
                    onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter role name (e.g., Manager, Viewer)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newRole.description}
                    onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this role can do..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Permissions *
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllPermissions('create')}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAllPermissions('create')}
                        className="text-xs text-gray-600 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={newRole.permissions.includes(permission)}
                          onChange={() => togglePermission(permission, 'create')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{permission}</span>
                      </label>
                    ))}
                  </div>
                  
                  {newRole.permissions.length === 0 && (
                    <p className="text-red-500 text-sm mt-2">At least one permission is required</p>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRole}
                  disabled={creatingRole || !newRole.name.trim() || newRole.permissions.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  {creatingRole && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Role Dialog */}
        {isEditDialogOpen && selectedRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Edit Role</h2>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role Name *
                  </label>
                  <input
                    type="text"
                    value={editRole.name}
                    onChange={(e) => setEditRole(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editRole.description}
                    onChange={(e) => setEditRole(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Permissions *
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => selectAllPermissions('edit')}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => clearAllPermissions('edit')}
                        className="text-xs text-gray-600 hover:text-gray-700"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={editRole.permissions.includes(permission)}
                          onChange={() => togglePermission(permission, 'edit')}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{permission}</span>
                      </label>
                    ))}
                  </div>
                  
                  {editRole.permissions.length === 0 && (
                    <p className="text-red-500 text-sm mt-2">At least one permission is required</p>
                  )}
                </div>
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsEditDialogOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  disabled={updatingRole || !editRole.name.trim() || editRole.permissions.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  {updatingRole && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update Role
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Role Dialog */}
        {isDeleteDialogOpen && selectedRole && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Delete Role</h2>
              </div>
              
              <div className="p-6">
                <p className="text-gray-700">
                  Are you sure you want to delete the role <strong>"{selectedRole.name}"</strong>?
                </p>
                
                {selectedRole.user_count > 0 && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      This role is currently assigned to <strong>{selectedRole.user_count}</strong> user(s). 
                      You must reassign these users before deleting this role.
                    </p>
                  </div>
                )}
                
                {selectedRole.is_default && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">
                      This is a default role and cannot be deleted.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteRole}
                  disabled={selectedRole.is_default || selectedRole.user_count > 0 || deletingRoleId === selectedRole.id}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                  {deletingRoleId === selectedRole.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete Role
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleManagement;