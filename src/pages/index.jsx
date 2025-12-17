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

import BuildVariants from "./BuildVariants";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

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
    
    BuildVariants: BuildVariants,
    
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
                
                <Route path="/BuildVariants" element={<BuildVariants />} />
                
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