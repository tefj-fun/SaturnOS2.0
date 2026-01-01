import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./Layout.jsx";
import { defaultFeatureVisibility, navigationItems } from "@/navigation";
import { useAuth } from "@/contexts/AuthContext";

const lazyWithPreload = (loader) => {
    const Component = lazy(loader);
    Component.preload = loader;
    return Component;
};

const Projects = lazyWithPreload(() => import("./Projects"));
const ProjectSetup = lazyWithPreload(() => import("./ProjectSetup"));
const AnnotationStudio = lazyWithPreload(() => import("./AnnotationStudio"));
const AnnotationReview = lazyWithPreload(() => import("./AnnotationReview"));
const StepManagement = lazyWithPreload(() => import("./StepManagement"));
const TrainingConfiguration = lazyWithPreload(() => import("./TrainingConfiguration"));
const TrainingStatus = lazyWithPreload(() => import("./TrainingStatus"));
const LabelLibrary = lazyWithPreload(() => import("./LabelLibrary"));
const Results = lazyWithPreload(() => import("./Results"));
const ResultsAndAnalysis = lazyWithPreload(() => import("./ResultsAndAnalysis"));
const Settings = lazyWithPreload(() => import("./Settings"));
const Dashboard = lazyWithPreload(() => import("./Dashboard"));
const Welcome = lazyWithPreload(() => import("./Welcome"));
const Pricing = lazyWithPreload(() => import("./Pricing"));
const Billing = lazyWithPreload(() => import("./Billing"));
const ResetPassword = lazyWithPreload(() => import("./ResetPassword"));
const Onboarding = lazyWithPreload(() => import("./Onboarding"));

function BuildVariantsComingSoon() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
            <div className="text-center max-w-xl">
                <p className="text-sm uppercase tracking-[0.3em] text-gray-400">Build Variants</p>
                <h1 className="mt-3 text-3xl md:text-4xl font-semibold text-gray-900">Coming soon</h1>
                <p className="mt-3 text-gray-600">
                    We are polishing this experience. Check back soon.
                </p>
            </div>
        </div>
    );
}

function PageLoading() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
            <p className="text-sm text-gray-500">Loading...</p>
        </div>
    );
}

const SECONDARY_PRELOAD_ORDER = [
    "ProjectSetup",
    "AnnotationStudio",
    "AnnotationReview",
    "StepManagement",
    "TrainingStatus",
    "Results",
    "Welcome",
    "Pricing",
    "Billing",
    "Onboarding",
];

