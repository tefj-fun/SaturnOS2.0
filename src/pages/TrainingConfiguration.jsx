import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { TrainingRun } from '@/api/entities';
import { TrainerWorker } from '@/api/entities';
import { listStepImages } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowLeft,
  PlayCircle,
  Cpu,
  Layers,
  CheckCircle,
  History,
  FolderOpen,
  Info,
  Loader2,
  Clock,
  WifiOff,
  RefreshCw,
  Rocket,
  ChevronDown
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
    const location = useLocation();
    const [allProjects, setAllProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectSteps, setProjectSteps] = useState([]);
    const [selectedStepId, setSelectedStepId] = useState(null);
    const [selectedStep, setSelectedStep] = useState(null);
    const [trainingRuns, setTrainingRuns] = useState([]);
    const [datasetSummary, setDatasetSummary] = useState(null);
    const [isDatasetLoading, setIsDatasetLoading] = useState(false);
    const [trainerStatus, setTrainerStatus] = useState({
        state: "checking",
        running: 0,
        queued: 0,
        workersOnline: 0,
        lastCheckedAt: null,
        activeWorkers: [],
    });

    const [isLoading, setIsLoading] = useState(true);
    const [showStartTrainingDialog, setShowStartTrainingDialog] = useState(false);
    const [showTrainerAdvanced, setShowTrainerAdvanced] = useState(false);

    const HEARTBEAT_TIMEOUT_MS = 60000;

    const loadTrainerStatus = useCallback(async () => {
        try {
            const [activeRuns, workers] = await Promise.all([
                TrainingRun.filter({ status: ['running', 'queued', 'canceling'] }, '-created_date'),
                TrainerWorker.list('-last_seen'),
            ]);
            const running = activeRuns.filter(run => run.status === 'running' || run.status === 'canceling').length;
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
            setTrainerStatus({
                state,
                running,
                queued,
                workersOnline,
                lastCheckedAt: new Date().toISOString(),
                activeWorkers,
            });
        } catch (error) {
            console.error('Error loading trainer status:', error);
            setTrainerStatus({
                state: 'unknown',
                running: 0,
                queued: 0,
                workersOnline: 0,
                lastCheckedAt: new Date().toISOString(),
                activeWorkers: [],
            });
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
            if (run.status === 'running' || run.status === 'canceling') {
                groups.running.push(run);
            } else if (run.status === 'queued') {
                 groups.queued.push(run);
            } else if (run.status === 'completed') {
                groups.completed.push(run);
            } else { // failed, stopped, canceled
                groups.history.push(run);
            }
        });
        return groups;
    }, [trainingRuns]);

    const recentRuns = useMemo(() => trainingRuns.slice(0, 5), [trainingRuns]);

    const getSplitName = useCallback((groupName) => {
        if (!groupName) return "train";
        const normalized = String(groupName).toLowerCase();
        if (normalized === "training") return "train";
        if (normalized === "inference" || normalized === "validation" || normalized === "val") return "val";
        if (normalized === "test" || normalized === "testing") return "test";
        return "train";
    }, []);

    const toNumber = (value) => {
        if (value === null || value === undefined) return null;
        const parsed = typeof value === "string" ? Number(value) : value;
        return Number.isFinite(parsed) ? parsed : null;
    };

    const formatTime = (value) => {
        if (!value) return "Unknown";
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "Unknown";
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getWorkerHardwareLabel = (worker) => {
        if (!worker) return null;
        const parts = [];
        const deviceType = worker.device_type || worker.compute_type;
        if (deviceType) parts.push(`device: ${deviceType}`);
        const gpuName = worker.gpu_name || worker.gpu_model || worker.gpu;
        if (gpuName) parts.push(`GPU: ${gpuName}`);
        const vramGb = toNumber(worker.gpu_memory_gb ?? worker.gpu_vram_gb);
        const vramMb = toNumber(worker.gpu_memory_mb ?? worker.gpu_vram_mb);
        if (vramGb && vramGb > 0) {
            parts.push(`VRAM: ${vramGb} GB`);
        } else if (vramMb && vramMb > 0) {
            parts.push(`VRAM: ${(vramMb / 1024).toFixed(1)} GB`);
        }
        const cpuModel = worker.cpu_model || worker.cpu;
        if (cpuModel) parts.push(`CPU: ${cpuModel}`);
        const ramGb = toNumber(worker.ram_gb);
        if (ramGb && ramGb > 0) parts.push(`RAM: ${ramGb} GB`);
        return parts.length ? parts.join(" | ") : null;
    };

    const extractAnnotations = useCallback((imageRow) => {
        const raw = imageRow?.annotations;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "object") {
            if (Array.isArray(raw.annotations)) return raw.annotations;
            if (Array.isArray(raw.objects)) return raw.objects;
        }
        return [];
    }, []);

    const getAnnotationTypeCounts = useCallback((imageRow, classNames) => {
        const annotations = extractAnnotations(imageRow);
        if (!annotations.length) return { boxes: 0, segments: 0 };
        let boxes = 0;
        let segments = 0;
        const enforceClasses = Array.isArray(classNames) && classNames.length > 0;
        annotations.forEach((annotation) => {
            if (!annotation) return;
            if (annotation.status && ["deleted", "disabled", "archived"].includes(String(annotation.status))) {
                return;
            }
            const className = annotation.class || annotation.label;
            if (!className) return;
            if (enforceClasses && !classNames.includes(className)) return;
            const type = annotation.type || annotation.shape;
            if (type === "bbox" || type === "rectangle") {
                boxes += 1;
                return;
            }
            if (type === "polygon" || type === "segmentation" || type === "brush") {
                segments += 1;
            }
        });
        return { boxes, segments };
    }, [extractAnnotations]);

    const refreshDatasetSummary = useCallback(async (stepOverride) => {
        const step = stepOverride || selectedStep;
        if (!step?.id) {
            setDatasetSummary(null);
            return;
        }
        setIsDatasetLoading(true);
        try {
            const stepImages = await listStepImages(step.id);
            const splits = { train: 0, val: 0, test: 0 };
            let labeled = 0;
            const classNames = (step.classes || []).filter(Boolean);
            const labelTypes = { boxes: 0, segments: 0 };
            stepImages.forEach((imageRow) => {
                const splitName = getSplitName(imageRow.image_group);
                if (splitName === "train") splits.train += 1;
                if (splitName === "val") splits.val += 1;
                if (splitName === "test") splits.test += 1;
                const counts = getAnnotationTypeCounts(imageRow, classNames);
                labelTypes.boxes += counts.boxes;
                labelTypes.segments += counts.segments;
                const annotations = extractAnnotations(imageRow);
                if (annotations.length > 0) labeled += 1;
            });
            const total = stepImages.length;
            const classesCount = (step.classes || []).filter(Boolean).length;
            const ready = total > 0 && labeled > 0 && classesCount > 0;
            setDatasetSummary({ total, labeled, splits, classesCount, ready, labelTypes });
        } catch (error) {
            console.error("Error loading dataset summary:", error);
            setDatasetSummary(null);
        } finally {
            setIsDatasetLoading(false);
        }
    }, [extractAnnotations, getAnnotationTypeCounts, getSplitName, selectedStep]);

    const loadAllProjects = useCallback(async () => {
        try {
            const projects = await Project.list();
            setAllProjects(projects);
            return projects;
        } catch (error) { console.error('Error loading projects:', error); }
        return [];
    }, []);
    
    const loadStepData = useCallback(async (stepId, allSteps) => {
        const step = (allSteps || projectSteps).find(s => s.id === stepId);
        if (!step) return;
        
        setSelectedStepId(stepId);
        setSelectedStep(step);

        const runs = await TrainingRun.filter(
            { step_id: stepId, project_id: step.project_id },
            '-created_date'
        );
        setTrainingRuns(runs);
        refreshDatasetSummary(step);
    }, [projectSteps, refreshDatasetSummary]);

    const loadProjectData = useCallback(async (projectId, stepId = null) => {
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
                setDatasetSummary(null);
            }
        } catch (error) {
            console.error("Error loading project data:", error);
            navigate(createPageUrl('Projects'));
        } finally {
            setIsLoading(false);
        }
    }, [loadStepData, navigate]);
    
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
        const urlParams = new URLSearchParams(location.search);
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
    }, [loadAllProjects, loadProjectData, location.search, navigate]);

    useEffect(() => {
        if (!selectedStepId) return;
        const hasActiveRuns = trainingRuns.some(run => ['running', 'queued', 'canceling'].includes(run.status));
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
        const run = trainingRuns.find(item => item.id === runId);
        if (run?.status === 'queued') {
            await TrainingRun.update(runId, {
                status: 'canceled',
                cancel_requested: true,
                canceled_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                error_message: 'Canceled by user.',
            });
        } else {
            await TrainingRun.update(runId, { status: 'canceling', cancel_requested: true });
        }
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
    const trainerStatusDescriptions = {
        checking: 'Checking the trainer service status.',
        busy: 'Trainer workers are running active jobs. New runs may queue.',
        queued: 'Trainer workers are busy and queued runs are waiting.',
        idle: 'At least one trainer worker is online and there are no active or queued runs.',
        offline: 'No trainer workers were seen recently. Runs will remain queued.',
        unknown: 'Trainer status could not be determined.',
    };
    const currentTrainerStatus = trainerStatusConfig[trainerStatus.state] || trainerStatusConfig.unknown;
    const isTrainerOffline = trainerStatus.state === 'offline' || trainerStatus.state === 'unknown';
    const startButtonClass = isTrainerOffline ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700';
    const datasetReady = datasetSummary ? datasetSummary.ready : true;
    const datasetStatusLabel = datasetSummary ? (datasetReady ? 'Ready' : 'Needs attention') : 'Not checked';
    const datasetStatusClass = datasetSummary
        ? (datasetReady ? 'bg-emerald-100 text-emerald-800 border-0' : 'bg-amber-100 text-amber-800 border-0')
        : 'bg-gray-100 text-gray-700 border-0';
    const labelTypes = datasetSummary?.labelTypes || { boxes: 0, segments: 0 };
    const hasMixedLabels = labelTypes.boxes > 0 && labelTypes.segments > 0;
    const annotationTypeLabel = datasetSummary
        ? (hasMixedLabels
            ? "Mixed (boxes + polygons)"
            : labelTypes.segments > 0
                ? "Polygons only"
                : labelTypes.boxes > 0
                    ? "Boxes only"
                    : "None")
        : "n/a";
    const activeWorkers = trainerStatus.activeWorkers || [];
    const trainerStatusDescription = trainerStatusDescriptions[trainerStatus.state] || trainerStatusDescriptions.unknown;

    if (isLoading && !allProjects.length) {
        return <LoadingOverlay isLoading={true} text="Loading projects..." />;
    }

    return (
        <div className="h-full flex flex-col">
            <div className="p-6 w-full">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-0">
                                <ArrowLeft className="w-4 h-4" />
                            </Button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Training Overview</h1>
                                <p className="text-gray-600 mt-1">
                                    {selectedProject?.name}
                                    {selectedStep && <span className="text-blue-600 font-medium"> / Step: {selectedStep.title}</span>}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center justify-end gap-2">
                                <Popover onOpenChange={(open) => { if (!open) setShowTrainerAdvanced(false); }}>
                                    <PopoverTrigger
                                        className="appearance-none border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-md"
                                        type="button"
                                    >
                                        <Badge className={`${currentTrainerStatus.color} border-0 font-medium`}>
                                            {currentTrainerStatus.icon}
                                            <span>{currentTrainerStatus.label}</span>
                                        </Badge>
                                    </PopoverTrigger>
                                    <PopoverContent align="end" className="w-80">
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Trainer status</p>
                                                <p className="text-xs text-gray-600 mt-1">{trainerStatusDescription}</p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Badge className={`${currentTrainerStatus.color} border-0 font-medium`}>
                                                    {currentTrainerStatus.icon}
                                                    <span>{currentTrainerStatus.label}</span>
                                                </Badge>
                                                <span className="text-xs text-gray-500">
                                                    Last checked: {formatTime(trainerStatus.lastCheckedAt)}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="rounded-md bg-gray-50 p-2 text-center">
                                                    <div className="text-sm font-semibold text-gray-900">{trainerStatus.workersOnline}</div>
                                                    <div className="text-[11px] text-gray-500">Workers</div>
                                                </div>
                                                <div className="rounded-md bg-gray-50 p-2 text-center">
                                                    <div className="text-sm font-semibold text-gray-900">{trainerStatus.running}</div>
                                                    <div className="text-[11px] text-gray-500">Running</div>
                                                </div>
                                                <div className="rounded-md bg-gray-50 p-2 text-center">
                                                    <div className="text-sm font-semibold text-gray-900">{trainerStatus.queued}</div>
                                                    <div className="text-[11px] text-gray-500">Queued</div>
                                                </div>
                                            </div>
                                            <div className="border-t border-gray-100 pt-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTrainerAdvanced((prev) => !prev)}
                                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                >
                                                    Advanced details
                                                    <ChevronDown className={`w-3 h-3 transition-transform ${showTrainerAdvanced ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showTrainerAdvanced && (
                                                    <div className="mt-2 space-y-2">
                                                        {activeWorkers.length === 0 && (
                                                            <p className="text-xs text-gray-500">No active workers detected.</p>
                                                        )}
                                                        {activeWorkers.map((worker, index) => {
                                                            const hardwareLabel = getWorkerHardwareLabel(worker);
                                                            return (
                                                                <div key={worker.worker_id || index} className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                                                                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                                                                        <span className="font-medium text-gray-700">Worker {index + 1}</span>
                                                                        <span>Last seen: {formatTime(worker?.last_seen)}</span>
                                                                    </div>
                                                                    <div className="mt-1 text-gray-700">
                                                                        {hardwareLabel || "Hardware not reported by this worker."}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-600 hover:text-gray-900"
                                    onClick={() => {
                                        setTrainerStatus((prev) => ({ ...prev, state: "checking" }));
                                        loadTrainerStatus();
                                    }}
                                    aria-label="Refresh trainer status"
                                    title="Refresh trainer status"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <span className="text-xs text-gray-500">
                                running: {trainerStatus.running}, queued: {trainerStatus.queued}, workers: {trainerStatus.workersOnline}
                            </span>
                            {isTrainerOffline && (
                                <span className="text-xs text-amber-600">Runs will stay queued while offline</span>
                            )}
                        </div>
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
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-0">
                <div className="max-w-7xl mx-auto">
                    {selectedStep ? (
                        <div className="space-y-8">
                            <div className="grid gap-6 lg:grid-cols-3">
                                <Card className="border-0 shadow-sm">
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <CardTitle>Dataset readiness</CardTitle>
                                            <Badge className={datasetStatusClass}>
                                                {datasetStatusLabel}
                                            </Badge>
                                        </div>
                                        <CardDescription>Check images, labels, splits, and classes before training.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3 text-sm text-gray-600">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <p><span className="font-medium text-gray-800">Images:</span> {datasetSummary ? datasetSummary.total : (isDatasetLoading ? "Checking..." : "Not checked")}</p>
                                                <p><span className="font-medium text-gray-800">Labeled images:</span> {datasetSummary ? datasetSummary.labeled : "n/a"}</p>
                                                <p><span className="font-medium text-gray-800">Splits:</span> train {datasetSummary?.splits?.train ?? "n/a"} / val {datasetSummary?.splits?.val ?? "n/a"} / test {datasetSummary?.splits?.test ?? "n/a"}</p>
                                                <p><span className="font-medium text-gray-800">Classes:</span> {datasetSummary ? datasetSummary.classesCount : "n/a"}</p>
                                                <p><span className="font-medium text-gray-800">Annotation types:</span> {annotationTypeLabel}</p>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => refreshDatasetSummary(selectedStep)}
                                                disabled={isDatasetLoading}
                                            >
                                                {isDatasetLoading ? "Refreshing..." : "Refresh"}
                                            </Button>
                                        </div>
                                        {datasetSummary?.classesCount === 0 && (
                                            <p className="text-xs text-amber-700">Add class names before training.</p>
                                        )}
                                        {datasetSummary?.total === 0 && (
                                            <p className="text-xs text-amber-700">Upload images before training.</p>
                                        )}
                                        {datasetSummary?.total > 0 && datasetSummary?.labeled === 0 && (
                                            <p className="text-xs text-amber-700">Annotate images to produce meaningful training results.</p>
                                        )}
                                        {hasMixedLabels && (
                                            <p className="text-xs text-amber-700">Mixed box and polygon labels detected. Use only boxes for detection or only polygons for segmentation.</p>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => navigate(createPageUrl(`AnnotationStudio?projectId=${selectedProjectId}`))}
                                        >
                                            Open annotation studio
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-0 shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Start training</CardTitle>
                                        <CardDescription>Use presets for speed, or open advanced settings for full control.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-sm text-gray-600">
                                        <div className="space-y-1">
                                            <p><span className="font-medium text-gray-800">Preset:</span> Balanced</p>
                                            <p><span className="font-medium text-gray-800">Base model:</span> YOLOv8s</p>
                                            <p><span className="font-medium text-gray-800">Compute:</span> GPU (device 0)</p>
                                        </div>
                                        {!datasetReady && (
                                            <Alert className="border-amber-200 bg-amber-50">
                                                <AlertTitle className="text-amber-900">Dataset not ready</AlertTitle>
                                                <AlertDescription className="text-amber-800">Resolve dataset issues before starting a run.</AlertDescription>
                                            </Alert>
                                        )}
                                        <Button
                                            onClick={() => setShowStartTrainingDialog(true)}
                                            className={`${startButtonClass} text-white`}
                                            disabled={!datasetReady}
                                        >
                                            <PlayCircle className="w-4 h-4 mr-2" />
                                            {isTrainerOffline ? 'Queue Training Run' : 'Start Training'}
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-0 shadow-sm">
                                    <CardHeader>
                                        <CardTitle>Recent runs</CardTitle>
                                        <CardDescription>Quick access to the latest training activity.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        {recentRuns.length === 0 && (
                                            <p className="text-sm text-gray-500">No runs yet for this step.</p>
                                        )}
                                        {recentRuns.map(run => (
                                            <div key={run.id} className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{run.run_name}</p>
                                                    <p className="text-xs text-gray-500">{run.created_date ? new Date(run.created_date).toLocaleString() : "Unknown date"}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className="border-0 bg-gray-100 text-gray-700 capitalize">{run.status}</Badge>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => navigate(createPageUrl(`TrainingStatus?runId=${run.id}`))}
                                                    >
                                                        View
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="space-y-8">
                                {groupedRuns.running.length > 0 && (
                                    <Section title="Live training" icon={<Rocket className="w-5 h-5 text-blue-600" />} count={groupedRuns.running.length}>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {groupedRuns.running.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                        </div>
                                    </Section>
                                )}

                                {groupedRuns.queued.length > 0 && (
                                    <Section title="Queued runs" icon={<Clock className="w-5 h-5 text-amber-600" />} count={groupedRuns.queued.length}>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {groupedRuns.queued.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                        </div>
                                    </Section>
                                )}

                                {groupedRuns.completed.length > 0 && (
                                    <Section title="Completed models" icon={<CheckCircle className="w-5 h-5 text-green-600" />} count={groupedRuns.completed.length}>
                                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {groupedRuns.completed.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                        </div>
                                    </Section>
                                )}
                                
                                {groupedRuns.history.length > 0 && (
                                    <Section title="History" icon={<History className="w-5 h-5 text-gray-600" />} count={groupedRuns.history.length}>
                                         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {groupedRuns.history.map(run => <TrainingRunCard key={run.id} run={run} onStop={handleStopTraining} onDelete={handleDeleteTraining} />)}
                                        </div>
                                    </Section>
                                )}

                                {trainingRuns.length === 0 && (
                                    <div className="text-center py-16 bg-gray-50 rounded-lg">
                                        <FolderOpen className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                        <h3 className="text-xl font-semibold text-gray-800">No training runs yet</h3>
                                        <p className="text-gray-500 mt-2">Start your first training run to begin creating a model for this step.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Card>
                            <CardHeader>
                                <CardTitle>Select a Project and Step</CardTitle>
                            </CardHeader>
                            <CardContent className="flex min-h-[40px] items-center gap-3 text-sm text-gray-500">
                                <Layers className="h-5 w-5 text-gray-400" />
                                <span>Choose a project and a specific step to view and manage its training runs.</span>
                            </CardContent>
                        </Card>
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
                trainerOffline={isTrainerOffline}
            />
        </div>
    );
}
