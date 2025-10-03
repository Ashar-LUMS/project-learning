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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';

// Types - simplified to match your table structure
interface RoleData {
  id: string;
  name: string;
  user_count: number; // This will be calculated separately
}

interface CreateRoleForm {
  name: string;
}

interface EditRoleForm {
  name: string;
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

// Supabase API functions - simplified for your table structure
// const fetchRoles = async (): Promise<RoleData[]> => {
//   const { data, error } = await supabase
//     .from('roles')
//     .select('*')
//     .order('id', { ascending: true });

//   if (error) {
//     console.error('Error fetching roles:', error);
//     throw error;
//   }

//   if (!data) {
//     return [];
//   }

//   // Get user counts for each role
//   const rolesWithUserCounts = await Promise.all(
//     data.map(async (role) => {
//       // Count users for this role - you might need to adjust this based on your user-role relationship
//       const { count, error: countError } = await supabase
//         .from('user_roles') // or whatever your user-role relationship table is called
//         .select('*', { count: 'exact', head: true })
//         .eq('role_id', role.id);

//       if (countError) {
//         console.error('Error counting users for role:', role.id, countError);
//       }

//       return {
//         id: role.id,
//         name: role.name,
//         user_count: count || 0
//       };
//     })
//   );

//   return rolesWithUserCounts;
// };

// If you don't have a user_roles table yet, use this simpler version:
const fetchRolesSimple = async (): Promise<RoleData[]> => {
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }

  if (!data) {
    return [];
  }

  // Return with user_count as 0 for now
  return data.map(role => ({
    id: role.id,
    name: role.name,
    user_count: 0 // Default to 0 since we don't have user counts yet
  }));
};

