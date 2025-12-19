import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { TrainingRun } from '@/api/entities';
import { TrainerWorker } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  PlayCircle,
  Cpu,
  Settings,
  Layers,
  FileText,
  Spline,
  CheckCircle,
  History,
  FolderOpen,
  Info,
  Loader2,
  Clock,
  WifiOff,
  Rocket
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import LoadingOverlay from '@/components/projects/LoadingOverlay';
import StartTrainingDialog from '../components/training/StartTrainingDialog';
import TrainingRunCard from '../components/training/TrainingRunCard';

const Section = ({ title, icon, children, count }) => (
    <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-3">
            {icon} {title}
            {count > 0 && <span className="text-sm bg-gray-200 text-gray-700 rounded-full px-2.5 py-0.5">{count}</span>}
        </h2>
        {children}
    </div>
);


export default function TrainingConfigurationPage() {
    const navigate = useNavigate();
    const [allProjects, setAllProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectSteps, setProjectSteps] = useState([]);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [selectedStep, setSelectedStep] = useState(null);
    const [trainingRuns, setTrainingRuns] = useState([]);
    const [trainerStatus, setTrainerStatus] = useState({
        state: "checking",
        running: 0,
        queued: 0,
        workersOnline: 0,
    });

    const [isLoading, setIsLoading] = useState(true);
    const [showStartTrainingDialog, setShowStartTrainingDialog] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        const stepId = urlParams.get('stepId');
        
        loadAllProjects().then((projects) => {
            if (projectId) {
                const isValidProject = projects.some(project => project.id === projectId);
                if (!isValidProject) {
                    setSelectedProjectId(null);
                    setSelectedProject(null);
                    setSelectedStepId(null);
                    setSelectedStep(null);
                    setProjectSteps([]);
                    setTrainingRuns([]);
                    setIsLoading(false);
                    navigate(createPageUrl('TrainingConfiguration'));
                    return;
                }
                loadProjectData(projectId, stepId);
            } else {
                setIsLoading(false);
            }
        });
    }, [location.search]);

    const HEARTBEAT_TIMEOUT_MS = 60000;

    const loadTrainerStatus = useCallback(async () => {
        try {
            const [activeRuns, workers] = await Promise.all([
                TrainingRun.filter({ status: ['running', 'queued'] }, '-created_date'),
                TrainerWorker.list('-last_seen'),
            ]);
            const running = activeRuns.filter(run => run.status === 'running').length;
            const queued = activeRuns.filter(run => run.status === 'queued').length;
            const now = Date.now();
            const activeWorkers = (workers || []).filter((worker) => {
                if (!worker?.last_seen) return false;
                const lastSeen = new Date(worker.last_seen).getTime();
                return Number.isFinite(lastSeen) && (now - lastSeen) <= HEARTBEAT_TIMEOUT_MS;
            });
            const workersOnline = activeWorkers.length;
            const state = running > 0
                ? 'busy'
                : queued > 0
                    ? 'queued'
                    : workersOnline === 0
                        ? 'offline'
                        : 'idle';
            setTrainerStatus({ state, running, queued, workersOnline });
        } catch (error) {
            console.error('Error loading trainer status:', error);
            setTrainerStatus({ state: 'unknown', running: 0, queued: 0, workersOnline: 0 });
        }
    }, []);

    useEffect(() => {
        loadTrainerStatus();
        const interval = setInterval(loadTrainerStatus, 15000);
        return () => clearInterval(interval);
    }, [loadTrainerStatus]);

    const groupedRuns = useMemo(() => {
        const groups = { running: [], queued: [], completed: [], history: [] };
        trainingRuns.forEach(run => {
            if (run.status === 'running') {
                groups.running.push(run);
            } else if (run.status === 'queued') {
                 groups.queued.push(run);
            } else if (run.status === 'completed') {
                groups.completed.push(run);
            } else { // failed, stopped
                groups.history.push(run);
            }
        });
        return groups;
    }, [trainingRuns]);

    const loadAllProjects = async () => {
        try {
            const projects = await Project.list();
            setAllProjects(projects);
            return projects;
        } catch (error) { console.error('Error loading projects:', error); }
        return [];
    };
    
    const loadProjectData = async (projectId, stepId = null) => {
        setIsLoading(true);
        setSelectedProjectId(projectId);
        try {
            const [projectData, steps] = await Promise.all([
                Project.filter({ id: projectId }),
                SOPStep.filter({ project_id: projectId }, 'step_number')
            ]);
            
            if (projectData.length === 0) throw new Error("Project not found");
            setSelectedProject(projectData[0]);
            setProjectSteps(steps);
    
            if (stepId) {
                await loadStepData(stepId, steps);
            } else {
                setSelectedStepId(null);
                setSelectedStep(null);
                setTrainingRuns([]);
            }
        } catch (error) {
            console.error("Error loading project data:", error);
            navigate(createPageUrl('Projects'));
        } finally {
            setIsLoading(false);
        }
    };

    const loadStepData = async (stepId, allSteps) => {
        const step = (allSteps || projectSteps).find(s => s.id === stepId);
        if (!step) return;
        
        setSelectedStepId(stepId);
        setSelectedStep(step);

        const runs = await TrainingRun.filter(
            { step_id: stepId, project_id: step.project_id },
            '-created_date'
        );
        setTrainingRuns(runs);
    };
    
    const handleProjectSelect = (projectId) => {
        const url = createPageUrl('TrainingConfiguration', { projectId });
        navigate(url);
        loadProjectData(projectId);
    };
    
    const handleStepSelect = (stepId) => {
        const url = createPageUrl('TrainingConfiguration', { projectId: selectedProjectId, stepId });
        navigate(url);
        loadStepData(stepId);
    };

    useEffect(() => {
        if (!selectedStepId) return;
        const hasActiveRuns = trainingRuns.some(run => ['running', 'queued'].includes(run.status));
        if (!hasActiveRuns) return;

        const interval = setInterval(() => {
            TrainingRun.filter(
                { step_id: selectedStepId, project_id: selectedProjectId },
                '-created_date'
            )
                .then(setTrainingRuns)
                .catch(error => console.error('Error refreshing training runs:', error));
        }, 5000);

        return () => clearInterval(interval);
    }, [selectedStepId, selectedProjectId, trainingRuns]);

    const handleStartTraining = async (trainingConfig) => {
        if (!selectedProjectId || !selectedStepId) return;
        try {
            const newRun = await TrainingRun.create({
                project_id: selectedProjectId,
                ...trainingConfig
            });
            
            // Navigate to training status page for the new run
            navigate(createPageUrl(`TrainingStatus?runId=${newRun.id}`));
            
        } catch (error) {
            console.error("Failed to start training:", error);
        }
    };
    
    const handleStopTraining = async (runId) => {
        await TrainingRun.update(runId, { status: 'stopped' });
        loadStepData(selectedStepId);
    };

    const handleDeleteTraining = async (runId) => {
        await TrainingRun.delete(runId);
        loadStepData(selectedStepId);
    };

    const trainerStatusConfig = {
        checking: { label: 'Checking trainer...', color: 'bg-gray-100 text-gray-700', icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" /> },
        busy: { label: 'Trainer busy', color: 'bg-amber-100 text-amber-800', icon: <Cpu className="w-3 h-3 mr-1" /> },
        queued: { label: 'Trainer queued', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3 h-3 mr-1" /> },
        idle: { label: 'Trainer available', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
        offline: { label: 'Trainer offline', color: 'bg-red-100 text-red-800', icon: <WifiOff className="w-3 h-3 mr-1" /> },
        unknown: { label: 'Trainer status unknown', color: 'bg-red-100 text-red-800', icon: <Info className="w-3 h-3 mr-1" /> },
    };
    const currentTrainerStatus = trainerStatusConfig[trainerStatus.state] || trainerStatusConfig.unknown;

    if (isLoading && !allProjects.length) {
        return <LoadingOverlay isLoading={true} text="Loading projects..." />;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="max-w-7xl mx-auto p-6 w-full">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-0">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">AI Model Training Hub</h1>
                                <p className="text-gray-600 mt-1">
                                    {selectedProject?.name}
                                    {selectedStep && <span className="text-blue-600 font-medium"> • Step: {selectedStep.title}</span>}
                                </p>
                            </div>
                        </div>
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end gap-1">
                            <Badge className={`${currentTrainerStatus.color} border-0 font-medium`}>
                                {currentTrainerStatus.icon}
                                <span>{currentTrainerStatus.label}</span>
                            </Badge>
                            <span className="text-xs text-gray-500">
                                running: {trainerStatus.running}, queued: {trainerStatus.queued}, workers: {trainerStatus.workersOnline}
                            </span>
                        </div>
                        {selectedStep && (
                            <Button onClick={() => setShowStartTrainingDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6">
                                <PlayCircle className="w-4 h-4 mr-2" /> Start New Training Run
                            </Button>
                        )}
                    </div>
                </div>

                {!selectedProjectId && (
                    <Card><CardHeader><CardTitle>Select a Project</CardTitle></CardHeader><CardContent>
                        <Select onValueChange={handleProjectSelect}>
                            <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                            <SelectContent>{allProjects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </CardContent></Card>
                )}

                {selectedProjectId && !selectedStepId && (
                     <Card><CardHeader><CardTitle>Select a Step</CardTitle></CardHeader><CardContent>
                        <Select onValueChange={handleStepSelect}>
                            <SelectTrigger><SelectValue placeholder="Select a step to train..." /></SelectTrigger>
                            <SelectContent>{projectSteps.map(s => <SelectItem key={s.id} value={s.id}>Step {s.step_number}: {s.title}</SelectItem>)}</SelectContent>
                        </Select>
                    </CardContent></Card>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0">
                <div className="max-w-7xl mx-auto">
                    {selectedStep ? (
                        <div className="space-y-8">
                            {groupedRuns.running.length > 0 && (
                                <Section title="Live Training & Optimization" icon={<Rocket className="w-5 h-5 text-blue-600" />} count={groupedRuns.running.length}>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedRuns.running.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                    </div>
                                </Section>
                            )}

                             {groupedRuns.queued.length > 0 && (
                                <Section title="In Queue" icon={<Clock className="w-5 h-5 text-amber-600" />} count={groupedRuns.queued.length}>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedRuns.queued.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                    </div>
                                </Section>
                            )}

                            {groupedRuns.completed.length > 0 && (
                                <Section title="Completed Models" icon={<CheckCircle className="w-5 h-5 text-green-600" />} count={groupedRuns.completed.length}>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedRuns.completed.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                    </div>
                                </Section>
                            )}
                            
                            {groupedRuns.history.length > 0 && (
                                <Section title="History (Failed/Stopped)" icon={<History className="w-5 h-5 text-gray-600" />} count={groupedRuns.history.length}>
                                     <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupedRuns.history.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                    </div>
                                </Section>
                            )}

                            {trainingRuns.length === 0 && (
                                <div className="text-center py-16 bg-gray-50 rounded-lg">
                                    <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <h3 className="text-xl font-semibold text-gray-800">No Training Runs Yet</h3>
                                    <p className="text-gray-500 mt-2">Start your first training run to begin creating a model for this step.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                         <div className="text-center py-16 bg-gray-50 rounded-lg">
                            <Layers className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-800">Select a Project and Step</h3>
                            <p className="text-gray-500 mt-2">Choose a project and a specific step to view and manage its training runs.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <StartTrainingDialog
                open={showStartTrainingDialog}
                onOpenChange={setShowStartTrainingDialog}
                onSubmit={handleStartTraining}
                stepId={selectedStepId}
                stepTitle={selectedStep?.title}
                stepData={selectedStep}
                existingRuns={trainingRuns}
            />
        </div>
    );
}
