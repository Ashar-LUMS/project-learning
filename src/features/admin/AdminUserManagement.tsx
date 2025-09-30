import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Lock, Unlock, ShieldCheck, Loader2, Search, Filter, MoreVertical, User, Mail, Key, Trash2, Edit3, Send, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";

interface UserData {
  id: string;
  email: string;
  raw_user_meta_data: {
    name?: string;
    roles?: string[];
    isLocked?: boolean;
  };
  created_at?: string;
  last_sign_in_at?: string;
}

const AVAILABLE_ROLES: string[] = ((import.meta.env.VITE_ROLES ?? 'User').split(',')).map((r: string) => r.trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b));

// Portal component for dropdown to escape table overflow
const DropdownPortal = ({ children, isOpen, triggerRef }: { children: React.ReactNode; isOpen: boolean; triggerRef: React.RefObject<HTMLDivElement> }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const portalHeight = 250; // Approximate dropdown height
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      let top = rect.bottom + window.scrollY;
      let left = rect.left + window.scrollX;

      // If there's not enough space below, show above
      if (spaceBelow < portalHeight && spaceAbove > portalHeight) {
        top = rect.top + window.scrollY - portalHeight;
      }

      setPosition({ top, left });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={portalRef}
      className="fixed z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      {children}
    </div>
  );
};

