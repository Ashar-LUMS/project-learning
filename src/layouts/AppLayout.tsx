import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Home, Menu, Users } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useRole } from "../getRole";

const AppLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
  const location = useLocation();
  const [isLocked, setIsLocked] = useState<boolean | null>(null);
  const [checkingLock, setCheckingLock] = useState(true);

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
      setActiveRole(null);
    }
  }, [userRolesArray, areRolesLoading, activeRole]);

  // Fetch user metadata to determine lock status
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      setCheckingLock(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
  const locked = !!(user?.user_metadata?.isLocked || user?.user_metadata?.is_locked);
      setIsLocked(locked);
      setCheckingLock(false);
      if (locked && !location.pathname.endsWith('/locked')) {
        navigate('/app/locked', { replace: true });
      }
    };
    check();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
  const locked = !!(u?.user_metadata?.isLocked || u?.user_metadata?.is_locked);
      setIsLocked(locked);
      if (locked && !location.pathname.endsWith('/locked')) {
        navigate('/app/locked', { replace: true });
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [navigate, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Sign out automatically when the tab/window is closed or navigated away.
  // Uses local scope signOut for speed 
  // Remove this useEffect if you want to keep users logged in across sessions.
  useEffect(() => {
    let active = true;
    const quickLocalSignOut = () => {
      try {
        // Local only: clears client session/token cache synchronously; network revocation may not finish on unload anyway.
        supabase.auth.signOut({ scope: 'local' });
      } catch { /* ignore */ }
    };

    // Attach only if a user is present
    const attachIfAuthenticated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        window.addEventListener('beforeunload', quickLocalSignOut);
        // pagehide covers some mobile browsers / bfcache scenarios
        window.addEventListener('pagehide', quickLocalSignOut);
      }
    };
    attachIfAuthenticated();

    // Also respond to auth state changes (e.g., login after mount)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      if (user) {
        window.addEventListener('beforeunload', quickLocalSignOut);
        window.addEventListener('pagehide', quickLocalSignOut);
      } else {
        window.removeEventListener('beforeunload', quickLocalSignOut);
        window.removeEventListener('pagehide', quickLocalSignOut);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener('beforeunload', quickLocalSignOut);
      window.removeEventListener('pagehide', quickLocalSignOut);
    };
  }, [navigate]);

  if (checkingLock) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-600">Checking account status...</div>
    );
  }

  if (isLocked) {
    // The route component for /app/locked will render; short-circuit other layout parts if already redirected
    if (!location.pathname.endsWith('/locked')) {
      return null; // navigation effect will handle redirect
    }
  }

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
          <p>&copy; 2025 TISON - BIRL&trade; All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;
