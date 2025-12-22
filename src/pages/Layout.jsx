

import { useState, useEffect, useMemo, useRef, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/api/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  FolderPlus,
  Spline,
  Database,
  BarChart3,
  Settings,
  Package,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger } from
"@/components/ui/sidebar";

// Default feature visibility per page; admin sees all.
const defaultFeatureVisibility = {
  dashboard: true,
  projects: true,
  buildVariants: true,
  training: true,
  labelLibrary: true,
  results: false,
  settings: true,
};

const navigationItems = [
{
  title: "Dashboard",
  url: createPageUrl("Dashboard"),
  icon: BarChart3,
  featureKey: "dashboard",
},
{
  title: "Projects",
  url: createPageUrl("Projects"),
  icon: FolderPlus,
  featureKey: "projects",
},
{
  title: "Build Variants",
  url: createPageUrl("BuildVariants"),
  icon: Package,
  featureKey: "buildVariants",
},
{
  title: "Model Training",
  url: createPageUrl("TrainingConfiguration"),
  icon: Spline,
  featureKey: "training",
},
{
  title: "Label Library",
  url: createPageUrl("LabelLibrary"),
  icon: Database,
  featureKey: "labelLibrary",
},
{
  title: "Results & Analysis",
  url: createPageUrl("ResultsAndAnalysis"),
  icon: BarChart3,
  featureKey: "results",
},
{
  title: "Settings",
  url: createPageUrl("Settings"),
  icon: Settings,
  featureKey: "settings",
}];

const SidebarNavigationMenu = memo(function SidebarNavigationMenu({ items, activePath }) {
  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={activePath === item.url}
            className="mb-1 border border-transparent rounded-xl !transition-colors duration-150 hover:bg-blue-50 hover:text-blue-700 data-[active=true]:bg-blue-50 data-[active=true]:text-blue-700 data-[active=true]:shadow-sm data-[active=true]:border-blue-100"
          >
            <Link to={item.url} className="flex items-center gap-3 px-4 py-3 text-gray-600">
              <item.icon className="w-4 h-4" />
              <span className="font-medium">{item.title}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
});


