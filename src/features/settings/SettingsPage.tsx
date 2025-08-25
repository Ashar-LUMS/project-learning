import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useRole } from '../../getRole';
import { supabase } from '../../supabaseClient';
import { Eye, EyeOff, Save, User, Lock } from 'lucide-react';

const SettingsPage = () => {
  const { roles, setRoles } = useRoles();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  //const [newRoles, setNewRoles] = useState(roles || []);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  // Keep newRole in sync if context role changes
  React.useEffect(() => {
    if (roles) {
      // If `role` is an array, use it directly. If it's a string, wrap it in an array.
      setSelectedRoles(Array.isArray(roles) ? roles : [roles]);
    } else {
      setSelectedRoles([]);
    }
  }, [roles]);
  const [roleOptions] = useState(['Admin', 'Role1', 'Role2', 'Role3']);
    // Toggle role handler for multi-select buttons
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

    // Get current roles from the context, ensuring it's an array for comparison
    //const currentRolesArray = Array.isArray(roles) ? roles : (roles ? [roles] : []);
    const currentRolesArray = Array.isArray(roles) ? roles : (roles ? [roles] : []);
    // Perform a deep comparison to check if the roles have actually changed
    const rolesAreSame =
      currentRolesArray.length === selectedRoles.length &&
      currentRolesArray.every(currentR => selectedRoles.includes(currentR));

    if (rolesAreSame) {
      setMessage({ type: 'error', text: 'Please select different roles to update.' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Update user metadata with new role
      const { error } = await supabase.auth.updateUser({
        data: { roles: selectedRoles }
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setRoles(selectedRoles);
        setMessage({ type: 'success', text: 'Roles updated successfully!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessage = () => setMessage(null);
    // Helper function to display roles gracefully, whether it's a string or an array
  const displayRoles = (currentRoles: string | string[] | null) => {
    if (!currentRoles || (Array.isArray(currentRoles) && currentRoles.length === 0)) {
      return 'No roles assigned';
    }
    if (Array.isArray(currentRoles)) {
      return currentRoles.join(', ');
    }
    return currentRoles; // It's a single string
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
                    value={displayRoles(roles)} // Use helper function
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
                  disabled={isLoading} // Disable only during loading
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
