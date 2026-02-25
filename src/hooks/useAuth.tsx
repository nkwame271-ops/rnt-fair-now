import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: "tenant" | "landlord" | "regulator" | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"tenant" | "landlord" | "regulator" | null>(null);

  const fetchRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        console.error("Failed to fetch role:", error.message);
        setRole(null);
        return null;
      }
      const r = (data?.role as "tenant" | "landlord" | "regulator") || null;
      setRole(r);
      return r;
    } catch (err) {
      console.error("Role fetch exception:", err);
      setRole(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth listener FIRST — but defer async work with setTimeout
    // to avoid deadlocks within onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Set loading=true so ProtectedRoute shows spinner until role is ready
        setLoading(true);
        // Defer the role fetch to avoid Supabase internal deadlock
        setTimeout(() => {
          if (mounted) {
            fetchRole(newSession.user.id).then(() => {
              if (mounted) setLoading(false);
            });
          }
        }, 0);
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      if (!mounted) return;
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.user) {
        await fetchRole(existingSession.user.id);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
