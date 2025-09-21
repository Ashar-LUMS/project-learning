import { useEffect, useState } from "react";
import { supabase } from "../../supabaseClient";

interface UserData {
  id: string;
  email: string;
  raw_user_meta_data: {
    name?: string;
    roles?: string[];
  };
}

const AVAILABLE_ROLES: string[] = ((import.meta.env.VITE_ROLES ?? 'Dummy').split(',')).map((r: string) => r.trim()).filter(Boolean).sort((a: string, b: string) => a.localeCompare(b));

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
    setSavedRoles(draftRoles.slice().sort((a,b)=>a.localeCompare(b)));
    onUpdate(user.id, draftRoles.slice().sort((a,b)=>a.localeCompare(b)));
    onOpenChange(false);
  };

  const handleCancel = () => {
    setDraftRoles(savedRoles);
    onOpenChange(false);
  };

  const displaySaved = (savedRoles || []).slice().sort((a,b)=>a.localeCompare(b));

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

const AdminPanel = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // which user's dropdown is currently open (only one at a time)
  const [openDropdownUserId, setOpenDropdownUserId] = useState<string | null>(null);
  
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

    fetchUsers();
    return () => {
      isMounted = false;
    };
  }, [currentUserId]); // Not ideal, but ensures we have currentUserId before fetching users

  const handleUpdateRoles = async (userId: string, roles: string[]) => {
    try {
      const { data, error } = await supabase.rpc("update_users_as_admin", {
        target_user_id: userId,
        new_roles: roles,
      });
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, raw_user_meta_data: data.raw_user_meta_data }
            : u
        )
      );
    } catch (err) {
      console.error("Error updating roles:", err);
      setErrorMessage("Failed to update roles");
    }
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
      <p className="mb-6">Manage other users' roles</p>
      <p className="mb-6">Only admins can see this page.</p>

      {loading ? (
        <div>Loading users...</div>
      ) : errorMessage ? (
        <div className="text-red-600">{errorMessage}</div>
      ) : (
        <div className="w-full max-w-3xl">
          <table className="w-full border-collapse border border-gray-300 shadow-lg rounded-lg">
            <thead>
              <tr className="bg-gray-100">
                {/*<th className="border border-gray-300 px-4 py-2">ID</th>*/}
                <th className="border border-gray-300 px-4 py-2">Name</th>
                <th className="border border-gray-300 px-4 py-2">Email</th>
                <th className="border border-gray-300 px-4 py-2">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  {/*<td className="border border-gray-300 px-4 py-2">{user.id}</td>*/}
                  <td className="border border-gray-300 px-4 py-2">
                    {user.raw_user_meta_data?.name}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    {user.email}
                  </td>
                  <td className="border border-gray-300 px-4 py-2">
                    <RoleDropdown
                      user={user}
                      onUpdate={handleUpdateRoles}
                      isOpen={openDropdownUserId === user.id}
                      onOpenChange={(open) => setOpenDropdownUserId(open ? user.id : null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};

export default AdminPanel;