const PAGES = {
    
    Projects: Projects,
    
    ProjectSetup: ProjectSetup,
    
    AnnotationStudio: AnnotationStudio,
    
    AnnotationReview: AnnotationReview,
    
    StepManagement: StepManagement,
    
    TrainingConfiguration: TrainingConfiguration,
    
    TrainingStatus: TrainingStatus,
    
    LabelLibrary: LabelLibrary,
    
    Results: Results,
    
    ResultsAndAnalysis: ResultsAndAnalysis,
    
    Settings: Settings,
    
    Dashboard: Dashboard,

    Onboarding: Onboarding,

    Pricing: Pricing,

    Billing: Billing,
    
    BuildVariants: BuildVariantsComingSoon,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const { user, profile } = useAuth();
    const prefetchKeyRef = useRef(null);
    const [cachedRole, setCachedRole] = useState(() => {
        if (typeof window === "undefined") {
            return null;
        }
        return localStorage.getItem("saturnos_role") || null;
    });
    const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
    const currentPage = _getCurrentPage(location.pathname);
    const isAuthenticated = Boolean(user);

    useEffect(() => {
        if (!user?.id) {
            return;
        }
        const key = `saturnos_role_${user.id}`;
        const storedRole = localStorage.getItem(key) || localStorage.getItem("saturnos_role");
        if (storedRole) {
            setCachedRole(storedRole);
        }
    }, [user?.id]);

    const effectiveRole = profile?.role || cachedRole;
    const isAdmin = effectiveRole === "admin";
    const featureFlags = useMemo(
        () => ({
            ...defaultFeatureVisibility,
            ...(profile?.preferences?.features || {}),
        }),
        [profile?.preferences?.features]
    );
    const navigationOrder = useMemo(() => {
        const items = isAdmin
            ? navigationItems
            : navigationItems.filter((item) => featureFlags[item.featureKey]);
        return items.map((item) => item.page);
    }, [isAdmin, featureFlags]);

    useEffect(() => {
        if (
            normalizedPath === "/welcome" ||
            normalizedPath.toLowerCase() === "/reset-password" ||
            (normalizedPath.toLowerCase() === "/pricing" && !isAuthenticated)
        ) {
            return;
        }
        const navSignature = navigationOrder.join("|");
        if (prefetchKeyRef.current === navSignature) {
            return;
        }
        prefetchKeyRef.current = navSignature;
        let cancelled = false;

        const orderedNames = [];
        for (const name of navigationOrder) {
            if (!orderedNames.includes(name)) orderedNames.push(name);
        }
        for (const name of SECONDARY_PRELOAD_ORDER) {
            if (!orderedNames.includes(name)) orderedNames.push(name);
        }

        const preload = async () => {
            for (const name of orderedNames) {
                if (cancelled) {
                    return;
                }
                const Page = PAGES[name];
                if (Page?.preload) {
                    try {
                        await Page.preload();
                    } catch {
                        return;
                    }
                }
            }
        };

        preload();

        return () => {
            cancelled = true;
        };
    }, [normalizedPath, navigationOrder, isAuthenticated]);
    
    if (normalizedPath === "/welcome") {
        return (
            <Suspense fallback={<PageLoading />}>
                <Welcome />
            </Suspense>
        );
    }
    if (normalizedPath.toLowerCase() === "/reset-password") {
        return (
            <Suspense fallback={<PageLoading />}>
                <ResetPassword />
            </Suspense>
        );
    }
    if (normalizedPath.toLowerCase() === "/pricing" && !user) {
        return (
            <Suspense fallback={<PageLoading />}>
                <Pricing />
            </Suspense>
        );
    }

    return (
        <Layout currentPageName={currentPage}>
            <Suspense fallback={<PageLoading />}>
                <Routes>            
                        <Route path="/" element={<Projects />} />
                    
                    <Route path="/Projects" element={<Projects />} />
                    
                    <Route path="/ProjectSetup" element={<ProjectSetup />} />
                    
                    <Route path="/AnnotationStudio" element={<AnnotationStudio />} />
                    
                    <Route path="/AnnotationReview" element={<AnnotationReview />} />
                    
                    <Route path="/StepManagement" element={<StepManagement />} />
                    
                    <Route path="/TrainingConfiguration" element={<TrainingConfiguration />} />
                    
                    <Route path="/TrainingStatus" element={<TrainingStatus />} />
                    
                    <Route path="/LabelLibrary" element={<LabelLibrary />} />
                    
                    <Route path="/Results" element={<Results />} />
                    
                    <Route path="/ResultsAndAnalysis" element={<ResultsAndAnalysis />} />
                    
                    <Route path="/Settings" element={<Settings />} />
                    
                    <Route path="/Dashboard" element={<Dashboard />} />

                    <Route path="/Onboarding" element={<Onboarding />} />
                    <Route path="/onboarding" element={<Onboarding />} />

                    <Route path="/Pricing" element={<Pricing />} />
                    <Route path="/pricing" element={<Pricing />} />

                    <Route path="/Billing" element={<Billing />} />
                    <Route path="/billing" element={<Billing />} />
                    
                    
                    <Route path="/BuildVariants" element={<BuildVariantsComingSoon />} />
                    
                </Routes>
            </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
