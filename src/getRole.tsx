import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

type RoleContextType = {
  roles: string[] | null;
  setRoles: (role: string[] | null) => void;
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

  useEffect(() => {
    const fetchRoles = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRoles(null);
        setIsLoading(false);
        return;
      }
      const user_roles = user.user_metadata?.roles;
      const customClaims = user.user_metadata?.custom_claims;
      let rolesArray: string[] | null = null;

      if (customClaims && customClaims.roles)
        try {
            const parsed = JSON.parse(customClaims.roles);
            if (Array.isArray(parsed)) {
              rolesArray = parsed;
            }
        } catch (error) {
          console.error('Error parsing custom claims roles:', error);
        }

      // Fallback to user_metadata if custom claims aren't available or failed to parse
      // This also handles backward compatibility for old users with string roles in user_metadata
      if (!rolesArray && user_roles) {
        if (Array.isArray(user_roles)) {
          rolesArray = user_roles;
        } else if (typeof user_roles === 'string') {
          try {
            const parsed = JSON.parse(user_roles);
            if (Array.isArray(parsed)) {
              rolesArray = parsed;
            } else {
              // If it's a string but not a JSON array string, treat as a single role
              rolesArray = [user_roles];
            }
          } catch (e) {
            // Not a JSON string, treat as a single role
            rolesArray = [user_roles];
          }
        }
      }

      setRoles(rolesArray);
      setIsLoading(false);
    };
    fetchRoles();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // On auth state change, fetch the latest user data (including claims)
      // and re-evaluate roles, similar to the initial fetch.
      // The session.user object here should contain the latest user_metadata and app_metadata

      const sessionUser = session?.user;
      const newRolesFromMetadata = sessionUser?.user_metadata?.roles;
      const newCustomClaims = sessionUser?.app_metadata?.claims;

      let newRolesArray: string[] | null = null;

      // Prioritize custom claims from the session if available and parsed
      if (newCustomClaims && newCustomClaims.roles) {
        try {
          const parsed = JSON.parse(newCustomClaims.roles);
          if (Array.isArray(parsed)) {
            newRolesArray = parsed;
          }
        } catch (e) {
          console.error("Failed to parse roles from custom claims in session:", e);
        }
      }

      // Fallback to user_metadata from the session
      if (!newRolesArray && newRolesFromMetadata) {
        if (Array.isArray(newRolesFromMetadata)) {
          newRolesArray = newRolesFromMetadata;
        } else if (typeof newRolesFromMetadata === 'string') {
          try {
            const parsed = JSON.parse(newRolesFromMetadata);
            if (Array.isArray(parsed)) {
              newRolesArray = parsed;
            } else {
              newRolesArray = [newRolesFromMetadata];
            }
          } catch (e) {
            newRolesArray = [newRolesFromMetadata];
          }
        }
      }
      setRoles(newRolesArray);
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