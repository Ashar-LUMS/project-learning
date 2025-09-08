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

const AVAILABLE_ROLES = ["Admin", "Role1", "Role2", "Role3"];

// Dropdown component for selecting roles
const RoleDropdown = ({
  user,
  onUpdate,
}: {
  user: UserData;
  onUpdate: (id: string, roles: string[]) => void;
}) => {
  const [draftRoles, setDraftRoles] = useState(
    user.raw_user_meta_data?.roles || []
  );
  const [savedRoles, setSavedRoles] = useState(
    user.raw_user_meta_data?.roles || []
  );
  const [open, setOpen] = useState(false);

  const toggleRole = (role: string) => {
    if (draftRoles.includes(role)) {
      setDraftRoles(draftRoles.filter((r) => r !== role));
    } else {
      setDraftRoles([...draftRoles, role]);
    }
  };

  const handleSave = () => {
    setSavedRoles(draftRoles);
    onUpdate(user.id, draftRoles);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraftRoles(savedRoles); // reset to last saved
    setOpen(false);
  };

  return (
    <div className="relative">
      {/* Button */}
      <button
        className="border border-gray-300 px-2 py-1 rounded w-full text-left"
        onClick={() => setOpen(!open)}
      >
        {savedRoles.length > 0 ? savedRoles.join(", ") : "Select roles..."}
      </button>

      {/* Dropdown */}
      {open && (
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
              className="px-3 py-1 text-sm rounded bg-indigo-500 text-white hover:bg-indigo-600"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminPanel = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_users_as_admin");

      if (error) {
        console.error("Error fetching users:", error);
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    };

    fetchUsers();
  }, []);

  const handleUpdateRoles = async (userId: string, roles: string[]) => {
    const { data, error } = await supabase.rpc("update_users_as_admin", {
      target_user_id: userId,
      new_roles: roles,
    });

    if (error) {
      console.error("Error updating roles:", error);
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, raw_user_meta_data: data.raw_user_meta_data }
            : u
        )
      );
    }
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
      <p className="mb-6">Only admins can see this page.</p>

      {loading ? (
        <div>Loading users...</div>
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
                    <RoleDropdown user={user} onUpdate={handleUpdateRoles} />
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
