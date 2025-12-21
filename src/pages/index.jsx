import Layout from "./Layout.jsx";

import Projects from "./Projects";

import ProjectSetup from "./ProjectSetup";

import AnnotationStudio from "./AnnotationStudio";

import AnnotationReview from "./AnnotationReview";

import StepManagement from "./StepManagement";

import TrainingConfiguration from "./TrainingConfiguration";

import TrainingStatus from "./TrainingStatus";

import LabelLibrary from "./LabelLibrary";

import Results from "./Results";

import ResultsAndAnalysis from "./ResultsAndAnalysis";

import Settings from "./Settings";

import Dashboard from "./Dashboard";

import Welcome from "./Welcome";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    const normalizedPath = location.pathname.replace(/\/+$/, "") || "/";
    if (normalizedPath === "/welcome") {
        return <Welcome />;
    }

    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
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
                
                
                <Route path="/BuildVariants" element={<BuildVariantsComingSoon />} />
                
            </Routes>
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
