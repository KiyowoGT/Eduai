import { createContext, useContext, useEffect, useState, useRef } from "react";
import { fetchMe, logout as apiLogout } from "@/lib/api";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

function sessionToUser(session) {
  if (!session) return null;
  const u = session.user;
  return {
    id: u.id,
    user_id: u.id,
    email: u.email,
    name: u.user_metadata?.full_name || u.user_metadata?.name || "",
    picture: u.user_metadata?.avatar_url,
    // Don't assume onboarded is false; wait for enrich or trust prev state
    onboarded: true, 
    subjects: [],
    schedule: [],
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const enrichRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const enrich = async (session) => {
      try {
        const me = await fetchMe();
        if (!cancelled && me) {
          // Keep the ID from session but use all data from backend
          setUser({ id: session.user.id, ...me });
        }
      } catch (err) {
        // fetchMe failed — fall back to session user but don't force onboarded: false
        if (!cancelled) {
          setUser((prev) => prev ?? sessionToUser(session));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Listen to Supabase auth state — PRIMARY source of truth
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;

      if (session) {
        // Only reset user if the identity actually changed
        setUser((prev) => {
          if (!prev) return sessionToUser(session);
          const prevId = prev?.id || prev?.user_id;
          if (prevId !== session.user.id) return sessionToUser(session);
          return prev;
        });

        // Enrich immediately
        if (enrichRef.current) clearTimeout(enrichRef.current);
        enrichRef.current = setTimeout(() => enrich(session), 0);
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setLoading(false);
      }
    });

    // Also check existing session on mount (for page refresh)
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || data?.session) return; // listener already handled it
      setUser(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      if (enrichRef.current) clearTimeout(enrichRef.current);
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const doLogout = async () => {
    try { await supabase.auth.signOut(); } catch {}
    try { await apiLogout(); } catch {}
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, refresh: () => fetchMe().then((m) => { setUser(m || user); return m; }).catch(() => null), logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
