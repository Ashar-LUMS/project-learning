import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Lock, Unlock, ShieldCheck, Loader2 } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  raw_user_meta_data: {
    name?: string;
    roles?: string[];
    isLocked?: boolean;
  };
}

const AVAILABLE_ROLES: string[] = ((import.meta.env.VITE_ROLES ?? 'User').split(',')).map((r: string) => r.trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b));

// Dropdown component for selecting roles
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
  const [savedRoles, setSavedRoles] = useState<string[]>(user.raw_user_meta_data?.roles || []);

  // Keep local state in sync if parent updates the user prop
  useEffect(() => {
    const incoming = user.raw_user_meta_data?.roles || [];
    setDraftRoles(incoming);
    setSavedRoles(incoming);
  }, [user.raw_user_meta_data]);

  const toggleRole = (role: string) => {
    setDraftRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  };

  const handleSave = () => {
    if (draftRoles.length === 0) return; // guard: require at least one role
    setSavedRoles(draftRoles.slice().sort((a, b) => a.localeCompare(b)));
    onUpdate(user.id, draftRoles.slice().sort((a, b) => a.localeCompare(b)));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraftRoles(savedRoles);
    onOpenChange(false);
  };

  const displaySaved = (savedRoles || []).slice().sort((a, b) => a.localeCompare(b));

  return (
    <div className="relative">
      {/* Button */}
      <button
        className="border border-gray-300 px-2 py-1 rounded w-full text-left"
        onClick={() => onOpenChange(!isOpen)}
      >
        {displaySaved.length > 0 ? displaySaved.join(', ') : "Select roles..."}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute mt-1 w-56 bg-white border border-gray-200 rounded shadow-lg z-10 p-2">
          {AVAILABLE_ROLES.map((role) => (
            <label
              key={role}
              className="flex items-center px-2 py-1 hover:bg-gray-100 cursor-pointer"
            >
              <input
                type="checkbox"
                className="mr-2"
                checked={draftRoles.includes(role)}
                onChange={() => toggleRole(role)}
              />
              {role}
            </label>
          ))}

          {/* Save / Cancel buttons */}
          <div className="flex justify-end gap-2 mt-2">
            <button
              className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              className={`px-3 py-1 text-sm rounded ${draftRoles.length === 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
              onClick={handleSave}
              disabled={draftRoles.length === 0}
            >
              Save
            </button>
          </div>
          {draftRoles.length === 0 && (
            <div className="text-xs text-red-600 mt-2">Select at least one role before saving.</div>
          )}
        </div>
      )}
    </div>
  );
};

const UserManagement = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // which user's dropdown is currently open (only one at a time)
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);
  const [lockingUserId, setLockingUserId] = useState<string | null>(null);

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
        if (isMounted) setUsers(filteredUsers);
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

  const handleUpdateUserMeta = async (userId: string, updates: { roles?: string[]; isLocked?: boolean }) => {
    try {
      const user = users.find(u => u.id === userId);
      if (!user) return;

      const currentMeta = user.raw_user_meta_data || {};
      const newRoles = updates.roles || currentMeta.roles || [];
      // Build payload conditionally so we don't accidentally null out lock status when only editing roles
      const payload: Record<string, any> = {
        target_user_id: userId,
        new_roles: newRoles,
      };
      if (updates.isLocked !== undefined) {
        payload.new_is_locked = updates.isLocked; // boolean passed directly
      }

      const { data, error } = await supabase.rpc("update_users_as_admin", payload);
      if (error) throw error;

      // Fallback if RPC didn't return expected structure
      let updatedMeta: any = data?.raw_user_meta_data || { ...currentMeta };
      if (updates.isLocked !== undefined) {
        updatedMeta = { ...updatedMeta, isLocked: updates.isLocked };
      }

      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, raw_user_meta_data: updatedMeta } : u)));
    } catch (err) {
      console.error("Error updating user:", err);
      setErrorMessage("Failed to update user");
    }
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600 mt-2">Manage user roles and account status</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-600">Loading users...</div>
        </div>
      ) : errorMessage ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {errorMessage}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Roles
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.raw_user_meta_data?.name || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <RoleDropdown
                      user={user}
                      onUpdate={(id, roles) => handleUpdateUserMeta(id, { roles })}
                      isOpen={openDropdownUserId === user.id}
                      onOpenChange={(open) => setOpenDropdownUserId(open ? user.id : null)}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      {user.raw_user_meta_data?.isLocked ? (
                        <Badge
                          variant="destructive"
                          className="h-8 px-3 text-sm gap-1.5 [&>svg]:size-4"
                        >
                          <Lock className="opacity-90" /> Locked
                        </Badge>
                      ) : (
                        <Badge
                          className="h-8 px-3 text-sm gap-1.5 [&>svg]:size-4 bg-green-600 text-white border-transparent"
                        >
                          <ShieldCheck className="opacity-90" /> Active
                        </Badge>
                      )}

                      {user.raw_user_meta_data?.isLocked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleLock(user.id, false)}
                          disabled={lockingUserId === user.id || user.id === currentUserId}
                          title={user.id === currentUserId ? "Cannot lock/unlock your own account" : 'Unlock user'}
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          {lockingUserId === user.id ? (
                            <>
                              <Loader2 className="animate-spin" /> Updating
                            </>
                          ) : (
                            <>
                              <Unlock /> Unlock
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleToggleLock(user.id, true)}
                          disabled={lockingUserId === user.id || user.id === currentUserId}
                          title={user.id === currentUserId ? "Cannot lock/unlock your own account" : 'Lock user'}
                        >
                          {lockingUserId === user.id ? (
                            <>
                              <Loader2 className="animate-spin" /> Updating
                            </>
                          ) : (
                            <>
                              <Lock /> Lock
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserManagement;