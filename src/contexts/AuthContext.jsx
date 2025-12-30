import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase, supabaseUrl } from "@/api/supabaseClient";
import { getProfile } from "@/api/profiles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileRef = useRef(null);
  const inFlightRef = useRef(null);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const loadProfile = useCallback(
    async (userId, options = {}) => {
      if (!userId) {
        profileRef.current = null;
        setProfile(null);
        return null;
      }
      const { force = false } = options;
      const currentProfile = profileRef.current;
      if (!force && currentProfile && currentProfile.id === userId) {
        return currentProfile;
      }
      if (!force && inFlightRef.current) {
        return inFlightRef.current;
      }
      setProfileLoading(true);
      const promise = getProfile(userId)
        .then((data) => {
          profileRef.current = data || null;
          setProfile(data || null);
          return data || null;
        })
        .catch((error) => {
          console.error("Failed to load profile:", error);
          profileRef.current = null;
          setProfile(null);
          return null;
        })
        .finally(() => {
          inFlightRef.current = null;
          setProfileLoading(false);
        });
      inFlightRef.current = promise;
      return promise;
    },
    []
  );

  const clearAuthStorage = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const { hostname } = new URL(supabaseUrl);
      const projectRef = hostname.split(".")[0];
      const prefix = `sb-${projectRef}-`;
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(prefix)) {
          localStorage.removeItem(key);
        }
      });
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith(prefix)) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error("Failed to clear Supabase auth storage:", error);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        console.error("Supabase sign out failed:", error);
      }
    } finally {
      clearAuthStorage();
      setUser(null);
      profileRef.current = null;
      setProfile(null);
      setAuthChecked(true);
    }
  }, [clearAuthStorage]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const sessionUser = data?.session?.user || null;
        if (isMounted) {
          setUser(sessionUser);
        }
        if (sessionUser) {
          await loadProfile(sessionUser.id);
        } else if (isMounted) {
          profileRef.current = null;
          setProfile(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
          profileRef.current = null;
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const sessionUser = session?.user || null;
        setUser(sessionUser);
        if (!sessionUser) {
          profileRef.current = null;
          setProfile(null);
        } else {
          loadProfile(sessionUser.id, { force: true });
        }
        setAuthChecked(true);
      }
    );

    return () => {
      isMounted = false;
      listener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      setProfile,
      signOut,
      authChecked,
      loadProfile,
      profileLoading,
    }),
    [user, profile, authChecked, loadProfile, profileLoading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
