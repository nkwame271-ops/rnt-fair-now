import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
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
  const roleCache = useRef<Record<string, string>>({});
  const initialSessionHandled = useRef(false);

  const fetchRole = useCallback(async (userId: string) => {
    // Return cached role instantly if available
    if (roleCache.current[userId]) {
      const cached = roleCache.current[userId] as "tenant" | "landlord" | "regulator";
      setRole(cached);
      return cached;
    }
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
      if (r) roleCache.current[userId] = r;
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

    // 1. Get existing session first (fast path)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      initialSessionHandled.current = true;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await fetchRole(s.user.id);
      }
      if (mounted) setLoading(false);
    });

    // 2. Listen for future changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      // Skip if this is the initial session we already handled
      if (!initialSessionHandled.current) return;

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Use cached role for instant response, fetch in background
        const cached = roleCache.current[newSession.user.id];
        if (cached) {
          setRole(cached as "tenant" | "landlord" | "regulator");
          setLoading(false);
        } else {
          setLoading(true);
          fetchRole(newSession.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        }
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchRole]);

  const signOut = async () => {
    roleCache.current = {};
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
