import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Lock, Calendar, Shield, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient.ts';

const profileSchema = z.object({
  full_name: z.string().min(2, {
    message: "Name must be at least 2 characters."
  }),
  email: z.string().email({
    message: "Please enter a valid email address."
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const UserProfile = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [user, setUser] = useState<any>(null);
  // Password update state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [isPasswordUpdating, setIsPasswordUpdating] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    reset,
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    const checkSessionAndFetchProfile = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        if (!session) {
          navigate('/login', { replace: true });
          return;
        }

  setUser(session.user);
  setValue('email', session.user.email || '');
  const meta = session.user.user_metadata || {};
  setValue('full_name', meta.name);
      } catch (error) {
        console.error('Error fetching session:', error);
        setMessage({ type: 'error', text: 'Failed to load user data' });
      } finally {
        setIsLoading(false);
      }
    };

    checkSessionAndFetchProfile();
  }, [navigate, setValue]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (isUpdating) return;
    setIsUpdating(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { name: data.full_name }
      });

      if (error) throw error;

      showMessage('success', 'Profile updated successfully!');
      reset(data); // Reset form state after successful update
      // Update local user metadata to reflect changes without extra API calls
      setUser((prev: any) => {
        if (!prev) return prev;
        return { ...prev, user_metadata: { ...prev.user_metadata, name: data.full_name } };
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showMessage('error', error.message || 'Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordUpdating) return;
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }

    setIsPasswordUpdating(true);
    setPasswordMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
      } else {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setIsPasswordUpdating(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
          <p className="text-gray-600 mt-2">Manage your profile and account preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className="h-20 w-20 mb-4 border-4 border-white shadow-lg">
                    <AvatarImage src={user?.user_metadata?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-lg font-semibold">
                      {getInitials((user?.user_metadata?.name || user?.email || 'User'))}
                    </AvatarFallback>
                  </Avatar>
                  
                  <h2 className="text-xl font-semibold text-gray-900">
                    {user?.user_metadata?.name || 'User'}
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">{user?.email}</p>
                  
                  <Badge variant="secondary" className="mt-3 bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Verified Account
                  </Badge>

                  <Separator className="my-4" />

                  <div className="space-y-3 w-full text-left">
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Joined {formatDate(user?.created_at)}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="h-4 w-4 mr-2 text-gray-400" />
                      <span>Active User</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Update your personal information and how others see you on the platform.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {message && (
                  <div 
                    className={`mb-6 p-4 rounded-lg border text-sm ${
                      message.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {message.type === 'success' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{message.text}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-sm font-medium">
                        Full Name
                      </Label>
                      <Input
                        id="full_name"
                        type="text"
                        placeholder="Enter your full name"
                        disabled={isUpdating}
                        className="transition-colors"
                        {...register('full_name')}
                      />
                      {errors.full_name && (
                        <p className="text-red-600 text-sm flex items-center gap-1">
                          {errors.full_name.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        disabled
                        className="bg-gray-50 text-gray-500 cursor-not-allowed"
                        {...register('email')}
                      />
                      <p className="text-gray-500 text-xs">
                        Contact support to change your email address
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t">
                    <div>
                      <p className="text-sm text-gray-500">
                        {isDirty ? "You have unsaved changes" : "All changes saved"}
                      </p>
                    </div>
                    <Button 
                      type="submit" 
                      disabled={isUpdating || !isDirty}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isUpdating ? (
                        <>
                          <Loader2 className="animate-spin w-4 h-4 mr-2" />
                          Updating...
                        </>
                      ) : (
                        'Update Profile'
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Security Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  Security
                </CardTitle>
                <CardDescription>
                  Manage your password and security preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {passwordMessage && (
                  <div 
                    className={`mb-6 p-4 rounded-lg border text-sm ${
                      passwordMessage.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {passwordMessage.type === 'success' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <span>{passwordMessage.text}</span>
                    </div>
                  </div>
                )}

                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <Label htmlFor="newPassword" className="text-sm font-medium">New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        id="newPassword"
                        type={showPasswords ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={isPasswordUpdating} className="bg-blue-600 hover:bg-blue-700 text-white w-full">
                    {isPasswordUpdating ? (
                      <>
                        <Loader2 className="animate-spin w-4 h-4 mr-2" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Account Actions Card */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Additional account management options.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => navigate('/app')}
                  >
                    Back to Home
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      try {
                        const { error } = await supabase.auth.signOut();
                        if (error) throw error;
                        //navigate('/login', { replace: true });
                      } catch (error) {
                        console.error('Error signing out:', error);
                      }
                    }}
                  >
                    Sign Out
                  </Button>
                  
                  
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};