// Enhanced RoleDropdown with proper portal behavior
const RoleDropdown = ({
  user,
  onUpdate,
  isOpen,
  onOpenChange,
}: {
  user: UserData;
  onUpdate: (id: string, roles: string[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [draftRoles, setDraftRoles] = useState<string[]>(user.raw_user_meta_data?.roles || []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftRoles(user.raw_user_meta_data?.roles || []);
  }, [user.raw_user_meta_data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Close on escape key
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onOpenChange(false);
        }
      };
      document.addEventListener('keydown', handleEscape);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  const toggleRole = (role: string) => {
    setDraftRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = () => {
    if (draftRoles.length === 0) return;
    onUpdate(user.id, draftRoles.slice().sort((a, b) => a.localeCompare(b)));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraftRoles(user.raw_user_meta_data?.roles || []);
    onOpenChange(false);
  };

  const displayRoles = (user.raw_user_meta_data?.roles || []).slice().sort((a, b) => a.localeCompare(b));

  return (
    <div className="relative" ref={triggerRef}>
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className={`truncate ${displayRoles.length === 0 ? 'text-gray-400' : ''}`}>
          {displayRoles.length > 0 ? displayRoles.join(', ') : "Select roles..."}
        </span>
        <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <DropdownPortal isOpen={isOpen} triggerRef={triggerRef}>
        <div 
          ref={dropdownRef}
          className="w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
        >
          <div className="max-h-48 overflow-y-auto mb-3">
            {AVAILABLE_ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={draftRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{role}</span>
              </label>
            ))}
          </div>

          {draftRoles.length === 0 && (
            <div className="text-xs text-red-600 mb-2 px-2">Select at least one role</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                draftRoles.length === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={handleSave}
              disabled={draftRoles.length === 0}
            >
              Save
            </button>
          </div>
        </div>
      </DropdownPortal>
    </div>
  );
};

// Alternative simpler dropdown without portal (if you prefer)
const SimpleRoleDropdown = ({
  user,
  onUpdate,
  isOpen,
  onOpenChange,
}: {
  user: UserData;
  onUpdate: (id: string, roles: string[]) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const [draftRoles, setDraftRoles] = useState<string[]>(user.raw_user_meta_data?.roles || []);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftRoles(user.raw_user_meta_data?.roles || []);
  }, [user.raw_user_meta_data]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onOpenChange]);

  const toggleRole = (role: string) => {
    setDraftRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = () => {
    if (draftRoles.length === 0) return;
    onUpdate(user.id, draftRoles.slice().sort((a, b) => a.localeCompare(b)));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraftRoles(user.raw_user_meta_data?.roles || []);
    onOpenChange(false);
  };

  const displayRoles = (user.raw_user_meta_data?.roles || []).slice().sort((a, b) => a.localeCompare(b));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition-colors"
        onClick={() => onOpenChange(!isOpen)}
      >
        <span className={`truncate ${displayRoles.length === 0 ? 'text-gray-400' : ''}`}>
          {displayRoles.length > 0 ? displayRoles.join(', ') : "Select roles..."}
        </span>
        <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3">
          <div className="max-h-48 overflow-y-auto mb-3">
            {AVAILABLE_ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center px-3 py-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={draftRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                <span className="ml-3 text-sm font-medium text-gray-700">{role}</span>
              </label>
            ))}
          </div>

          {draftRoles.length === 0 && (
            <div className="text-xs text-red-600 mb-2 px-2">Select at least one role</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              className="px-3 py-1.5 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                draftRoles.length === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={handleSave}
              disabled={draftRoles.length === 0}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);
  const [lockingUserId, setLockingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  
  // Form states
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    roles: ["User"] as string[],
    password: "",
  });
  const [editUser, setEditUser] = useState({
    name: "",
    roles: [] as string[],
  });

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

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchUsers = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const { data, error } = await supabase.rpc("get_users_as_admin");
        if (error) throw error;
        const filteredUsers = data?.filter((user: UserData) => user.id !== currentUserId) || [];
        if (isMounted) {
          setUsers(filteredUsers);
          setFilteredUsers(filteredUsers);
        }
      } catch (err: any) {
        if (isMounted) setErrorMessage(err?.message ?? "Failed to load users");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (currentUserId) {
      fetchUsers();
    }

    return () => {
      isMounted = false;
    };
  }, [currentUserId]);

  // Filter users based on search and filters
  useEffect(() => {
    let result = users;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user => 
        user.email.toLowerCase().includes(term) ||
        user.raw_user_meta_data?.name?.toLowerCase().includes(term) ||
        user.raw_user_meta_data?.roles?.some(role => role.toLowerCase().includes(term))
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(user => 
        statusFilter === "locked" ? user.raw_user_meta_data?.isLocked : !user.raw_user_meta_data?.isLocked
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter(user => 
        user.raw_user_meta_data?.roles?.includes(roleFilter)
      );
    }

    setFilteredUsers(result);
  }, [users, searchTerm, statusFilter, roleFilter]);

  const handleUpdateUserMeta = useCallback(async (userId: string, updates: { roles?: string[]; isLocked?: boolean }) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const currentMeta = user.raw_user_meta_data || {};
      const newRoles = updates.roles || currentMeta.roles || [];
      
      const payload: Record<string, any> = {
        target_user_id: userId,
        new_roles: newRoles,
      };
      
      if (updates.isLocked !== undefined) {
        payload.new_is_locked = updates.isLocked;
      }

      const { data, error } = await supabase.rpc("update_users_as_admin", payload);
      if (error) throw error;

      let updatedMeta: any = data?.raw_user_meta_data || { ...currentMeta };
      if (updates.isLocked !== undefined) {
        updatedMeta = { ...updatedMeta, isLocked: updates.isLocked };
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raw_user_meta_data: updatedMeta } : u)));
      setSuccessMessage("User updated successfully");
    } catch (err) {
      console.error("Error updating user:", err);
      setErrorMessage("Failed to update user");
    }
  }, [users]);

  const handleToggleLock = async (userId: string, lock: boolean) => {
    if (userId === currentUserId) {
      setErrorMessage("You cannot lock/unlock your own account.");
      return;
    }

    const ok = window.confirm(`Are you sure you want to ${lock ? 'lock' : 'unlock'} this user?`);
    if (!ok) return;

    try {
      setLockingUserId(userId);
      await handleUpdateUserMeta(userId, { isLocked: lock });
      setLockingUserId(null);
    } catch (err) {
      console.error("Error updating lock status:", err);
      setErrorMessage("Failed to update user status");
      setLockingUserId(null);
    }
  };

  const handleSendPasswordReset = async (userId: string, email: string) => {
    try {
      setResettingUserId(userId);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      setSuccessMessage(`Password reset email sent to ${email}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to send password reset email");
    } finally {
      setResettingUserId(null);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.email || !newUser.password) {
        setErrorMessage("Email and password are required");
        return;
      }

      const { data, error } = await supabase.auth.admin.createUser({
        email: newUser.email,
        password: newUser.password,
        email_confirm: true,
        user_metadata: {
          name: newUser.name,
          roles: newUser.roles,
        },
      });

      if (error) throw error;

      // Refresh users list
      const { data: usersData } = await supabase.rpc("get_users_as_admin");
      const filteredUsers = usersData?.filter((user: UserData) => user.id !== currentUserId) || [];
      setUsers(filteredUsers);

      setSuccessMessage("User created successfully");
      setIsCreateDialogOpen(false);
      setNewUser({ email: "", name: "", roles: ["User"], password: "" });
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      await handleUpdateUserMeta(selectedUser.id, { roles: editUser.roles });
      
      // Update name in user metadata
      const { error } = await supabase.auth.admin.updateUserById(
        selectedUser.id,
        { user_metadata: { name: editUser.name } }
      );

      if (error) throw error;

      setSuccessMessage("User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    if (selectedUser.id === currentUserId) {
      setErrorMessage("You cannot delete your own account.");
      return;
    }

    try {
      setDeletingUserId(selectedUser.id);
      const { error } = await supabase.auth.admin.deleteUser(selectedUser.id);
      
      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== selectedUser.id));
      setSuccessMessage("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  };

  const openEditDialog = (user: UserData) => {
    setSelectedUser(user);
    setEditUser({
      name: user.raw_user_meta_data?.name || "",
      roles: user.raw_user_meta_data?.roles || [],
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (user: UserData) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
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
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-2">Manage user roles, accounts, and permissions</p>
        </div>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <Badge variant="secondary" className="px-3 py-1">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'}
          </Badge>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search users by name, email, or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="locked">Locked</option>
              </select>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles</option>
                {AVAILABLE_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-600 mt-2">Loading users...</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Roles
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Last Sign In
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.raw_user_meta_data?.name || 'No name'}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <SimpleRoleDropdown
                          user={user}
                          onUpdate={(id, roles) => handleUpdateUserMeta(id, { roles })}
                          isOpen={openDropdownUserId === user.id}
                          onOpenChange={(open) => setOpenDropdownUserId(open ? user.id : null)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        {user.raw_user_meta_data?.isLocked ? (
                          <Badge variant="destructive" className="gap-1.5">
                            <Lock className="w-3 h-3" /> Locked
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1.5">
                            <ShieldCheck className="w-3 h-3" /> Active
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {user.last_sign_in_at 
                          ? new Date(user.last_sign_in_at).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit3 className="w-4 h-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleSendPasswordReset(user.id, user.email)}
                                disabled={resettingUserId === user.id}
                              >
                                {resettingUserId === user.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4 mr-2" />
                                )}
                                Send Reset Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.raw_user_meta_data?.isLocked ? (
                                <DropdownMenuItem 
                                  onClick={() => handleToggleLock(user.id, false)}
                                  disabled={user.id === currentUserId}
                                >
                                  <Unlock className="w-4 h-4 mr-2" />
                                  Unlock Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleToggleLock(user.id, true)}
                                  disabled={user.id === currentUserId}
                                >
                                  <Lock className="w-4 h-4 mr-2" />
                                  Lock Account
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(user)}
                                disabled={user.id === currentUserId}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">No users found</div>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Email *</label>
              <Input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <Input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Password *</label>
              <Input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter temporary password"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Roles</label>
              <div className="mt-2 space-y-2">
                {AVAILABLE_ROLES.map((role) => (
                  <label key={role} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.roles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewUser(prev => ({ ...prev, roles: [...prev.roles, role] }));
                        } else {
                          setNewUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateUser} disabled={!newUser.email || !newUser.password}>
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Full Name</label>
              <Input
                type="text"
                value={editUser.name}
                onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Roles</label>
              <div className="mt-2 space-y-2">
                {AVAILABLE_ROLES.map((role) => (
                  <label key={role} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editUser.roles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditUser(prev => ({ ...prev, roles: [...prev.roles, role] }));
                        } else {
                          setEditUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will permanently remove the user account.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-sm text-red-800">
                <strong>User:</strong> {selectedUser.raw_user_meta_data?.name || 'No name'} ({selectedUser.email})
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={deletingUserId === selectedUser?.id}
            >
              {deletingUserId === selectedUser?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;