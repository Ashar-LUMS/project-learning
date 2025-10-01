import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

// fallback if Supabase fetch fails
const AVAILABLE_ROLES_FALLBACK: string[] = ["User"];

export function useAllRoles() {
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);

  const fetchRoleNames = async (): Promise<string[]> => {
    const { data, error } = await supabase.from("roles").select("name");

    if (error) {
      console.error("Error fetching roles:", error);
      return [];
    }

    return data ? data.map((role: { name: string }) => role.name) : [];
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const names = await fetchRoleNames();
        if (!mounted) return;

        const normalized = (names || [])
          .map((r) => String(r).trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        setAvailableRoles(normalized.length ? normalized : AVAILABLE_ROLES_FALLBACK);
      } catch (e) {
        if (!mounted) return;
        setAvailableRoles(AVAILABLE_ROLES_FALLBACK);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return availableRoles;
}
