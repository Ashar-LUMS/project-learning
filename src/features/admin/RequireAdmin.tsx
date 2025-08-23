import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabaseClient.ts";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/");
        return;
      }
      const role = user.user_metadata?.role as string | undefined;
      if (role !== "Admin") {
        navigate("/app/access-denied");
      } else {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, [navigate]);

  if (isAdmin === null) return (<main className="flex-grow flex items-center justify-center">
    <div>Loading...</div>
    </main>);
  return <>{children}</>;
}