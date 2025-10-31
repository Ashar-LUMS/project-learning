import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardDescription } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Skeleton } from "../../components/ui/skeleton";
import { Lock, Unlock, ShieldCheck, Loader2, Search, MoreVertical, User, Mail, Trash2, Edit3, Send, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { useAllRoles } from "../../roles";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";

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
  email_confirmed_at?: string;
}

// User Info Dialog Component
const UserInfoDialog = ({
  user,
  open,
  onOpenChange,
}: {
  user: UserData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const getUserInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src="" alt={user.raw_user_meta_data?.name} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-lg font-medium">
                {getUserInitials(user.raw_user_meta_data?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {user.raw_user_meta_data?.name || 'No name'}
              </h3>
              <p className="text-gray-600 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </p>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">User ID</Label>
              <p className="text-sm font-mono bg-gray-50 p-2 rounded border break-all">
                {user.id}
              </p>
            </div>
            
            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Account Status</Label>
              <div>
                {user.raw_user_meta_data?.isLocked ? (
                  <Badge variant="destructive" className="gap-1.5">
                    <Lock className="w-3 h-3" /> Locked
                  </Badge>
                ) : (
                  <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1.5">
                    <ShieldCheck className="w-3 h-3" /> Active
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Email Status</Label>
              <div>
                {user.email_confirmed_at ? (
                  <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1.5">
                    <Mail className="w-3 h-3" /> Confirmed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1.5">
                    <Mail className="w-3 h-3" /> Pending
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Roles</Label>
              <div className="flex flex-wrap gap-1">
                {(user.raw_user_meta_data?.roles || []).length > 0 ? (
                  (user.raw_user_meta_data?.roles || []).map(role => (
                    <Badge key={role} variant="secondary" className="px-2 py-1">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-gray-500">No roles assigned</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Account Created</Label>
              <p className="text-sm">{formatDate(user.created_at)}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Last Sign In</Label>
              <p className="text-sm">{formatDate(user.last_sign_in_at)}</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-medium text-gray-500">Email Confirmed</Label>
              <p className="text-sm">{user.email_confirmed_at ? formatDate(user.email_confirmed_at) : 'Not confirmed'}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Role Selection Dialog Component
const RoleSelectionDialog = ({
  user,
  open,
  onOpenChange,
  onSave,
  availableRoles,
  loading,
}: {
  user: UserData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (roles: string[]) => void;
  availableRoles: string[];
  loading: boolean;
}) => {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.raw_user_meta_data?.roles || []);

  // Reset selected roles when dialog opens or user changes
  useEffect(() => {
    if (open) {
      setSelectedRoles(user.raw_user_meta_data?.roles || []);
    }
  }, [open, user]);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  const handleSave = () => {
    if (selectedRoles.length === 0) return;
    onSave(selectedRoles.slice().sort((a, b) => a.localeCompare(b)));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setSelectedRoles(user.raw_user_meta_data?.roles || []);
    onOpenChange(false);
  };

  const displayRoles = (user.raw_user_meta_data?.roles || []).slice().sort((a, b) => a.localeCompare(b));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage Roles for {user.raw_user_meta_data?.name || user.email}
          </DialogTitle>
          <DialogDescription>
            Select the roles for this user. At least one role must be selected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Current Roles</Label>
            <div className="mt-2">
              {displayRoles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {displayRoles.map(role => (
                    <Badge key={role} variant="secondary" className="px-2 py-1">
                      {role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No roles assigned</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Available Roles</Label>
            <div className="max-h-60 overflow-y-auto border rounded-lg p-4">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md my-1" />
                ))
              ) : (
                <div className="space-y-2">
                  {availableRoles.map((role) => (
                    <div
                      key={role}
                      className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Checkbox
                        id={`role-${user.id}-${role}`}
                        checked={selectedRoles.includes(role)}
                        onCheckedChange={() => toggleRole(role)}
                      />
                      <Label
                        htmlFor={`role-${user.id}-${role}`}
                        className="text-sm font-normal flex-1 cursor-pointer"
                      >
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedRoles.length === 0 && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              Please select at least one role
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={selectedRoles.length === 0}>
            Save Roles
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced RoleDropdown with popup trigger
const RoleDropdown = ({
  user,
  onUpdate,
  availableRoles,
}: {
  user: UserData;
  onUpdate: (id: string, roles: string[]) => void;
  availableRoles: string[];
}) => {
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);

  const handleSaveRoles = (roles: string[]) => {
    onUpdate(user.id, roles);
  };

  const displayRoles = (user.raw_user_meta_data?.roles || []).slice().sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Button
        variant="outline"
        className="flex items-center justify-between w-full px-3 py-2 text-sm"
        onClick={() => setIsRoleDialogOpen(true)}
      >
        <span className={`truncate ${displayRoles.length === 0 ? 'text-gray-400' : ''}`}>
          {displayRoles.length > 0 ? displayRoles.join(', ') : "Select roles..."}
        </span>
        <Settings className="w-4 h-4 ml-2 text-gray-400" />
      </Button>

      <RoleSelectionDialog
        user={user}
        open={isRoleDialogOpen}
        onOpenChange={setIsRoleDialogOpen}
        onSave={handleSaveRoles}
        availableRoles={availableRoles}
        loading={availableRoles.length === 0}
      />
    </>
  );
};

// Fixed Pagination Component
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  totalItems: number;
  onPageSizeChange: (size: number) => void;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange
}: PaginationProps) => {
  // Use a ref to prevent unnecessary re-renders
  const pageSizeRef = useRef(pageSize);

  useEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);

  const handlePageSizeChange = (value: string) => {
    const newSize = Number(value);
    onPageSizeChange(newSize);
  };

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t">
      <div className="flex items-center space-x-2">
        <Label htmlFor="page-size" className="text-sm text-gray-600">
          Rows per page
        </Label>
        <Select
          value={pageSize.toString()}
          onValueChange={handlePageSizeChange}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue>
              <span>{pageSize}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to first page</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <span className="sr-only">Go to previous page</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">Go to next page</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            <span className="sr-only">Go to last page</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const AVAILABLE_ROLES = useAllRoles();
  const rolesLoading = AVAILABLE_ROLES.length === 0;
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [lockingUserId, setLockingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [emailingUserId, setEmailingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "locked">("all");
  const [emailStatusFilter, setEmailStatusFilter] = useState<"all" | "confirmed" | "pending">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isUserInfoDialogOpen, setIsUserInfoDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userForInfo, setUserForInfo] = useState<UserData | null>(null);

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

  // Calculate pagination
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, emailStatusFilter, roleFilter, pageSize]);

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
        // Do not filter out the current user — show everyone, but keep actions disabled for current user
        const fetchedUsers = (data as UserData[]) || [];
        if (isMounted) {
          setUsers(fetchedUsers);
          setFilteredUsers(fetchedUsers);
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

    // Email status filter
    if (emailStatusFilter !== "all") {
      result = result.filter(user =>
        emailStatusFilter === "confirmed" ? user.email_confirmed_at : !user.email_confirmed_at
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      result = result.filter(user =>
        user.raw_user_meta_data?.roles?.includes(roleFilter)
      );
    }

    setFilteredUsers(result);
  }, [users, searchTerm, statusFilter, emailStatusFilter, roleFilter]);

  const handleUpdateUserMeta = useCallback(async (userId: string, updates: { roles?: string[]; isLocked?: boolean }) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const currentMeta = user.raw_user_meta_data || {};

      const payload: Record<string, any> = {
        target_user_id: userId,
        new_roles: updates.roles !== undefined ? updates.roles : currentMeta.roles || [],
        new_name: currentMeta.name || null,
        new_is_locked: updates.isLocked !== undefined ? updates.isLocked : currentMeta.isLocked || false
      };

      const { data, error } = await supabase.rpc("update_users_as_admin", payload);
      if (error) throw error;

      let updatedMeta: any = data?.raw_user_meta_data || { ...currentMeta };
      if (updates.isLocked !== undefined) {
        updatedMeta = { ...updatedMeta, isLocked: updates.isLocked };
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raw_user_meta_data: updatedMeta } : u)));
      setSuccessMessage("User roles updated successfully");
    } catch (err) {
      console.error("Error updating user:", err);
      setErrorMessage("Failed to update user roles");
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
        redirectTo: `${window.location.origin}/forgot-password`,
      });

      if (error) throw error;

      setSuccessMessage(`Password reset email sent to ${email}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to send password reset email");
    } finally {
      setResettingUserId(null);
    }
  };

  const handleResendConfirmation = async (userId: string, email: string) => {
    try {
      setResettingUserId(userId);
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setSuccessMessage(`Confirmation email resent to ${email}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to resend confirmation email");
    } finally {
      setResettingUserId(null);
    }
  };

  const handleEmailUser = async (user: UserData) => {
    try {
      setEmailingUserId(user.id);
      // This will open the user's default email client with the user's email pre-filled
      const subject = encodeURIComponent(`Message from Admin`);
      const body = encodeURIComponent(`Hello ${user.raw_user_meta_data?.name || user.email},\n\n`);
      window.open(`mailto:${user.email}?subject=${subject}&body=${body}`, '_blank');
      setSuccessMessage(`Email client opened for ${user.email}`);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to open email client");
    } finally {
      setEmailingUserId(null);
    }
  };

  const openUserInfoDialog = (user: UserData) => {
    setUserForInfo(user);
    setIsUserInfoDialogOpen(true);
  };

  const handleCreateUser = async () => {
    try {
      if (!newUser.email || !newUser.password) {
        setErrorMessage("Email and password are required");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            name: newUser.name,
            roles: newUser.roles,
          },
        },
      });

      if (error) throw error;

      setSuccessMessage(`User created successfully. ${data.user?.email_confirmed_at ? 'User can now sign in.' : 'Confirmation email sent to ' + newUser.email}`);
      setIsCreateDialogOpen(false);
      setNewUser({ email: "", name: "", roles: ["User"], password: "" });
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    try {
      const currentName = selectedUser.raw_user_meta_data?.name || "";
      const currentRoles = selectedUser.raw_user_meta_data?.roles || [];

      // Check if roles changed
      const rolesChanged =
        [...currentRoles].sort().join(",") !== [...editUser.roles].sort().join(",");

      // Check if name changed
      const nameChanged = currentName !== editUser.name;

      if (!rolesChanged && !nameChanged) {
        setErrorMessage("No changes detected. Please modify the name or roles to update.");
        return;
      }

      // Use RPC to update both name and roles in a single call
      const currentMeta = selectedUser.raw_user_meta_data || {};

      const payload: Record<string, any> = {
        target_user_id: selectedUser.id,
        new_roles: rolesChanged ? editUser.roles : currentMeta.roles || [],
        new_name: nameChanged ? editUser.name : currentMeta.name || null,
        new_is_locked: currentMeta.isLocked || false
      };

      const { data, error } = await supabase.rpc("update_users_as_admin", payload);

      if (error) {
        console.error("Error updating user:", error);
        setErrorMessage(error.message || "Failed to update user");
        return;
      }

      // Update local state with the returned data
      if (data) {
        setUsers((prev) => prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, raw_user_meta_data: data.raw_user_meta_data }
            : u
        ));
      } else {
        // Fallback: refresh users list if no data returned
        const { data: usersData } = await supabase.rpc("get_users_as_admin");
        const filteredUsers = usersData?.filter((user: UserData) => user.id !== currentUserId) || [];
        setUsers(filteredUsers);
      }

      setSuccessMessage("User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
    } catch (err: any) {
      console.error("Error in handleUpdateUser:", err);
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
      const { error } = await supabase.rpc("delete_user_as_admin", {
        target_user_id: selectedUser.id
      });

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

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-2 p-2 ">
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
            {totalItems} {totalItems === 1 ? 'user' : 'users'}
          </Badge>
          <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-2">
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
              <Select value={statusFilter} onValueChange={(value: "all" | "active" | "locked") => setStatusFilter(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="locked">Locked</SelectItem>
                </SelectContent>
              </Select>

              <Select value={emailStatusFilter} onValueChange={(value: "all" | "confirmed" | "pending") => setEmailStatusFilter(value)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Email Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Email Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>

              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {rolesLoading ? (
                    <SelectItem value="loading" disabled>Loading roles...</SelectItem>
                  ) : (
                    AVAILABLE_ROLES.map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
          <CardHeader>
            <CardDescription>
              Showing {Math.min(totalItems, startIndex + 1)}-{Math.min(endIndex, totalItems)} of {totalItems} users
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Status</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentUsers.map((user) => (
                    <TableRow key={user.id} className="hover:bg-gray-50/50">
                      <TableCell>
                        <div className="flex items-center">
                          <button
                            onClick={() => openUserInfoDialog(user)}
                            className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer"
                          >
                            <User className="w-5 h-5 text-white" />
                          </button>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.raw_user_meta_data?.name || 'No name'}
                              {currentUserId && user.id === currentUserId && (
                                <span className="ml-2 text-s text-muted-foreground">(You)</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <Mail className="w-3 h-3 mr-1" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleDropdown
                          user={user}
                          onUpdate={(id, roles) => {
                            void handleUpdateUserMeta(id, { roles });
                          }}
                          availableRoles={AVAILABLE_ROLES}
                        />
                      </TableCell>
                      <TableCell>
                        {user.raw_user_meta_data?.isLocked ? (
                          <Badge variant="destructive" className="gap-1.5">
                            <Lock className="w-3 h-3" /> Locked
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100 gap-1.5">
                            <ShieldCheck className="w-3 h-3" /> Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.email_confirmed_at ? (
                          <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-100 gap-1.5">
                            <Mail className="w-3 h-3" /> Confirmed
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 gap-1.5">
                            <Mail className="w-3 h-3" /> Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {user.last_sign_in_at
                          ? new Date(user.last_sign_in_at).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => handleEmailUser(user)}
                                disabled={emailingUserId === user.id}
                              >
                                {emailingUserId === user.id ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Mail className="w-4 h-4 mr-2" />
                                )}
                                Email User
                              </DropdownMenuItem>
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
                              {!user.email_confirmed_at && (
                                <DropdownMenuItem
                                  onClick={() => handleResendConfirmation(user.id, user.email)}
                                  disabled={resettingUserId === user.id}
                                >
                                  {resettingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Mail className="w-4 h-4 mr-2" />
                                  )}
                                  Resend Confirmation
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {user.raw_user_meta_data?.isLocked ? (
                                <DropdownMenuItem
                                  onClick={() => handleToggleLock(user.id, false)}
                                  disabled={user.id === currentUserId || lockingUserId === user.id}
                                >
                                  {lockingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Unlock className="w-4 h-4 mr-2" />
                                  )}
                                  Unlock Account
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleToggleLock(user.id, true)}
                                  disabled={user.id === currentUserId || lockingUserId === user.id}
                                >
                                  {lockingUserId === user.id ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                  ) : (
                                    <Lock className="w-4 h-4 mr-2" />
                                  )}
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-2">No users found</div>
                <p className="text-gray-500 text-sm">Try adjusting your search or filters</p>
              </div>
            )}

            {/* Pagination */}
            {filteredUsers.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                pageSize={pageSize}
                totalItems={totalItems}
                onPageSizeChange={handlePageSizeChange}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will receive an email to set their password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Enter temporary password"
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2">
                {rolesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 rounded-md" />
                  ))
                ) : (
                  AVAILABLE_ROLES.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={newUser.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewUser(prev => ({ ...prev, roles: [...prev.roles, role] }));
                          } else {
                            setNewUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
                          }
                        }}
                      />
                      <Label htmlFor={`role-${role}`} className="text-sm font-normal">
                        {role}
                      </Label>
                    </div>
                  ))
                )}
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and roles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                type="text"
                value={editUser.name}
                onChange={(e) => setEditUser(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2">
                {rolesLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-6 rounded-md" />
                  ))
                ) : (
                  AVAILABLE_ROLES.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={editUser.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setEditUser(prev => ({ ...prev, roles: [...prev.roles, role] }));
                          } else {
                            setEditUser(prev => ({ ...prev, roles: prev.roles.filter(r => r !== role) }));
                          }
                        }}
                      />
                      <Label htmlFor={`edit-role-${role}`} className="text-sm font-normal">
                        {role}
                      </Label>
                    </div>
                  ))
                )}
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
        <DialogContent className="sm:max-w-md">
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

      {/* User Info Dialog */}
      {userForInfo && (
        <UserInfoDialog
          user={userForInfo}
          open={isUserInfoDialogOpen}
          onOpenChange={setIsUserInfoDialogOpen}
        />
      )}
    </div>
  );
};

export default UserManagement;