export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const locationRef = useRef(location.pathname);
  const { user, profile, authChecked } = useAuth();
  const [authError, setAuthError] = useState(null);
  const [authNotice, setAuthNotice] = useState(null);
  const [authMode, setAuthMode] = useState("signin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const lastRoleRef = useRef(null);
  const roleStorageKeyRef = useRef(null);
  const [cachedRole, setCachedRole] = useState(() => {
    if (typeof window === "undefined") {
      return null;
    }
    return localStorage.getItem("saturnos_role") || null;
  });

  useEffect(() => {
    locationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!authChecked) {
      return;
    }
    if (user) {
      return;
    }
    lastRoleRef.current = null;
    if (roleStorageKeyRef.current) {
      localStorage.removeItem(roleStorageKeyRef.current);
    } else {
      localStorage.removeItem("saturnos_role");
    }
    roleStorageKeyRef.current = null;
    setCachedRole(null);
    if (locationRef.current !== "/") {
      navigate("/", { replace: true });
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setAuthMode("signin");
      setConfirmPassword("");
    }
  }, [authChecked, navigate, user]);

  useEffect(() => {
    if (!user?.id || !profile?.role) {
      return;
    }
    lastRoleRef.current = profile.role;
    const key = `saturnos_role_${user.id}`;
    roleStorageKeyRef.current = key;
    localStorage.setItem(key, profile.role);
    localStorage.setItem("saturnos_role", profile.role);
    setCachedRole(profile.role);
  }, [profile?.role, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }
    const key = `saturnos_role_${user.id}`;
    roleStorageKeyRef.current = key;
    const storedRole = localStorage.getItem(key) || localStorage.getItem("saturnos_role");
    if (storedRole) {
      setCachedRole(storedRole);
    }
  }, [user?.id]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setIsSubmitting(true);

    if (authMode === "signup") {
      if (password !== confirmPassword) {
        setAuthError("Passwords do not match.");
        setIsSubmitting(false);
        return;
      }
      const userData = {};
      if (firstName.trim()) userData.first_name = firstName.trim();
      if (lastName.trim()) userData.last_name = lastName.trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: Object.keys(userData).length ? { data: userData } : undefined,
      });
      if (error) {
        setAuthError(error.message);
      } else if (data?.session) {
        setAuthNotice("Account created. You are signed in.");
      } else {
        setAuthNotice("Check your email to confirm your account.");
      }
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
    }
    setIsSubmitting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setFirstName("");
    setLastName("");
    setAuthMode("signin");
    setProfile(null);
  };

  const effectiveRole = profile?.role || cachedRole || lastRoleRef.current;
  const isAdmin = effectiveRole === "admin";
  const featureFlags = useMemo(() => ({
    ...defaultFeatureVisibility,
    ...(profile?.preferences?.features || {}),
  }), [profile?.preferences?.features]);
  const filteredNavigation = useMemo(() => (
    isAdmin
      ? navigationItems
      : navigationItems.filter((item) => featureFlags[item.featureKey])
  ), [isAdmin, featureFlags]);

  // Hide sidebar for Annotation Studio page
  const isAnnotationStudio = currentPageName === "AnnotationStudio" || location.pathname.includes("AnnotationStudio") || currentPageName === "AnnotationReview";

  if (!authChecked || !user) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-[#0b0f1a] text-white font-[Space_Grotesk]">
        <style>
          {`
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
            @keyframes floatSlow {
              0% { transform: translate3d(0, 0, 0) scale(1); }
              50% { transform: translate3d(30px, -20px, 0) scale(1.05); }
              100% { transform: translate3d(0, 0, 0) scale(1); }
            }
            @keyframes drift {
              0% { transform: translate3d(0, 0, 0) rotate(0deg); }
              50% { transform: translate3d(-20px, 18px, 0) rotate(2deg); }
              100% { transform: translate3d(0, 0, 0) rotate(0deg); }
            }
          `}
        </style>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(31,93,255,0.35),_transparent_55%),radial-gradient(circle_at_70%_80%,_rgba(16,185,129,0.25),_transparent_50%)]" />
        <div className="absolute -top-32 -left-24 w-72 h-72 bg-blue-600/30 blur-3xl rounded-full animate-[floatSlow_18s_ease-in-out_infinite]" />
        <div className="absolute bottom-[-120px] right-[-60px] w-96 h-96 bg-emerald-500/20 blur-[140px] rounded-full animate-[floatSlow_22s_ease-in-out_infinite]" />
        <div className="absolute top-1/3 right-1/4 w-48 h-48 border border-white/10 rounded-3xl rotate-12 animate-[drift_16s_ease-in-out_infinite]" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs tracking-[0.2em] uppercase text-white/70">
                SaturnOS 2.0
              </div>
              <h1 className="text-4xl lg:text-5xl font-semibold leading-tight">
                SOP-driven annotation, <span className="text-blue-400">faster and clearer.</span>
              </h1>
              <p className="text-white/70 text-base lg:text-lg max-w-xl">
                Create projects, generate steps, and annotate images with secure storage and autosave. Built for quality teams.
              </p>
              <div className="flex items-center gap-4 text-sm text-white/60">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Supabase + Postgres
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  GPT-assisted steps
                </span>
              </div>
            </div>

            <div className="bg-white text-gray-900 shadow-2xl rounded-3xl p-8 border border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg bg-white border border-blue-100">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/067a9f53a_Android.png"
                    alt="SaturnOS Logo"
                    className="w-9 h-9 object-contain"
                  />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">
                    {authMode === "signup" ? "Create your account" : "Welcome back"}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    {authMode === "signup" ? "Sign up to get started" : "Sign in to continue"}
                  </p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleAuthSubmit}>
                {authMode === "signup" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">First name</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="given-name"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Last name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoComplete="family-name"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  {authMode === "signup" && (
                    <>
                      <p className="mt-1 text-xs text-gray-500">Use at least 8 characters.</p>
                      <div className="mt-3">
                        <label className="text-sm font-medium text-gray-700">Confirm password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </>
                  )}
                </div>
                {authError && <p className="text-sm text-red-600">{authError}</p>}
                {authNotice && <p className="text-sm text-emerald-600">{authNotice}</p>}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Please wait..." : authMode === "signup" ? "Create account" : "Sign In"}
                </button>
              </form>

              <div className="mt-6 text-xs text-gray-500 text-center">
                {authMode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signin");
                        setAuthError(null);
                        setAuthNotice(null);
                        setFirstName("");
                        setLastName("");
                      }}
                      className="text-blue-600 font-semibold hover:text-blue-700"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    Need an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("signup");
                        setAuthError(null);
                        setAuthNotice(null);
                        setFirstName("");
                        setLastName("");
                      }}
                      className="text-blue-600 font-semibold hover:text-blue-700"
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isAnnotationStudio) {
    return (
      <div className="min-h-screen w-full">
        {children}
      </div>);

  }

  return (
    <SidebarProvider>
      <style>
        {`
          :root {
            --primary-blue: #014ECB;
            --primary-blue-light: #3481FE;
            --primary-blue-lighter: #CCE0FF;
            --primary-blue-lightest: #EFF5FF;
            --soft-blue: #f8fafc;
            --border-blue: #CCE0FF;
            --accent-blue: #0162FE;
            --text-muted: #64748b;
            --success-green: #10b981;
            --warning-amber: #f59e0b;
          }
          
          .glass-effect {
            backdrop-filter: blur(12px);
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(204, 224, 255, 0.6);
          }
          
          .gradient-bg {
            background: linear-gradient(135deg, #EFF5FF 0%, #CCE0FF 100%);
          }
        `}
      </style>
      
      <div className="min-h-screen flex w-full gradient-bg">
        <Sidebar className="border-r border-blue-200/60 glass-effect flex flex-col">
          <SidebarHeader className="border-b border-blue-200/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg bg-white">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/067a9f53a_Android.png" 
                  alt="SaturnOS Logo"
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg">SaturnOS 2.0</h2>
                <p className="text-xs text-gray-500 font-medium">Guided LLM Annotation</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-4 flex-1 overflow-y-auto">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-2 py-3">
                Workspace
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  <SidebarNavigationMenu items={filteredNavigation} activePath={location.pathname} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-blue-200/60 p-0">
            <Link to={createPageUrl("Settings")} className="block hover:bg-blue-50/50 p-6 transition-colors duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 font-semibold text-sm">
                      {user ? (user.email?.charAt(0).toUpperCase() || 'U') : 'U'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {user ? user.email : 'Loading...'}
                    </p>
                    <p className="text-xs text-gray-500 truncate capitalize">
                      {effectiveRole || "member"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-xs text-red-600 mt-2"
                >
                  Log out
                </button>
            </Link>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/70 backdrop-blur-sm border-b border-blue-200/60 px-6 py-4 md:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-blue-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-bold text-gray-900">SaturnOS 2.0</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
