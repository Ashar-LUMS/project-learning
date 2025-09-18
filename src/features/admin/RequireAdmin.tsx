import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useRole } from "../../getRole";


export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading } = useRole();
    const { activeRole } = useOutletContext<{ activeRole: string | null }>();

  useEffect(() => {
    if (areRolesLoading) {
      return;
    }
    if (userRolesArray) {
      if (userRolesArray.includes("Admin") && activeRole === "Admin") {
        setHasAdminAccess(true);
      } else {
        // Redirect If not an admin
        setHasAdminAccess(false);
        navigate("/app", { replace: true });
      }
    } else {
      // Case when no roles (e.g., user is not logged in or has no roles assigned)
      setHasAdminAccess(false);
      navigate("/", { replace: true });
    }
  }, [userRolesArray, areRolesLoading, navigate, activeRole]);

  // Show a loading indicator while roles are being fetched
  if (hasAdminAccess === null || areRolesLoading) {
    return (
      <main className="flex-grow flex items-center justify-center">
        <div>Loading Admin Access...</div>
      </main>
    );
  }
  return <>{children}</>;
}