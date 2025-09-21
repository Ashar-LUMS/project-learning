import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Home, Menu, Users } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useRole } from "../getRole";

const AppLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();

  // State to manage the currently selected/active role
  const [activeRole, setActiveRole] = useState<string | null>(null);

  useEffect(() => {
    if (!areRolesLoading && userRolesArray && userRolesArray.length > 0) {
      if (activeRole === null || !userRolesArray.includes(activeRole)) {
        if (userRolesArray.includes("Admin")) {
          setActiveRole("Admin");
        } else {
          setActiveRole(userRolesArray[0]);
        }
      }
    } else if (!areRolesLoading && (!userRolesArray || userRolesArray.length === 0)) {
      // If no roles are found, ensure activeRole is null
      setActiveRole(null);
    }
  }, [userRolesArray, areRolesLoading, activeRole]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-md">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-gray-900">TISON</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6 items-center">
            <Link
              to="/app"
              className="text-gray-600 hover:text-blue-500 transition-colors duration-200"
            >
              <Home className="inline-block mr-1" size={18} />
              Home
            </Link>

            <Link
              to="/app/services"
              className="text-gray-600 hover:text-blue-500 transition-colors duration-200"
            >
              Services
            </Link>

            <Link
              to="/app/settings"
              className="text-gray-600 hover:text-blue-500 transition-colors duration-200"
            >
              Settings
            </Link>

            {activeRole === "Admin" &&
              userRolesArray &&
              userRolesArray.includes("Admin") && (
                <Link
                  to="/app/admin"
                  className="text-gray-600 hover:text-blue-500 transition-colors duration-200"
                >
                  Admin Panel
                </Link>
              )}

            {/* Role Selector Dropdown */}
            {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
              <div className="relative">
                <Users className="inline-block mr-1 text-gray-500" size={18} />
                <select
                  value={activeRole || ""}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="px-2 py-1 rounded-md border border-gray-300 bg-white text-gray-700 text-sm focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Select active role"
                >
                  {userRolesArray.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={handleLogout}
              variant="outline"
              className="rounded-full text-gray-600 hover:text-blue-500"
            >
              Logout
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden bg-white shadow-md border-t border-gray-200">
            <div className="flex flex-col p-4 space-y-2">
              <Link
                to="/app"
                className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>

              <Link
                to="/app/services"
                className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Services
              </Link>

              <Link
                to="/app/settings"
                className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Settings
              </Link>

              {activeRole === "Admin" &&
                userRolesArray &&
                userRolesArray.includes("Admin") && (
                  <Link
                    to="/app/admin"
                    className="text-gray-600 hover:text-blue-500 transition-colors duration-200"
                    onClick={() => {
                      if (activeRole === "Admin") setIsMenuOpen(false);
                    }}
                    tabIndex={activeRole === "Admin" ? 0 : -1}
                    aria-disabled={activeRole !== "Admin"}
                  >
                    Admin Panel
                  </Link>
                )}

              {/* Mobile Role Selector Dropdown */}
              {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
                <div className="relative block">
                  <label htmlFor="mobile-role-select" className="sr-only">
                    Select Active Role
                  </label>
                  <select
                    id="mobile-role-select"
                    value={activeRole || ""}
                    onChange={(e) => setActiveRole(e.target.value)}
                    className="w-full px-2 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-base focus:ring-blue-500 focus:border-blue-500"
                    aria-label="Select active role"
                  >
                    {userRolesArray.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                className="w-full rounded-md mt-2"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
              >
                Logout
              </Button>
            </div>
          </nav>
        )}
      </header>

      {/* Main Outlet */}
      <Outlet context={{ activeRole }} />

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-6">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 TISON App. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
