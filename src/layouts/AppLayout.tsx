import { useState, useEffect } from 'react';
import {Link,Outlet} from "react-router-dom";
import { Button } from '../components/ui/button';
import { Home, Menu} from 'lucide-react';
// import { supabase } from '../supabaseClient.ts';
import { useRole } from "../getRole";

const AppLayout = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { role: userRole } = useRole();

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 text-gray-800 font-sans antialiased">
            <header className="sticky top-0 z-50 bg-white shadow-md">
                <div className="container mx-auto px-4 py-4 flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                        {/* <Rocket className="w-8 h-8 text-blue-500" /> */}
                        <span className="text-2xl font-bold text-gray-900">TISON</span>
                    </div>

                    <nav className="hidden md:flex space-x-6 items-center">
                        {/* Links now point to the new /app path and its children */}
                        <Link to="/app" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                            <Home className="inline-block mr-1" size={18} />
                            Home
                        </Link>
                        <Link to="/app/about" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                            About
                        </Link>
                        <Link to="/app/services" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                            Services
                        </Link>
                        <Link to="/app/settings" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                            Settings
                        </Link>
                        {/* Only show Dashboard link if user is admin 
            {userRole === "Admin" && (
              <Link to="/app/admin" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                Admin Panel
              </Link>
            )} */}


                        {/* Admin Panel link always visible, but only active for Admin */}
                        <Link
                            to={userRole === "Admin" ? "/app/admin" : "/app/access-denied"}
                            className={`text-gray-600 transition-colors duration-200 ${userRole === "Admin"
                                    ? "hover:text-blue-500"
                                    : "opacity-70 cursor-not-allowed"
                                }`}
                            tabIndex={userRole === "Admin" ? 0 : -1}
                            aria-disabled={userRole !== "Admin"}
                        >
                            Admin Panel
                        </Link>

                        <Link to="/" className="text-gray-600 hover:text-blue-500 transition-colors duration-200">
                            <Button variant="outline" className="rounded-full">Logout</Button>
                        </Link>
                    </nav>

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

                {isMenuOpen && (
                    <nav className="md:hidden bg-white shadow-md border-t border-gray-200">
                        <div className="flex flex-col p-4 space-y-2">
                            <Link to="/app" className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors" onClick={() => setIsMenuOpen(false)}>
                                Home
                            </Link>
                            <Link to="/app/about" className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors" onClick={() => setIsMenuOpen(false)}>
                                About
                            </Link>
                            <Link to="/app/services" className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors" onClick={() => setIsMenuOpen(false)}>
                                Services
                            </Link>
                            <Link to="/app/settings" className="block text-gray-600 hover:bg-gray-100 p-2 rounded-md transition-colors" onClick={() => setIsMenuOpen(false)}>
                                Settings
                            </Link>

                            {/* Admin Panel link always visible, but only active for Admin */}
                            <Link
                                to="/app/admin"
                                className={`text-gray-600 transition-colors duration-200 ${userRole === "Admin"
                                        ? "hover:text-blue-500"
                                        : "opacity-50 cursor-not-allowed"
                                    }`}
                                tabIndex={userRole === "Admin" ? 0 : -1}
                                aria-disabled={userRole !== "Admin"}
                            >
                                Admin Panel
                            </Link>
                            <Link to="/">
                                <Button className="w-full rounded-md mt-2" onClick={() => setIsMenuOpen(false)}>Logout</Button>
                            </Link>
                        </div>


                    </nav>
                )}
            </header>

            <Outlet />

            <footer className="bg-gray-800 text-gray-300 py-6">
                <div className="container mx-auto px-4 text-center">
                    <p>&copy; 2025 TISON App. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
};

export default AppLayout;