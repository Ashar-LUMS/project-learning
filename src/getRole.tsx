import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

// Type for custom claims from app_metadata
interface AppMetadataClaims {
  roles?: string[]; // Roles are now expected to be string[] directly from app_metadata
  [key: string]: any; // Allow other properties
}

// Context value type
type RoleContextType = {
  roles: string[] | null;
  setRoles: (roles: string[] | null) => void;
  isLoading: boolean;
};

const RoleContext = createContext<RoleContextType>({
  roles: null,
  setRoles: () => {},
  isLoading: true,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roles, setRoles] = useState<string[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize roles from user_metadata or app_metadata.claims
  const parseAndSetRoles = (
    userMetadataRolesData: any, // Could be array, stringified array, or string
    appMetadataClaimsData: AppMetadataClaims | null | undefined // Expected to be native array
  ): string[] | null => {
    let rolesArray: string[] | null = null;

    // 1. Prioritize roles from app_metadata.claims (where the new trigger sets them as a native JSON array)
    if (appMetadataClaimsData && Array.isArray(appMetadataClaimsData.roles)) {
      rolesArray = appMetadataClaimsData.roles;
    }

    // 2. Fallback to user_metadata.roles if needed (backward compatibility)
    if (!rolesArray && userMetadataRolesData) {
      if (Array.isArray(userMetadataRolesData)) {
        rolesArray = userMetadataRolesData; // Already an array
      } else if (typeof userMetadataRolesData === 'string') {
        try {
          const parsed = JSON.parse(userMetadataRolesData);
          if (Array.isArray(parsed)) {
            rolesArray = parsed;
          }
        } catch (e) {}
      }
    }

    return rolesArray;
  };

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles(null);
        setIsLoading(false);
        return;
      }

      const userMetadataRoles = user.user_metadata?.roles;
      const appMetadataClaims = user.app_metadata?.claims as AppMetadataClaims | undefined; // Cast for type safety

      setRoles(parseAndSetRoles(userMetadataRoles, appMetadataClaims));
      setIsLoading(false);
    };
    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      if (!sessionUser) {
        setRoles(null);
        setIsLoading(false);
        return;
      }

      const newRolesFromMetadata = sessionUser.user_metadata?.roles;
      const newAppMetadataClaims = sessionUser.app_metadata?.claims as AppMetadataClaims | undefined; // Cast for type safety
      
      setRoles(parseAndSetRoles(newRolesFromMetadata, newAppMetadataClaims));
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <RoleContext.Provider value={{ roles, setRoles, isLoading }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);