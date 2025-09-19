import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { useRole } from "../../getRole";
import { supabase } from "../../supabaseClient";
import { Eye, EyeOff, Lock, User, CheckCircle2, XCircle } from "lucide-react";
import { useOutletContext } from "react-router-dom";

const AVAILABLE_ROLES: string[] = (import.meta.env.VITE_ROLES ?? 'Dummy').split(',');

const SettingsPage = () => {
  const { roles, setRoles, isLoading: isRolesLoading } = useRole();

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  useEffect(() => {
    setSelectedRoles(roles || []);
  }, [roles]);

  const toggleRole = (roleOption: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleOption)
        ? prev.filter((r) => r !== roleOption)
        : [...prev, roleOption]
    );
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters long",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({ type: "success", text: "Password updated successfully!" });
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      setMessage({ type: "error", text: "At least one role must be selected" });
      return;
    }

    const currentRolesArray = roles || [];
    const same =
      [...currentRolesArray].sort().join(",") ===
      [...selectedRoles].sort().join(",");

    if (same) {
      setMessage({
        type: "error",
        text: "Please select different roles to update",
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { roles: selectedRoles },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setRoles(selectedRoles);
        setMessage({ type: "success", text: "Roles updated successfully!" });
      }
    } catch {
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setIsLoading(false);
    }
  };

  const displayRoles = (currentRoles: string[] | null) =>
    !currentRoles || currentRoles.length === 0
      ? "No roles assigned"
      : currentRoles.join(", ");

  const { activeRole } = useOutletContext<{ activeRole: string | null }>();

  return (
    <div className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between border ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" /> Change Password
            </CardTitle>
            <CardDescription>Update your account password</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="flex flex-col justify-between min-h-[280px] space-y-4">
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
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
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPasswords ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type={showPasswords ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full mt-auto">
                {isLoading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Role Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" /> Change Roles
            </CardTitle>
            <CardDescription>Update your account roles</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRoleChange} className="flex flex-col justify-between min-h-[280px] space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Roles
                </label>
                <Input value={displayRoles(roles)} disabled className="bg-gray-50" />
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-700">
                  Select New Roles:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_ROLES.map((roleOption) => {
                    const isSelected = selectedRoles.includes(roleOption);
                    return (
                      <Button
                        key={roleOption}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => toggleRole(roleOption)}
                        className="justify-start"
                      >
                        {roleOption}
                      </Button>
                    );
                  })}
                </div>

                {selectedRoles.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {selectedRoles.join(", ")}
                  </p>
                )}
              </div>

              <Button type="submit" disabled={isLoading || isRolesLoading} className="w-full mt-auto">
                {isLoading ? "Updating..." : "Update Roles"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Account Info */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your current account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Viewing as:
              </label>
              <p className="text-gray-900">{activeRole}</p>
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
  );
};

export default SettingsPage;
