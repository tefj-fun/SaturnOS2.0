
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Brain,
  Target,
  TrendingUp,
  Activity,
  Cpu,
  CheckCircle,
  ArrowLeft,
  Sparkles,
  Rocket,
  Coffee,
  Code,
  BarChart3,
  StopCircle,
  Download,
  Eye,
  Loader2,
  XCircle,
  Clock
} from 'lucide-react';
import { createPageUrl } from '@/utils';

const trainingTips = [
  "Did you know? Your model learns by looking at thousands of examples.",
  "Neural networks are inspired by how our brains work.",
  "Each epoch means the model has seen your entire dataset once.",
  "When loss goes down, your model is improving.",
  "Your model is building patterns from your annotations right now.",
  "Lower validation loss usually means better performance on new images.",
  "GPU training can be much faster than CPU training.",
  "Transfer learning helps your model learn faster by starting with pretrained knowledge."
];

const TrainingAnimation = ({ isTraining, progress }) => {
  return (
    <div className="relative w-32 h-32 mx-auto mb-6">
      {/* Outer rotating ring */}
      <motion.div
        className="absolute inset-0 border-4 border-blue-200 rounded-full"
        animate={isTraining ? { rotate: 360 } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      />

      {/* Inner pulsing circle */}
      <motion.div
        className="absolute inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center"
        animate={isTraining ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Brain className="w-8 h-8 text-white" />
      </motion.div>

      {/* Progress arc */}
      <svg className="absolute inset-0 w-full h-full transform -rotate-90">
        <circle
          cx="64"
          cy="64"
          r="60"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
          className="text-green-500"
          strokeDasharray={`${2 * Math.PI * 60}`}
          strokeDashoffset={`${2 * Math.PI * 60 * (1 - progress / 100)}`}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
    </div>
  );
};

const trainingPhases = [
  { key: 'prep', label: 'Prep' },
  { key: 'queue', label: 'Queue' },
  { key: 'training', label: 'Training' },
  { key: 'validation', label: 'Validation' },
  { key: 'complete', label: 'Complete' },
];

const TrainingTimeline = ({ currentIndex, status }) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {trainingPhases.map((phase, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        const isFailed = ['failed', 'canceled', 'stopped'].includes(status) && index === currentIndex;
        const dotClass = isFailed
          ? 'bg-red-500'
          : isComplete
            ? 'bg-green-500'
            : isActive
              ? 'bg-blue-500'
              : 'bg-gray-300';
        const textClass = isFailed
          ? 'text-red-600'
          : isComplete
            ? 'text-green-700'
            : isActive
              ? 'text-blue-600'
              : 'text-gray-400';
        return (
          <div key={phase.key} className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${dotClass}`} />
            <span className={`text-xs font-medium ${textClass}`}>{phase.label}</span>
            {index < trainingPhases.length - 1 && (
              <div className={`h-px w-6 ${isComplete ? 'bg-green-300' : 'bg-gray-300'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const MetricCard = ({ icon, label, value, trend, color = "blue" }) => (
  <Card className="glass-effect border-0 shadow-lg">
    <CardContent className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-${color}-100 rounded-lg flex items-center justify-center`}>
            {React.cloneElement(icon, { className: `w-5 h-5 text-${color}-600` })}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{value}</p>
            <p className="text-sm text-gray-600">{label}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-${trend > 0 ? 'green' : 'red'}-600`}>
            <TrendingUp className={`w-4 h-4 ${trend < 0 ? 'rotate-180' : ''}`} />
            <span className="text-sm font-medium">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatMetric = (value, digits = 3) => {
  const numeric = toNumber(value);
  return numeric === null ? "N/A" : numeric.toFixed(digits);
};

const formatDeviceLabel = (device, compute) => {
  if (device === "cpu") return "CPU";
  if (device === 0 || device === "0") return "GPU (device 0)";
  if (typeof device === "number") return `GPU (device ${device})`;
  if (device) return String(device);
  if (compute === "cpu") return "CPU";
  if (compute === "gpu") return "GPU (device 0)";
  return "Default";
};

const formatAugmentationValue = (value) => {
  const numeric = toNumber(value);
  if (numeric === null) return null;
  const fixed = numeric.toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
};

const formatAugmentationSummary = (augmentation) => {
  if (!augmentation) return "Default";
  const preset = augmentation.preset;
  if (preset && preset !== "custom") return preset;
  const parts = [];
  const fliplr = formatAugmentationValue(augmentation.fliplr);
  const mosaic = formatAugmentationValue(augmentation.mosaic);
  const mixup = formatAugmentationValue(augmentation.mixup);
  if (fliplr !== null) parts.push(`flip ${fliplr}`);
  if (mosaic !== null) parts.push(`mosaic ${mosaic}`);
  if (mixup !== null) parts.push(`mixup ${mixup}`);
  return parts.length ? `Custom (${parts.join(", ")})` : "Custom";
};


export default function TrainingStatusPage() {
  const navigate = useNavigate();
  const [trainingRun, setTrainingRun] = useState(null);
  const [project, setProject] = useState(null);
  const [step, setStep] = useState(null);
  const [currentTip, setCurrentTip] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentMessage, setDeploymentMessage] = useState('');

  const loadTrainingData = useCallback(async (runId) => {
    try {
      const runs = await TrainingRun.filter({ id: runId });
      if (runs.length > 0) {
        const run = runs[0];
        setTrainingRun(run);

        // Load related project and step data
        const [projects, steps] = await Promise.all([
          Project.filter({ id: run.project_id }),
          SOPStep.filter({ id: run.step_id })
        ]);

        if (projects.length > 0) setProject(projects[0]);
        if (steps.length > 0) setStep(steps[0]);

      }
    } catch (error) {
      console.error("Error loading training data:", error);
    }
  }, []);

  const location = useLocation();
  const runId = useMemo(() => {
    const urlParams = new URLSearchParams(location.search);
    return urlParams.get('runId');
  }, [location.search]);

  useEffect(() => {
    if (runId) {
      loadTrainingData(runId);
    } else {
      navigate(createPageUrl('Projects'));
    }
  }, [runId, loadTrainingData, navigate]);

  const trainingStatus = trainingRun?.status;
  const deploymentStatus = trainingRun?.deployment_status;

  useEffect(() => {
    if (!runId) return;
    const shouldPoll = Boolean(
      trainingStatus && ['queued', 'running', 'canceling'].includes(trainingStatus)
    ) || deploymentStatus === 'deploying';
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      loadTrainingData(runId);
    }, 5000);

    return () => clearInterval(interval);
  }, [runId, trainingStatus, deploymentStatus, loadTrainingData]);

  // Rotate tips every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % trainingTips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleStopTraining = async () => {
    if (!trainingRun) return;
    try {
        if (trainingRun.status === 'queued') {
          await TrainingRun.update(trainingRun.id, {
            status: 'canceled',
            cancel_requested: true,
            canceled_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
            error_message: 'Canceled by user.',
          });
          setTrainingRun(prev => ({ ...prev, status: 'canceled', cancel_requested: true }));
        } else {
          await TrainingRun.update(trainingRun.id, { status: 'canceling', cancel_requested: true });
          setTrainingRun(prev => ({ ...prev, status: 'canceling', cancel_requested: true }));
        }
    } catch (error) {
        console.error("Failed to stop training:", error);
        // Optionally show an error alert to the user
    }
  };

  const handleDeployModel = async (runId) => {
    setIsDeploying(true);
    setDeploymentMessage('');

    try {
      await TrainingRun.update(runId, {
        deployment_status: 'deploying'
      });

      setDeploymentMessage('Deployment requested. The inference worker will register this model shortly.');
      loadTrainingData(runId);

    } catch (error) {
      console.error('Deployment failed:', error);
      await TrainingRun.update(runId, {
        deployment_status: 'deployment_failed'
      });
      setDeploymentMessage('Deployment failed. Please try again.');
    }

    setIsDeploying(false);

    // Clear message after 5 seconds
    setTimeout(() => setDeploymentMessage(''), 5000);
  };

  const getDeploymentStatusConfig = (deploymentStatus, isDeployed) => {
    if (isDeployed && deploymentStatus === 'deployed') {
      return {
        label: 'Deployed',
        color: 'bg-green-100 text-green-800',
        icon: <CheckCircle className="w-4 h-4 text-green-600" />
      };
    }

    switch (deploymentStatus) {
      case 'deploying':
        return {
          label: 'Deploying...',
          color: 'bg-blue-100 text-blue-800',
          icon: <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        };
      case 'deployment_failed':
        return {
          label: 'Deployment Failed',
          color: 'bg-red-100 text-red-800',
          icon: <XCircle className="w-4 h-4 text-red-600" />
        };
      default:
        return null;
    }
  };

  // **THE FIX**: Add a loading guard before defining any components that use the data.
  // This ensures that `trainingRun` is not null when the rest of the page renders.
  if (!trainingRun) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 animate-spin">
            <Brain className="w-12 h-12 text-blue-600" />
          </div>
          <p className="text-gray-600">Loading training status...</p>
        </div>
      </div>
    );
  }

  // Now we can safely define these constants, because `trainingRun` is guaranteed to exist.
  const isTraining = trainingRun.status === 'running' || trainingRun.status === 'canceling';
  const isCompleted = trainingRun.status === 'completed';
  const isStopped = trainingRun.status === 'stopped';
  const isFailed = trainingRun.status === 'failed';
  const isQueued = trainingRun.status === 'queued';
  const isCanceling = trainingRun.status === 'canceling';
  const isCanceled = trainingRun.status === 'canceled';
  const results = trainingRun.results || {};
  const rawMetrics = results.metrics || {};
  const totalEpochs = trainingRun.configuration?.epochs || 0;
  const metricEpoch = toNumber(rawMetrics.epoch);
  const currentEpochValue = metricEpoch !== null ? metricEpoch : (isCompleted ? totalEpochs : 0);
  const progress = totalEpochs && currentEpochValue
    ? Math.min(100, (currentEpochValue / totalEpochs) * 100)
    : (isCompleted ? 100 : 0);
  const currentEpochDisplay = Math.max(0, Math.floor(currentEpochValue || 0));
  const progressLabel = isCompleted
    ? "100%"
    : isCanceling
      ? "Canceling"
    : isTraining
      ? "Running"
      : isQueued
        ? "Queued"
      : isFailed
        ? "Failed"
        : isCanceled
          ? "Canceled"
        : isStopped
          ? "Stopped"
          : "0%";
  const workerLabel = trainingRun.worker_id || (isTraining ? "Assigned" : "Pending");
  const artifacts = Array.isArray(results.artifacts) ? results.artifacts : [];
  const dataYaml = trainingRun.data_yaml || trainingRun.configuration?.dataYaml;
  const hasResults = isCompleted && (
    toNumber(results.mAP) !== null ||
    toNumber(results.precision) !== null ||
    toNumber(results.recall) !== null ||
    artifacts.length > 0
  );
  const phaseIndex = isCompleted
    ? 4
    : isQueued
      ? 1
      : isTraining
        ? 2
        : 2;
  const currentPhaseLabel = trainingPhases[phaseIndex]?.label || "Prep";

  // Content for the left column / Training Progress tab
  const progressTitleConfig = isCompleted
    ? { icon: <CheckCircle className="w-5 h-5 text-green-600" />, title: "Training Complete" }
    : isFailed
      ? { icon: <XCircle className="w-5 h-5 text-red-600" />, title: "Training Failed" }
      : isCanceled
        ? { icon: <StopCircle className="w-5 h-5 text-red-600" />, title: "Training Canceled" }
        : isStopped
          ? { icon: <StopCircle className="w-5 h-5 text-red-600" />, title: "Training Stopped" }
          : isCanceling
            ? { icon: <Clock className="w-5 h-5 text-amber-600" />, title: "Canceling Training" }
            : isQueued
              ? { icon: <Clock className="w-5 h-5 text-amber-600" />, title: "Training Queued" }
              : { icon: <Sparkles className="w-5 h-5 text-purple-600" />, title: "Your AI Model is Learning" };

  const trainingProgressContent = (
    <div className="lg:col-span-2 space-y-6">
      {/* Training Animation Card */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {progressTitleConfig.icon}
            {progressTitleConfig.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <TrainingAnimation isTraining={isTraining} progress={progress} />

          <div className="space-y-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600 mb-2">
                <span>Training Progress</span>
                <span>{progressLabel}</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{currentEpochDisplay}</p>
                <p className="text-sm text-gray-600">Current Epoch</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{totalEpochs || 'N/A'}</p>
                <p className="text-sm text-gray-600">Total Epochs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetricCard
          icon={<Target />}
          label="mAP"
          value={formatMetric(results.mAP)}
          color="blue"
        />
        <MetricCard
          icon={<TrendingUp />}
          label="Precision"
          value={formatMetric(results.precision)}
          color="green"
        />
        <MetricCard
          icon={<Activity />}
          label="Recall"
          value={formatMetric(results.recall)}
          color="purple"
        />
        <MetricCard
          icon={<Cpu />}
          label="Worker"
          value={workerLabel}
          color="orange"
        />
      </div>

      {/* Fun Tip Card */}
      {(isTraining || isQueued || isCanceling) && (
        <Card className="glass-effect border-0 shadow-lg bg-gradient-to-r from-yellow-50 to-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Coffee className="w-6 h-6 text-orange-600" />
              <div>
                <h3 className="font-semibold text-orange-900">While You Wait...</h3>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentTip}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-orange-800 mt-1"
                  >
                    {trainingTips[currentTip]}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Completion/Stopped Alert */}
      {isCompleted && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Congratulations! Your model has been trained successfully. You can now use it to make predictions on new images.
          </AlertDescription>
        </Alert>
      )}
      {isCanceling && (
        <Alert className="border-amber-300 bg-amber-50">
          <Clock className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Cancellation requested. The trainer will stop after the current epoch.
          </AlertDescription>
        </Alert>
      )}
      {isStopped && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <StopCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            You have manually stopped the training run. No further progress was made.
          </AlertDescription>
        </Alert>
      )}
      {isCanceled && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <StopCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            Training was canceled before completion.
          </AlertDescription>
        </Alert>
      )}
      {isFailed && (
        <Alert variant="destructive" className="border-red-300 bg-red-50">
          <StopCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {trainingRun.error_message || "Training failed. Check the trainer service logs for details."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  // Content for the right column / Training Logs tab
  const trainingLogsContent = (
    <div className="space-y-6">
      {/* Configuration Summary */}
      <Card className="glass-effect border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-gray-600" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Base Model:</span>
            <Badge variant="outline">{trainingRun.base_model}</Badge>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Batch Size:</span>
            <span className="font-medium">{trainingRun.configuration?.batchSize || 16}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Image Size:</span>
            <span className="font-medium">{trainingRun.configuration?.imgSize || 640}px</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Optimizer:</span>
            <span className="font-medium">{trainingRun.configuration?.optimizer || 'Adam'}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Augmentation:</span>
            <span className="font-medium">{formatAugmentationSummary(trainingRun.configuration?.augmentation)}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <span className="text-gray-600">Device:</span>
            <span className="font-medium">
              {formatDeviceLabel(trainingRun.configuration?.device, trainingRun.configuration?.compute)}
            </span>
          </div>
          {dataYaml && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
              <span className="text-gray-600">Dataset YAML:</span>
              <span className="font-medium text-right truncate" title={dataYaml}>
                {dataYaml}
              </span>
            </div>
          )}
          {trainingRun.started_at && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">Started:</span>
              <span className="font-medium">{new Date(trainingRun.started_at).toLocaleString()}</span>
            </div>
          )}
          {trainingRun.completed_at && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <span className="text-gray-600">Completed:</span>
              <span className="font-medium">{new Date(trainingRun.completed_at).toLocaleString()}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Training Logs */}
      <Card className="glass-effect border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            Training Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trainingRun.error_message ? (
            <Alert variant="destructive" className="border-red-300 bg-red-50">
              <AlertDescription className="text-red-800">{trainingRun.error_message}</AlertDescription>
            </Alert>
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">
              Logs are not streamed from the trainer service yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {(isTraining || isCanceling || isQueued) && (
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full" disabled={isCanceling || isCanceled}>
                <StopCircle className="w-4 h-4 mr-2" />
                {isCanceling ? 'Canceling...' : 'Cancel Training'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this training run?</AlertDialogTitle>
                <AlertDialogDescription>
                  {isQueued
                    ? "This will cancel the queued run before it starts."
                    : "This requests cancellation. The trainer will stop after the current epoch."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStopTraining} className="bg-red-600 hover:bg-red-700">
                  Cancel Training
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {isCompleted && (
          <Button
            onClick={() => navigate(createPageUrl(`AnnotationStudio?projectId=${project?.id}`))}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            <Target className="w-4 h-4 mr-2" />
            Test Your Model
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() => navigate(createPageUrl(`TrainingConfiguration?projectId=${project?.id}&stepId=${step?.id}`))}
          className="w-full"
        >
          Back to Configuration
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto"> {/* Increased max-width */}
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl(`TrainingConfiguration?projectId=${project?.id}&stepId=${step?.id}`))}
              className="border-0 glass-effect"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            {isCompleted ? (
              <>
                <CheckCircle className="w-8 h-8 text-green-600" />
                Training Complete!
              </>
            ) : isCanceled ? (
              <>
                <StopCircle className="w-8 h-8 text-red-600" />
                Training Canceled
              </>
            ) : isStopped ? (
              <>
                <StopCircle className="w-8 h-8 text-red-600" />
                Training Stopped
              </>
            ) : isFailed ? (
              <>
                <StopCircle className="w-8 h-8 text-red-600" />
                Training Failed
              </>
            ) : isQueued ? (
              <>
                <Clock className="w-8 h-8 text-amber-600" />
                Training Queued
              </>
            ) : isCanceling ? (
              <>
                <Clock className="w-8 h-8 text-amber-600" />
                Canceling Training
              </>
            ) : (
              <>
                <Rocket className="w-8 h-8 text-blue-600" />
                Training in Progress
              </>
            )}
              </h1>
              <p className="text-gray-600 mt-1">
                {project?.name} / {step?.title} / {trainingRun.run_name}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
            <Badge
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                isCompleted
                  ? 'bg-green-100 text-green-800'
                  : isCanceling
                    ? 'bg-amber-100 text-amber-800'
                    : isTraining
                      ? 'bg-blue-100 text-blue-800'
                    : isFailed
                      ? 'bg-red-100 text-red-800'
                      : isCanceled
                        ? 'bg-red-100 text-red-800'
                      : isStopped
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
              }`}
            >
              {trainingRun.status}
            </Badge>

            {isCompleted && (
              <div className="flex flex-wrap gap-2">
                {trainingRun.trained_model_url ? (
                  <Button asChild variant="outline" size="sm" className="glass-effect">
                    <a href={trainingRun.trained_model_url} target="_blank" rel="noopener noreferrer">
                      <Download className="w-4 h-4 mr-2" />
                      Export Model
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="glass-effect" disabled>
                    <Download className="w-4 h-4 mr-2" />
                    Export Model
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <Card className="glass-effect border-0 shadow-lg mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-gray-500">Current phase</p>
                <p className="text-sm font-semibold text-gray-900">{currentPhaseLabel}</p>
              </div>
              <div className="text-xs text-gray-500">Status: {trainingRun.status}</div>
            </div>
            <div className="mt-4">
              <TrainingTimeline currentIndex={phaseIndex} status={trainingRun.status} />
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs for Completed Models */}
        {isCompleted && hasResults ? (
          <Tabs defaultValue="results" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="results">Validation Results</TabsTrigger>
              <TabsTrigger value="training">Training Progress</TabsTrigger>
              <TabsTrigger value="logs">Training Logs</TabsTrigger>
            </TabsList>

            {/* Validation Results Tab */}
            <TabsContent value="results" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  icon={<Target />}
                  label="Mean Average Precision"
                  value={formatMetric(results.mAP)}
                  color="blue"
                />
                <MetricCard
                  icon={<TrendingUp />}
                  label="Precision"
                  value={formatMetric(results.precision)}
                  color="green"
                />
                <MetricCard
                  icon={<Activity />}
                  label="Recall"
                  value={formatMetric(results.recall)}
                  color="purple"
                />
                <MetricCard
                  icon={<CheckCircle />}
                  label="Artifacts"
                  value={`${artifacts.length}`}
                  color="green"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-gray-600" />
                      Training Artifacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {artifacts.length > 0 ? (
                      <div className="space-y-2">
                        {artifacts.map((artifact) => (
                        <div key={artifact.path || artifact.name} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded border border-gray-200 p-2">
                            <span className="text-sm text-gray-700">{artifact.name}</span>
                            <a href={artifact.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Download</a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No artifacts uploaded yet.</p>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                      Run Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-600">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span>Run Directory:</span>
                      <span className="font-medium text-gray-800">{results.run_dir || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span>Trained Model:</span>
                      {trainingRun.trained_model_url ? (
                        <a href={trainingRun.trained_model_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Download</a>
                      ) : (
                        <span className="font-medium text-gray-800">N/A</span>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <span>Worker:</span>
                      <span className="font-medium text-gray-800">{workerLabel}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ACTION: Review Predictions */}
              <Card className="glass-effect border-0 shadow-lg mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5 text-gray-600" />
                    Review Model Predictions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Dive deeper into your model&apos;s performance by visually inspecting its predictions on the validation dataset. This is the best way to understand where your model excels and where it needs improvement.
                  </p>
                  <Button
                      asChild
                      variant="default"
                      size="lg"
                      className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg"
                  >
                      <Link to={createPageUrl(`AnnotationReview?runId=${trainingRun.id}`)}>
                          <Target className="w-5 h-5 mr-2" />
                          Validate Model Performance
                      </Link>
                  </Button>
                </CardContent>
              </Card>

              {/* Model Performance Insights */}
              <Alert className="border-green-300 bg-green-50 mt-6">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <strong>Excellent Results!</strong> Your model metrics and artifacts are now available for download and review.
                </AlertDescription>
              </Alert>

              {/* Model Deployment & Actions */}
              {trainingRun?.status === 'completed' && (
                <Card className="glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Rocket className="w-5 h-5 text-blue-600" />
                      Model Deployment & Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {deploymentMessage && (
                      <Alert className={`mb-4 ${deploymentMessage.includes('failed') ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                        <AlertDescription className={deploymentMessage.includes('failed') ? 'text-red-700' : 'text-green-700'}>
                          {deploymentMessage}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex flex-wrap gap-3 mb-4">
                      {/* Deploy Model Button */}
                      {!trainingRun?.is_deployed && trainingRun?.deployment_status !== 'deploying' && (
                        <Button
                          onClick={() => handleDeployModel(trainingRun.id)}
                          disabled={isDeploying}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isDeploying ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Deploying...
                            </>
                          ) : (
                            <>
                              <Rocket className="w-4 h-4 mr-2" />
                              Deploy Model
                            </>
                          )}
                        </Button>
                      )}

                      {/* Deployment Status Badge */}
                      {(() => {
                        const statusConfig = getDeploymentStatusConfig(trainingRun?.deployment_status, trainingRun?.is_deployed);
                        if (statusConfig) {
                          return (
                            <div className="flex items-center gap-2">
                              {statusConfig.icon}
                              <Badge className={`${statusConfig.color} border-0`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Test Deployed Model Button */}
                      {trainingRun?.is_deployed && trainingRun?.deployment_status === 'deployed' && (
                        <Link to={createPageUrl(`ResultsAndAnalysis?modelId=${trainingRun.id}`)}>
                          <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                            <Target className="w-4 h-4 mr-2" />
                            Test Model
                          </Button>
                        </Link>
                      )}

                      <Link to={createPageUrl('Results')}>
                        <Button variant="outline">
                          <BarChart3 className="w-4 h-4 mr-2" />
                          Compare Runs
                        </Button>
                      </Link>
                    </div>

                    {/* Deployment Info */}
                    {trainingRun?.is_deployed && trainingRun?.deployment_url && (
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <h4 className="font-medium text-green-900 mb-2">Deployment Details</h4>
                        <div className="space-y-1 text-sm text-green-700">
                          <p><strong>Endpoint:</strong> <a href={trainingRun.deployment_url} target="_blank" rel="noopener noreferrer" className="underline">{trainingRun.deployment_url}</a></p>
                          <p><strong>Deployed:</strong> {new Date(trainingRun.deployment_date).toLocaleDateString()}</p>
                          <p><strong>Status:</strong> Ready for inference</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Training Progress Tab (existing content) */}
            <TabsContent value="training" className="mt-6">
              {trainingProgressContent}
            </TabsContent>

            {/* Training Logs Tab */}
            <TabsContent value="logs" className="mt-6">
              {trainingLogsContent}
            </TabsContent>
          </Tabs>
        ) : (
          // Original Training Progress View (for running/queued jobs)
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {trainingProgressContent}
            {trainingLogsContent}
          </div>
        )}
      </div>
    </div>
  );
}
