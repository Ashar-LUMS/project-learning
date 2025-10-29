import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  extractIsLocked,
  readStoredLockStatus,
  storeLockStatus,
  clearStoredLockStatus,
} from "./lib/sessionLock";

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
  const deriveRoles = useCallback((user: any): string[] | null => {
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
  }, []);

  const refreshRoles = useCallback(async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    setRoles(deriveRoles(user));
    const locked = extractIsLocked(user);
    if (locked === null) {
      clearStoredLockStatus();
    } else {
      storeLockStatus(locked);
    }
    setIsLocked(locked);
    setIsLoading(false);
  }, [deriveRoles]);

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      
  const storedLock = readStoredLockStatus();
      if (storedLock !== null) {
        setIsLocked(storedLock);
      }

  // First check for existing session
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
      
      if (!user) {
        setRoles(null);
        setIsLocked(null);
        clearStoredLockStatus();
        setIsLoading(false);
        return;
      }

      setRoles(deriveRoles(user));
      const locked = extractIsLocked(user);
      if (locked === null) {
        if (storedLock !== null) {
          setIsLocked(storedLock);
        } else {
          setIsLocked(null);
        }
      } else {
        storeLockStatus(locked);
        setIsLocked(locked);
      }
      setIsLoading(false);
    };
    
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Handle different auth events
      if (event === 'SIGNED_OUT' || !session) {
        setRoles(null);
        setIsLocked(null);
        clearStoredLockStatus();
        setIsLoading(false);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        const user = session.user;
        setRoles(deriveRoles(user));
        const locked = extractIsLocked(user);
        if (locked === null) {
          clearStoredLockStatus();
          setIsLocked(null);
        } else {
          storeLockStatus(locked);
          setIsLocked(locked);
        }
        setIsLoading(false);
      }
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