import { useState, useEffect } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Home, Menu, Users, Settings, LogOut, Shield, UserRoundPen } from "lucide-react";
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
import { AuthDebug } from "../components/auth-debug";

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

  // Check for authentication state and redirect if not authenticated
  useEffect(() => {
    let active = true;
    
    const checkAuthState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      
      if (!session) {
        navigate("/", { replace: true });
      }
    };
    
    checkAuthState();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/", { replace: true });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
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
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo Section */}
          <div className="flex items-center space-x-3">
            <Link to="/app" className="flex items-center space-x-3 no-underline">
              <img 
                src="https://tison.lums.edu.pk/Icons/Tison%20Logo%20Horizontal%20Blue.png" 
                alt="TISON Logo" 
                className="h-8 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 flex-1 justify-end">
            <Link
              to="/app"
              className="text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium text-sm px-3 py-2 rounded-lg hover:bg-blue-50"
            >
              Projects
            </Link>

            {/* Role Selector Dropdown */}
            {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
              <div className="relative flex items-center gap-2">
                <Users className="text-gray-400" size={18} />
                <select
                  value={activeRole || ""}
                  onChange={(e) => setActiveRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all cursor-pointer"
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

            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-gray-100 transition-all duration-200 border border-gray-200">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-sm font-medium">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 mt-2 rounded-xl shadow-lg border border-gray-100" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-gray-900">{user?.user_metadata?.name || 'User'}</p>
                    <p className="text-xs leading-none text-gray-500">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-100" />

                {/* Admin Panel Link */}
                {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                  <>
                    <DropdownMenuItem asChild className="p-2 cursor-pointer rounded-lg m-1 focus:bg-blue-50">
                      <Link to="/app/admin" className="flex items-center gap-3 w-full text-gray-700">
                        <Shield size={16} className="text-blue-600" />
                        <span className="text-sm">Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-100" />
                  </>
                )}

                <DropdownMenuItem asChild className="p-2 cursor-pointer rounded-lg m-1 focus:bg-blue-50">
                  <Link to="/app/user-profile" className="flex items-center gap-3 w-full text-gray-700">
                    <UserRoundPen size={16} className="text-gray-600" />
                    <span className="text-sm">Profile</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild className="p-2 cursor-pointer rounded-lg m-1 focus:bg-blue-50">
                  <Link to="/app/settings" className="flex items-center gap-3 w-full text-gray-700">
                    <Settings size={16} className="text-gray-600" />
                    <span className="text-sm">Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="p-2 cursor-pointer rounded-lg m-1 text-red-600 focus:bg-red-50 focus:text-red-600 w-full"
                >
                  <div className="flex items-center gap-3">
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Log out</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile Avatar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full border border-gray-200">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.user_metadata?.name} />
                    <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-sm font-medium">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 rounded-xl shadow-lg border border-gray-100" align="end" forceMount>
                <DropdownMenuLabel className="font-normal p-4">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-gray-900">{user?.user_metadata?.name || 'User'}</p>
                    <p className="text-xs leading-none text-gray-500">
                      {user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-gray-100" />

                {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                  <>
                    <DropdownMenuItem asChild className="p-2 cursor-pointer rounded-lg m-1 focus:bg-blue-50">
                      <Link to="/app/admin" className="flex items-center gap-3 w-full text-gray-700">
                        <Shield size={16} className="text-blue-600" />
                        <span className="text-sm">Admin Panel</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-gray-100" />
                  </>
                )}

                <DropdownMenuItem asChild className="p-2 cursor-pointer rounded-lg m-1 focus:bg-blue-50">
                  <Link to="/app/settings" className="flex items-center gap-3 w-full text-gray-700">
                    <Settings size={16} className="text-gray-600" />
                    <span className="text-sm">Settings</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-gray-100" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="p-2 cursor-pointer rounded-lg m-1 text-red-600 focus:bg-red-50 focus:text-red-600 w-full"
                >
                  <div className="flex items-center gap-3">
                    <LogOut size={16} />
                    <span className="text-sm font-medium">Log out</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle navigation menu"
              className="h-9 w-9 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-lg">
            <div className="flex flex-col p-4 space-y-1">
              <Link
                to="/app"
                className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 p-3 rounded-lg transition-colors font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                <Home size={18} className="text-blue-600" />
                Projects
              </Link>

              <Link
                to="/app/settings"
                className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 p-3 rounded-lg transition-colors font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                <Settings size={18} className="text-gray-600" />
                Settings
              </Link>

              {activeRole === "Admin" && userRolesArray?.includes("Admin") && (
                <Link
                  to="/app/admin"
                  className="flex items-center gap-3 text-gray-700 hover:bg-blue-50 p-3 rounded-lg transition-colors font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <Shield size={18} className="text-blue-600" />
                  Admin Panel
                </Link>
              )}

              {/* Mobile Role Selector Dropdown */}
              {!areRolesLoading && userRolesArray && userRolesArray.length > 0 && (
                <div className="relative flex items-center gap-3 p-3">
                  <Users className="text-gray-400" size={18} />
                  <select
                    value={activeRole || ""}
                    onChange={(e) => setActiveRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all"
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
                className="w-full rounded-lg mt-2 flex items-center gap-3 h-11 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-medium"
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

      {/* Auth Debug Component (Development Only) */}
      <AuthDebug />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">&copy; 2025 TISON - BIRL&trade; All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;