const createRole = async (role: CreateRoleForm): Promise<RoleData> => {
  const { data, error } = await supabase
    .from('roles')
    .insert({
      name: role.name,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating role:', error);
    throw error;
  }

  return {
    ...data,
    user_count: 0 // New role has 0 users
  };
};

const updateRole = async (roleId: string, updates: EditRoleForm): Promise<RoleData> => {
  const { data, error } = await supabase
    .from('roles')
    .update({
      name: updates.name,
    })
    .eq('id', roleId)
    .select()
    .single();

  if (error) {
    console.error('Error updating role:', error);
    throw error;
  }

  // Get user count for the updated role
  const { count } = await supabase
    .from('user_roles') // adjust table name as needed
    .select('*', { count: 'exact', head: true })
    .eq('role_id', roleId);

  return {
    id: data.id,
    name: data.name,
    user_count: count || 0
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
  });

  const [editRole, setEditRole] = useState<EditRoleForm>({
    name: '',
  });

  // Loading states for actions
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);

  // Dialog-specific error states
  const [createDialogError, setCreateDialogError] = useState<string | null>(null);
  const [editDialogError, setEditDialogError] = useState<string | null>(null);
  const [deleteDialogError, setDeleteDialogError] = useState<string | null>(null);

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
      // Use the simple version for now - adjust based on your needs
      const rolesData = await fetchRolesSimple();
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
        role.name.toLowerCase().includes(term)
      );
    }

    setFilteredRoles(result);
  }, [roles, searchTerm]);

  // Role management handlers
  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      setCreateDialogError('Role name is required');
      return;
    }

    try {
      setCreatingRole(true);
      setCreateDialogError(null);
      const createdRole = await createRole(newRole);
      setRoles(prev => [...prev, createdRole]);
      setSuccessMessage(`Role "${createdRole.name}" created successfully`);
      setIsCreateDialogOpen(false);
      setNewRole({ name: '' });
    } catch (err: any) {
      setCreateDialogError(err?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;

    if (!editRole.name.trim()) {
      setEditDialogError('Role name is required');
      return;
    }

    try {
      setUpdatingRole(true);
      setEditDialogError(null);
      const updatedRole = await updateRole(selectedRole.id, editRole);
      setRoles(prev => prev.map(role =>
        role.id === selectedRole.id ? updatedRole : role
      ));
      setSuccessMessage(`Role "${updatedRole.name}" updated successfully`);
      setIsEditDialogOpen(false);
      setSelectedRole(null);
    } catch (err: any) {
      setEditDialogError(err?.message || 'Failed to update role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    if (selectedRole.user_count > 0) {
      setDeleteDialogError(`Cannot delete role "${selectedRole.name}" because it is assigned to ${selectedRole.user_count} user(s)`);
      return;
    }

    try {
      setDeletingRoleId(selectedRole.id);
      setDeleteDialogError(null);
      await deleteRole(selectedRole.id);
      setRoles(prev => prev.filter(role => role.id !== selectedRole.id));
      setSuccessMessage(`Role "${selectedRole.name}" deleted successfully`);
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
    } catch (err: any) {
      setDeleteDialogError(err?.message || 'Failed to delete role');
    } finally {
      setDeletingRoleId(null);
    }
  };

  // Dialog handlers
  const openEditDialog = (role: RoleData) => {
    setSelectedRole(role);
    setEditRole({
      name: role.name,
    });
    setIsEditDialogOpen(true);
    setOpenDropdownRoleId(null);
    setEditDialogError(null);
  };

  const openDeleteDialog = (role: RoleData) => {
    setSelectedRole(role);
    setIsDeleteDialogOpen(true);
    setOpenDropdownRoleId(null);
    setDeleteDialogError(null);
  };

  // Format date for display - removed since we don't have dates
  // const formatDate = (dateString: string) => {
  //   return new Date(dateString).toLocaleDateString('en-US', {
  //     year: 'numeric',
  //     month: 'short',
  //     day: 'numeric'
  //   });
  // };

  return (
    <div className="space-y-2 p-2">
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
          <p className="text-gray-600 mt-2">Manage system roles</p>
        </div>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <Badge variant="secondary" className="px-3 py-1">
            {filteredRoles.length} {filteredRoles.length === 1 ? 'role' : 'roles'}
          </Badge>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Role
          </Button>
        </div>
      </div>

      {/* Search Card */}
      <Card>
        <CardContent className="">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search roles by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600 mt-2">Loading roles...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
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
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {/* Permissions placeholder */}
                        <span className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                          Permissions disabled
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        {role.user_count}
                      </div>
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
        </Card>
      )}

      {/* Create Role Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a new role with specific permissions and access levels.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Error message inside create dialog */}
            {createDialogError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {createDialogError}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name *
              </label>
              <Input
                type="text"
                value={newRole.name}
                onChange={(e) => {
                  setNewRole(prev => ({ ...prev, name: e.target.value }));
                  setCreateDialogError(null);
                }}
                placeholder="Enter role name (e.g., Manager, Viewer)"
              />
            </div>
            
            {/* Permissions Section - UI visible but functionality commented out */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    disabled
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-700"
                    disabled
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded cursor-not-allowed opacity-50">
                    <input
                      type="checkbox"
                      disabled
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{permission}</span>
                  </label>
                ))}
              </div>
              
              <p className="text-gray-500 text-sm mt-2">
                Permissions functionality is currently disabled
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={creatingRole || !newRole.name.trim()}
            >
              {creatingRole && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role information and permissions.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Error message inside edit dialog */}
            {editDialogError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {editDialogError}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role Name *
              </label>
              <Input
                type="text"
                value={editRole.name}
                onChange={(e) => {
                  setEditRole(prev => ({ ...prev, name: e.target.value }));
                  setEditDialogError(null);
                }}
              />
            </div>
            
            {/* Permissions Section - UI visible but functionality commented out */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    disabled
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="text-xs text-gray-600 hover:text-gray-700"
                    disabled
                  >
                    Clear All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                {availablePermissions.map((permission) => (
                  <label key={permission} className="flex items-center space-x-3 p-2 hover:bg-gray-100 rounded cursor-not-allowed opacity-50">
                    <input
                      type="checkbox"
                      disabled
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{permission}</span>
                  </label>
                ))}
              </div>
              
              <p className="text-gray-500 text-sm mt-2">
                Permissions functionality is currently disabled
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={updatingRole || !editRole.name.trim()}
            >
              {updatingRole && <Loader2 className="w-4 h-4 animate-spin" />}
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Role Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this role? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Error message inside delete dialog */}
            {deleteDialogError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                {deleteDialogError}
              </div>
            )}
            
            {selectedRole && (
              <>
                <p className="text-gray-700">
                  Are you sure you want to delete the role <strong>"{selectedRole.name}"</strong>?
                </p>
                
                {selectedRole.user_count > 0 && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800 text-sm">
                      This role is currently assigned to <strong>{selectedRole.user_count}</strong> user(s). 
                      You must reassign these users before deleting this role.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteRole}
              // disabled={selectedRole?.user_count > 0 || deletingRoleId === selectedRole?.id}
            >
              {deletingRoleId === selectedRole?.id && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleManagement;