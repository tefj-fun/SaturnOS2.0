import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/api/supabaseClient";
import { getProfile } from "@/api/profiles";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const inFlightRef = useRef(null);

  const loadProfile = useCallback(
    async (userId, options = {}) => {
      if (!userId) {
        setProfile(null);
        return null;
      }
      const { force = false } = options;
      if (!force && profile && profile.id === userId) {
        return profile;
      }
      if (!force && inFlightRef.current) {
        return inFlightRef.current;
      }
      setProfileLoading(true);
      const promise = getProfile(userId)
        .then((data) => {
          setProfile(data || null);
          return data || null;
        })
        .catch((error) => {
          console.error("Failed to load profile:", error);
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
    [profile]
  );

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
          setProfile(null);
        }
      } catch {
        if (isMounted) {
          setUser(null);
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
      authChecked,
      loadProfile,
      profileLoading,
    }),
    [user, profile, authChecked, loadProfile, profileLoading]
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
