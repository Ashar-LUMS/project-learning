import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

// Type for custom claims from app_metadata
interface AppMetadataClaims {
  roles?: string[];
  [key: string]: any;
}

// Context value type
type RoleContextType = {
  roles: string[] | null;
  setRoles: (roles: string[] | null) => void;
  isLoading: boolean;
  refreshRoles: () => Promise<void>;
  isLocked: boolean | null;
};

const RoleContext = createContext<RoleContextType>({
  roles: null,
  setRoles: () => {},
  isLoading: true,
  refreshRoles: async () => {},
  isLocked: null,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState<boolean | null>(null);

  // Derive roles as a union of app_metadata.claims.roles and user_metadata.roles (handles string / JSON / array)
  const deriveRoles = (user: any): string[] | null => {
    if (!user) return null;
    const rolesFromClaimsRaw = (user.app_metadata?.claims as AppMetadataClaims | undefined)?.roles;
    const rolesFromClaims = Array.isArray(rolesFromClaimsRaw) ? rolesFromClaimsRaw : [];

    const userMetaRolesRaw = user.user_metadata?.roles;
    let rolesFromUserMeta: string[] = [];
    if (Array.isArray(userMetaRolesRaw)) {
      rolesFromUserMeta = userMetaRolesRaw;
    } else if (typeof userMetaRolesRaw === 'string') {
      try {
        const parsed = JSON.parse(userMetaRolesRaw);
        if (Array.isArray(parsed)) rolesFromUserMeta = parsed;
      } catch {
        // treat as single role string
        rolesFromUserMeta = [userMetaRolesRaw];
      }
    }

    const combined = Array.from(new Set([...rolesFromClaims, ...rolesFromUserMeta])).filter(Boolean);
    return combined.length > 0 ? combined : null;
  };

  const refreshRoles = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setRoles(deriveRoles(user));
    setIsLocked(!!(user?.user_metadata?.isLocked || user?.user_metadata?.is_locked));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles(null);
        setIsLocked(null);
        setIsLoading(false);
        return;
      }

      setRoles(deriveRoles(user));
      setIsLocked(!!(user?.user_metadata?.isLocked || user?.user_metadata?.is_locked));
      setIsLoading(false);
    };
    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      if (!sessionUser) {
        setRoles(null);
        setIsLocked(null);
        setIsLoading(false);
        return;
      }

      setRoles(deriveRoles(sessionUser));
      setIsLocked(!!(sessionUser?.user_metadata?.isLocked || sessionUser?.user_metadata?.is_locked));
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <RoleContext.Provider value={{ roles, setRoles, isLoading, refreshRoles, isLocked }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);