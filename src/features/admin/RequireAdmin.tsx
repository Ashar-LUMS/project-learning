import { useEffect, useState, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { useRole } from "../../getRole";


export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [hasAdminAccess, setHasAdminAccess] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { roles: userRolesArray, isLoading: areRolesLoading, refreshRoles } = useRole();
    const { activeRole } = useOutletContext<{ activeRole: string | null }>();
  const triedRefresh = useRef(false);

  useEffect(() => {
    if (areRolesLoading) {
      return;
    }
    if (!userRolesArray) {
      setHasAdminAccess(false);
      navigate("/", { replace: true });
      return;
    }
    const isAdminNow = userRolesArray.includes("Admin") && activeRole === "Admin";
    if (isAdminNow) {
      setHasAdminAccess(true);
      return;
    }
    // If the activeRole is Admin but roles don't yet contain Admin, attempt a one-time refresh (handles race after role update)
    if (activeRole === "Admin" && !isAdminNow && !triedRefresh.current) {
      triedRefresh.current = true;
      (async () => {
        await refreshRoles();
      })();
      return; // wait for next effect cycle
    }
    setHasAdminAccess(false);
    navigate("/app", { replace: true });
  }, [userRolesArray, areRolesLoading, navigate, activeRole, refreshRoles]);

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