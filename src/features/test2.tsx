import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";

interface User {
  id: string;
  email: string;
  user_metadata: {
    name?: string;
    roles?: string[];
  };
}

const AVAILABLE_ROLES = ["Admin", "Role1", "Role2", "Role3"];

const AdminPanel = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);

    // Must be called with service key (on server) if you want all users
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error("Error fetching users:", error);
    } else {
      setUsers(data.users as User[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleSaveRoles = async () => {
    if (!selectedUser) return;
    setUpdating(true);

    const { error } = await supabase.auth.admin.updateUserById(selectedUser.id, {
      user_metadata: {
        ...selectedUser.user_metadata,
        roles: selectedRoles,
      },
    });

    if (error) {
      console.error("Error updating roles:", error);
    } else {
      await fetchUsers();
      setSelectedUser(null);
    }

    setUpdating(false);
  };

  return (
    <main className="flex-grow container mx-auto px-4 py-8 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
      <p className="mb-6">Only admins can see this page.</p>

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <div className="w-full max-w-5xl">
          <table className="w-full border-collapse border border-gray-300 shadow-lg rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2">Name</th>
                <th className="border border-gray-300 px-4 py-2">Email</th>
                <th className="border border-gray-300 px-4 py-2">Roles</th>
                <th className="border border-gray-300 px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const roles = user.user_metadata?.roles || [];
                const name = user.user_metadata?.name || "—";
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2">{name}</td>
                    <td className="border border-gray-300 px-4 py-2">{user.email}</td>
                    <td className="border border-gray-300 px-4 py-2">
                      {roles.length ? roles.join(", ") : "No roles"}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedUser(user);
                          setSelectedRoles(roles);
                        }}
                      >
                        Change Roles
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Editor Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Change Roles for {selectedUser?.user_metadata?.name || selectedUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {AVAILABLE_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setSelectedUser(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRoles} disabled={updating}>
              {updating ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AdminPanel;
