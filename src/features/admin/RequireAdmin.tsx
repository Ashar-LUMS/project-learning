import { useEffect, useState } from "react";
import { Outlet, useNavigate, useOutletContext } from "react-router-dom";
//import { supabase } from "../../supabaseClient.ts";
import {useRole} from "../../getRole"


export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
    const { activeRole } = useOutletContext<{ activeRole: string | null }>();

  useEffect(() => {
    // Only proceed if roles are not currently loading
    if (areRolesLoading) {
      // Still loading, keep hasAdminAccess as null
      return;
    }
    if (userRolesArray) {
      if (userRolesArray.includes("Admin") && activeRole === "Admin") {
        setHasAdminAccess(true);
      } else {
        // If not an admin, redirect to access denied
        setHasAdminAccess(false);
        navigate("/app");
      }
    } else {
      // If no roles are found (e.g., user is not logged in or has no roles assigned)
      setHasAdminAccess(false);
      navigate("/"); // Or navigate("/") if they need to log in first
    }
  }, [userRolesArray, areRolesLoading, navigate]); // Add navigate to dependency array

  // Show a loading indicator while roles are being fetched
  if (hasAdminAccess === null || areRolesLoading) {
    return (
      <main className="flex-grow flex items-center justify-center">
        <div>Loading Admin Access...</div>
      </main>
    );
  }

  // If hasAdminAccess is true, render children
  // If hasAdminAccess is false, the user would have been navigated away by useEffect
  return <>{children}</>;
}