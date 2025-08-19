import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useRole } from '../../getRole';
import { supabase } from '../../supabaseClient';
import { Eye, EyeOff, Save, User, Lock } from 'lucide-react';

const SettingsPage = () => {
  const { role, setRole } = useRole();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [newRole, setNewRole] = useState(role || '');

  // Keep newRole in sync if context role changes
  React.useEffect(() => {
    setNewRole(role || '');
  }, [role]);
  const [roleOptions] = useState(['User', 'Admin', 'Moderator']);

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
    
    if (newRole === role) {
      setMessage({ type: 'error', text: 'Please select a different role' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      // Update user metadata with new role
      const { error } = await supabase.auth.updateUser({
        data: { role: newRole }
      });

      if (error) {
        setMessage({ type: 'error', text: error.message });
      } else {
        setRole(newRole);
        setMessage({ type: 'success', text: 'Role updated successfully!' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsLoading(false);
    }
  };

  const clearMessage = () => setMessage(null);

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
              Change Role
            </CardTitle>
            <CardDescription>
              Update your account role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRoleChange} className="space-y-4">
              <div>
                <label htmlFor="currentRole" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Role
                </label>
                <Input
                  id="currentRole"
                  value={role || 'No role assigned'}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              
              <div>
                <label htmlFor="newRole" className="block text-sm font-medium text-gray-700 mb-1">
                  New Role
                </label>
                <select
                  id="newRole"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select a role</option>
                  {roleOptions.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {roleOption}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading || !newRole || newRole === role}
                className="w-full"
              >
                {isLoading ? 'Updating...' : 'Update Role'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

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
                Current Role
              </label>
              <p className="text-gray-900">{role || 'No role assigned'}</p>
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
  );
};

export default SettingsPage;
