import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Home, Menu, Users, Settings, LogOut, Shield } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useRole } from "../getRole";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AppLayout = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
  const location = useLocation();
  const [isLocked, setIsLocked] = useState<boolean | null>(null);
  const [checkingLock, setCheckingLock] = useState(true);

  // State to manage the currently selected/active role
  const [activeRole, setActiveRole] = useState<string | null>(null);

  // Fetch user data
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

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
  useEffect(() => {
    let active = true;
    const quickLocalSignOut = () => {
      try {
        supabase.auth.signOut({ scope: 'local' });
      } catch { /* ignore */ }
    };

    const attachIfAuthenticated = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (user) {
        window.addEventListener('beforeunload', quickLocalSignOut);
        window.addEventListener('pagehide', quickLocalSignOut);
      }
    };
    attachIfAuthenticated();

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

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.user_metadata?.name) return "U";
    return user.user_metadata.name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (checkingLock) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-600">Checking account status...</div>
    );
  }

  if (isLocked) {
    if (!location.pathname.endsWith('/locked')) {
      return null;
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-md border-b">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-gray-900">TISON</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 flex-1 justify-end">
            <Link
              to="/app"
              className="text-gray-600 hover:text-blue-500 transition-colors duration-200 flex items-center gap-1"
            >
              Projects
            </Link> 

            {/* Role Selector Dropdown */}
            {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
              <div className="relative flex items-center gap-2">
                <Users className="text-gray-500" size={18} />
                <select
                  value={activeRole || ""}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="px-3 py-1 rounded-md border border-gray-300 bg-white text-gray-700 text-sm focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
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

            {/* User Avatar Dropdown - Now on extreme right with larger size */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full hover:bg-gray-100 transition-colors">
                  <Avatar className="h-10 w-10 border-2 border-gray-200">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.user_metadata?.name || 'User'}</p>
                    <p className="text-xs leading-none text-gray-600">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {/* Admin Panel Link */}
                {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/app/admin" className="flex items-center gap-2 cursor-pointer w-full">
                        <Shield size={16} />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link to="/app/settings" className="flex items-center gap-2 cursor-pointer w-full">
                    <Settings size={16} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 w-full"
                >
                  <LogOut size={16} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-3">
            {/* Mobile Avatar - Larger size */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10 border-2 border-gray-200">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name} />
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-semibold">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.user_metadata?.name || 'User'}</p>
                    <p className="text-xs leading-none text-gray-600">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                
                {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link to="/app/admin" className="flex items-center gap-2 cursor-pointer w-full">
                        <Shield size={16} />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link to="/app/settings" className="flex items-center gap-2 cursor-pointer w-full">
                    <Settings size={16} />
                    Settings
                  </Link>
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 w-full"
                >
                  <LogOut size={16} />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation menu"
              className="h-10 w-10"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden bg-white shadow-md border-t border-gray-200">
            <div className="flex flex-col p-4 space-y-3">
              <Link
                to="/app"
                className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home size={18} />
                Home
              </Link>

              <Link
                to="/app/settings"
                className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings size={18} />
                Settings
              </Link>

              {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                <Link
                  to="/app/admin"
                  className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Shield size={18} />
                  Admin Panel
                </Link>
              )}

              {/* Mobile Role Selector Dropdown */}
              {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
                <div className="relative flex items-center gap-2 p-2">
                  <Users className="text-gray-500" size={18} />
                  <select
                    value={activeRole || ""}
                    onChange={(e) => setActiveRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-gray-700 text-base focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full rounded-md mt-2 flex items-center gap-2 h-10"
                onClick={() => {
                  setIsMenuOpen(false);
                  handleLogout();
                }}
              >
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </nav>
        )}
      </header>

      {/* Main Outlet */}
      <Outlet context={{ activeRole }} />

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p>&copy; 2025 TISON - BIRL&trade; All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;