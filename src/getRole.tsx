import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

type RoleContextType = {
  role: string | null;
  setRole: (role: string | null) => void;
};

const RoleContext = createContext<RoleContextType>({
  role: null,
  setRole: () => {},
});

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const meta = user.user_metadata;
    setRole(meta?.role ?? null);
  };
  fetchRole();
}, []);
      

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => useContext(RoleContext);