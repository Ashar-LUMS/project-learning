import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'; // Adjusted path
import { Button } from '../../components/ui/button'; // Adjusted path
import { Input } from '../../components/ui/input'; // Adjusted path
import { useRole } from '../../getRole'; // Adjusted path
import { supabase } from '../../supabaseClient'; // Adjusted path
import { Eye, EyeOff, Save, User, Lock } from 'lucide-react';

// Define available roles, consistent with signup.tsx
const AVAILABLE_ROLES = ["Admin", "Role1", "Role2", "Role3"];

const SettingsPage = () => {
  // Destructure 'roles' (array) and 'setRoles' from the useRole hook
  const { roles, setRoles, isLoading: isRolesLoading } = useRole();

  const [isLoading, setIsLoading] = useState(false); // General loading state for form submissions
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // State to manage the roles actively selected for update in the UI, always an array
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  // Effect to synchronize the internal selectedRoles state with the roles from the context
  // This runs when the 'roles' from useRoles changes (e.g., on initial load or after an update)
  useEffect(() => {
    if (roles) {
      // 'roles' from useRoles is already an array (due to parsing in getRole.tsx)
      setSelectedRoles(roles);
    } else {
      setSelectedRoles([]);
    }
  }, [roles]); // Depend on the 'roles' array from the context

  // Role options, consistent with your original setup
  const [roleOptions] = useState(AVAILABLE_ROLES);

  // Function to add or remove a role from the selectedRoles array
  const toggleRole = (roleOption: string) => {
    setSelectedRoles(prev =>
      prev.includes(roleOption) ? prev.filter(r => r !== roleOption) : [...prev, roleOption]
    );
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setMessage({ type: 'success', text: 'Password updated successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error) {
      console.error("Password change error:", error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure at least one role is selected
    if (selectedRoles.length === 0) {
      setMessage({ type: 'error', text: 'At least one role must be selected.' });
      return;
    }

    // 'roles' from context is already an array (string[] | null), so use it directly for comparison
    const currentRolesArray = roles || []; // Ensure it's an array for safe comparison

    // Perform a deep comparison to check if the roles have actually changed
    // Convert to sorted strings for consistent comparison, especially for arrays
    const sortedCurrentRoles = [...currentRolesArray].sort().join(',');
    const sortedSelectedRoles = [...selectedRoles].sort().join(',');

    if (sortedCurrentRoles === sortedSelectedRoles) {
      setMessage({ type: 'error', text: 'Please select different roles to update.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Update user metadata with the new array of roles using the 'roles' key (plural)
      const { error } = await supabase.auth.updateUser({
        data: { roles: selectedRoles } // Send the array of selected roles
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        // Update the roles context with the new array of roles
        setRoles(selectedRoles);
        setMessage({ type: 'success', text: 'Roles updated successfully!' });
      }
    } catch (error) {
      console.error("Role change error:", error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessage = () => setMessage(null);

  // Helper function to display roles, now always expecting string[] | null
  const displayRoles = (currentRoles: string[] | null) => {
    if (!currentRoles || currentRoles.length === 0) {
      return 'No roles assigned';
    }
    return currentRoles.join(', ');
  };

  return (
    <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex justify-between items-center">
              <span>{message.text}</span>
              <button
                onClick={clearMessage}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Password Change Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your account password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <Input
                    id="confirmPassword"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !newPassword || !confirmPassword}
                  className="w-full"
                >
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Role Change Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Change Roles
              </CardTitle>
              <CardDescription>
                Update your account roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRoleChange} className="space-y-4">
                <div>
                  <label htmlFor="currentRoles" className="block text-sm font-medium text-gray-700 mb-1">
                    Current Roles
                  </label>
                  <Input
                    id="currentRoles"
                    value={displayRoles(roles)} // Use helper function with roles (array)
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                {/* New Role Selection - Similar to Signup component */}
                <div className="flex flex-col gap-3">
                  <p className="font-medium">Select New Roles:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {roleOptions.map(roleOption => {
                      const isSelected = selectedRoles.includes(roleOption);
                      return (
                        <button
                          type="button"
                          key={roleOption}
                          onClick={() => toggleRole(roleOption)}
                          className={`h-10 w-full rounded-md border px-3 text-sm text-left transition
                            ${isSelected
                              ? "bg-primary text-white border-primary shadow-sm"
                              : "bg-background text-muted-foreground hover:border-primary/50"}`}
                        >
                          {roleOption}
                        </button>
                      );
                    })}
                  </div>

                  {/* Show selected roles summary */}
                  {selectedRoles.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Selected: {selectedRoles.join(", ")}
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || isRolesLoading} // Disable if either form or roles are loading
                  className="w-full"
                >
                  {isLoading ? 'Updating...' : 'Update Roles'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Info Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your current account details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Roles
                  </label>
                  <p className="text-gray-900">{displayRoles(roles)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Status
                  </label>
                  <p className="text-green-600 font-medium">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;