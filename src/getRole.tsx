import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

type RoleContextType = {
  role: string | null;
  setRole: (role: string | null) => void;
  isLoading: boolean;
};

const RoleContext = createContext<RoleContextType>({
  role: null,
  setRole: () => {},
  isLoading: true,
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setIsLoading(false);
        return;
      }
      const meta = user.user_metadata;
      setRole(meta?.role ?? null);
      setIsLoading(false);
    };
    fetchRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newRole = session?.user?.user_metadata?.role ?? null;
      setRole(newRole);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
      

  return (
    <RoleContext.Provider value={{ role, setRole, isLoading }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);