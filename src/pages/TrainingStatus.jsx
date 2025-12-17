
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Added Link import
import { motion, AnimatePresence } from 'framer-motion';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Added Tabs imports
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
  Zap,
  Brain,
  Target,
  TrendingUp,
  Clock,
  Cpu,
  Activity,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Rocket,
  Coffee,
  Code,
  BarChart3,
  StopCircle,
  Download, // Added icon
  Share2,   // Added icon
  Eye,      // Added icon
  TrendingDown, // Added icon
  Loader2, // Added icon for deployment
  XCircle // Added icon for deployment failure
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'; // Added recharts imports

const trainingTips = [
  "💡 Did you know? Your model learns by looking at thousands of examples!",
  "🚀 Neural networks are inspired by how our brains work!",
  "⚡ Each epoch means the model has seen your entire dataset once.",
  "🎯 The loss going down means your model is getting smarter!",
  "🧠 Your model is building patterns from your annotations right now.",
  "📊 Lower validation loss = better performance on new images!",
  "🔥 GPU training can be 100x faster than CPU training!",
  "✨ Transfer learning helps your model learn faster by starting with pre-trained knowledge."
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

// Mock validation data - in real implementation this would come from the training results
const generateMockValidationResults = () => {
  const classes = ['Button', 'Input Field', 'Label', 'Dropdown', 'Checkbox'];

  // Training curves data
  const trainingCurves = Array.from({ length: 100 }, (_, i) => ({
    epoch: i + 1,
    trainLoss: 0.8 * Math.exp(-i * 0.05) + Math.random() * 0.1,
    valLoss: 0.85 * Math.exp(-i * 0.045) + Math.random() * 0.12,
    trainAcc: 1 - (0.8 * Math.exp(-i * 0.05)) + Math.random() * 0.05,
    valAcc: 1 - (0.85 * Math.exp(-i * 0.045)) + Math.random() * 0.06,
  }));

  // Confusion Matrix data
  const confusionMatrix = classes.map(actualClass =>
    classes.map(predictedClass => ({
      actual: actualClass,
      predicted: predictedClass,
      count: actualClass === predictedClass
        ? Math.floor(Math.random() * 50) + 80  // True positives (higher)
        : Math.floor(Math.random() * 15) + 2   // False positives/negatives (lower)
    }))
  ).flat();

  // Per-class metrics
  const classMetrics = classes.map(cls => ({
    class: cls,
    precision: parseFloat((0.75 + Math.random() * 0.2).toFixed(3)),
    recall: parseFloat((0.70 + Math.random() * 0.25).toFixed(3)),
    f1Score: parseFloat((0.72 + Math.random() * 0.23).toFixed(3)),
    support: Math.floor(Math.random() * 200) + 50
  }));

  return {
    trainingCurves,
    confusionMatrix,
    classMetrics,
    overallMetrics: {
      mAP: 0.847,
      precision: 0.823,
      recall: 0.856,
      f1Score: 0.839,
      accuracy: 0.891
    }
  };
};

const ConfusionMatrixHeatmap = ({ data, classes }) => {
  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-max grid" style={{gridTemplateColumns: `auto repeat(${classes.length}, minmax(0, 1fr))`}}>
        <div className="col-start-2 col-span-full text-center text-xs text-gray-500 mb-2">Predicted</div>
        <div className="row-start-2 row-span-full text-center text-xs text-gray-500 transform -rotate-90 origin-bottom-left whitespace-nowrap">Actual</div>

        <div className="col-start-1 row-start-1"></div> {/* Empty top-left corner */}
        {classes.map((cls, idx) => (
          <div key={`pred-${cls}`} className="text-center font-medium text-gray-600 p-1 truncate" style={{gridColumn: idx + 2}}>{cls}</div>
        ))}
        {classes.map((actualClass, i) => (
          <React.Fragment key={`row-${actualClass}`}>
            <div className="text-right font-medium text-gray-600 p-1 truncate" style={{gridColumn: 1, gridRow: i + 2}}>{actualClass}</div>
            {classes.map((predictedClass, j) => {
              const cell = data.find(d => d.actual === actualClass && d.predicted === predictedClass);
              const intensity = cell ? cell.count / maxCount : 0;
              const isCorrect = actualClass === predictedClass;

              const bgColor = isCorrect
                ? `bg-green-${Math.min(900, Math.floor(intensity * 400) + 100)}`
                : `bg-red-${Math.min(900, Math.floor(intensity * 300) + 100)}`;
              const textColor = isCorrect
                ? `text-green-${Math.min(900, Math.floor(intensity * 400) + 100)}`
                : `text-red-${Math.min(900, Math.floor(intensity * 300) + 100)}`;

              return (
                <div
                  key={`${actualClass}-${predictedClass}`}
                  className={`aspect-square flex items-center justify-center text-xs font-medium rounded ${bgColor} ${cell?.count > maxCount * 0.7 ? 'text-white' : 'text-gray-900'}`}
                  title={`Actual: ${actualClass}, Predicted: ${predictedClass}, Count: ${cell?.count || 0}`}
                  style={{gridColumn: j + 2, gridRow: i + 2}}
                >
                  {cell?.count || 0}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};


export default function TrainingStatusPage() {
  const navigate = useNavigate();
  const [trainingRun, setTrainingRun] = useState(null);
  const [project, setProject] = useState(null);
  const [step, setStep] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [logs, setLogs] = useState([]);
  const [currentTip, setCurrentTip] = useState(0);
  const [validationResults, setValidationResults] = useState(null); // New state for validation results
  const [metrics, setMetrics] = useState({
    loss: 0.5,
    accuracy: 0.0,
    learningRate: 0.001,
    timeRemaining: "Calculating..."
  });
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentMessage, setDeploymentMessage] = useState('');

  const loadTrainingData = async (runId) => {
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

        // Initialize progress based on status
        if (run.status === 'completed' || run.status === 'stopped') {
          setProgress(100); // Or the last recorded progress if available
          setCurrentEpoch(run.configuration?.epochs || 100); // Or last recorded epoch
        }
      }
    } catch (error) {
      console.error("Error loading training data:", error);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const runId = urlParams.get('runId');
    if (runId) {
      loadTrainingData(runId);
    } else {
      navigate(createPageUrl('Projects'));
    }
  }, []);

  // Rotate tips every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % trainingTips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Simulate training progress
  useEffect(() => {
    // Only run simulation if trainingRun is available and its status is 'running'
    if (!trainingRun || trainingRun.status !== 'running') return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = Math.min(prev + (Math.random() * 2), 100);

        // Update epoch based on progress
        const totalEpochs = trainingRun.configuration?.epochs || 100;
        const newEpoch = Math.floor((newProgress / 100) * totalEpochs);
        setCurrentEpoch(newEpoch);

        // Add random log entries
        if (Math.random() < 0.3) {
          const logMessages = [
            `Epoch ${newEpoch}/${totalEpochs}: loss: ${(0.8 - newProgress * 0.007).toFixed(4)}`,
            `Validation mAP improved to ${(newProgress * 0.008).toFixed(3)}`,
            `Learning rate: ${(0.001 * (1 - newProgress * 0.005)).toFixed(6)}`,
            `Processing batch ${Math.floor(Math.random() * 50)}...`,
            `GPU utilization: ${Math.floor(85 + Math.random() * 10)}%`
          ];

          setLogs(prev => [
            ...prev.slice(-20), // Keep last 20 logs
            {
              id: Date.now(),
              message: logMessages[Math.floor(Math.random() * logMessages.length)],
              timestamp: new Date()
            }
          ]);
        }

        // Update metrics
        setMetrics(prev => ({
          loss: Math.max(0.1, 0.8 - newProgress * 0.007),
          accuracy: newProgress * 0.008,
          learningRate: 0.001 * (1 - newProgress * 0.005),
          timeRemaining: newProgress > 95 ? "Almost done!" : `${Math.floor((100 - newProgress) * 2)} minutes`
        }));

        if (newProgress >= 100) {
          // Training complete
          setTrainingRun(prev => ({ ...prev, status: 'completed' }));
          setLogs(prev => [...prev, {
            id: Date.now(),
            message: "🎉 Training completed successfully!",
            timestamp: new Date()
          }]);
        }

        return newProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [trainingRun]);

  const handleStopTraining = async () => {
    if (!trainingRun) return;
    try {
        await TrainingRun.update(trainingRun.id, { status: 'stopped' });
        setTrainingRun(prev => ({ ...prev, status: 'stopped' }));
    } catch (error) {
        console.error("Failed to stop training:", error);
        // Optionally show an error alert to the user
    }
  };

  const handleDeployModel = async (runId) => {
    setIsDeploying(true);
    setDeploymentMessage('');

    try {
      // Update deployment status to "deploying"
      await TrainingRun.update(runId, {
        deployment_status: 'deploying'
      });

      // Simulate deployment process (in real app, this would be an API call)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update to deployed status
      await TrainingRun.update(runId, {
        is_deployed: true,
        deployment_status: 'deployed',
        deployment_date: new Date().toISOString(),
        deployment_url: `https://api.saturos.ai/models/${runId}/predict`
      });

      setDeploymentMessage(`Model "${trainingRun.run_name}" deployed successfully!`);

      // Refresh the run data
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

  // Generate mock validation results when training is complete
  useEffect(() => {
    if (trainingRun?.status === 'completed' && !validationResults) {
      setValidationResults(generateMockValidationResults());
    }
  }, [trainingRun?.status, validationResults]); // Added validationResults to dependency array


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
  const isTraining = trainingRun.status === 'running';
  const isCompleted = trainingRun.status === 'completed';
  const isStopped = trainingRun.status === 'stopped';

  // Content for the left column / Training Progress tab
  const trainingProgressContent = (
    <div className="lg:col-span-2 space-y-6">
      {/* Training Animation Card */}
      <Card className="glass-effect border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Your AI Model is Learning
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <TrainingAnimation isTraining={isTraining} progress={progress} />

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Training Progress</span>
                <span>{progress.toFixed(1)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{currentEpoch}</p>
                <p className="text-sm text-gray-600">Current Epoch</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">{trainingRun.configuration?.epochs || 100}</p>
                <p className="text-sm text-gray-600">Total Epochs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          icon={<TrendingUp />}
          label="Training Loss"
          value={metrics.loss.toFixed(4)}
          trend={-5}
          color="green"
        />
        <MetricCard
          icon={<Target />}
          label="Accuracy (mAP)"
          value={metrics.accuracy.toFixed(3)}
          trend={8}
          color="blue"
        />
        <MetricCard
          icon={<Activity />}
          label="Learning Rate"
          value={metrics.learningRate.toFixed(6)}
          color="purple"
        />
        <MetricCard
          icon={<Clock />}
          label="Time Remaining"
          value={metrics.timeRemaining}
          color="orange"
        />
      </div>

      {/* Fun Tip Card */}
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

      {/* Completion/Stopped Alert */}
      {isCompleted && (
        <Alert className="border-green-300 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            🎉 Congratulations! Your model has been trained successfully. You can now use it to make predictions on new images.
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
          <div className="flex justify-between">
            <span className="text-gray-600">Base Model:</span>
            <Badge variant="outline">{trainingRun.base_model}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Batch Size:</span>
            <span className="font-medium">{trainingRun.configuration?.batchSize || 16}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Image Size:</span>
            <span className="font-medium">{trainingRun.configuration?.imgSize || 640}px</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Optimizer:</span>
            <span className="font-medium">{trainingRun.configuration?.optimizer || 'Adam'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Training Logs */}
      <Card className="glass-effect border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            Live Training Logs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <div className="space-y-2">
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-mono bg-gray-900 text-green-400 p-2 rounded"
                >
                  <span className="text-gray-500">
                    [{log.timestamp.toLocaleTimeString()}]
                  </span>{' '}
                  {log.message}
                </motion.div>
              ))}
              {logs.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">
                  Training logs will appear here...
                </p>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="space-y-3">
        {isTraining && (
           <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <StopCircle className="w-4 h-4 mr-2" />
                Stop Training
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to stop training?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will halt the current training process. The progress will be saved, but the model will not be completed. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleStopTraining} className="bg-red-600 hover:bg-red-700">Stop Training</AlertDialogAction>
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

  const mockClasses = ['Button', 'Input Field', 'Label', 'Dropdown', 'Checkbox'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto"> {/* Increased max-width */}
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
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
                ) : isStopped ? (
                  <>
                    <StopCircle className="w-8 h-8 text-red-600" />
                    Training Stopped
                  </>
                ) : (
                  <>
                    <Rocket className="w-8 h-8 text-blue-600" />
                    Training in Progress
                  </>
                )}
              </h1>
              <p className="text-gray-600 mt-1">
                {project?.name} • {step?.title} • {trainingRun.run_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              className={`px-4 py-2 text-sm font-semibold capitalize ${
                isCompleted
                  ? 'bg-green-100 text-green-800'
                  : isTraining
                    ? 'bg-blue-100 text-blue-800'
                  : isStopped
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
              }`}
            >
              {trainingRun.status}
            </Badge>

            {isCompleted && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="glass-effect">
                  <Download className="w-4 h-4 mr-2" />
                  Export Model
                </Button>
                <Button variant="outline" size="sm" className="glass-effect">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Results
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Tabs for Completed Models */}
        {isCompleted && validationResults ? (
          <Tabs defaultValue="results" className="w-full">
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-3 lg:grid-cols-3">
              <TabsTrigger value="results">Validation Results</TabsTrigger>
              <TabsTrigger value="training">Training Progress</TabsTrigger>
              <TabsTrigger value="logs">Training Logs</TabsTrigger>
            </TabsList>

            {/* Validation Results Tab */}
            <TabsContent value="results" className="space-y-6 mt-6">
              {/* Overall Performance Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard
                  icon={<Target />}
                  label="Mean Average Precision"
                  value={validationResults.overallMetrics.mAP.toFixed(3)}
                  color="blue"
                />
                <MetricCard
                  icon={<TrendingUp />}
                  label="Precision"
                  value={validationResults.overallMetrics.precision.toFixed(3)}
                  color="green"
                />
                <MetricCard
                  icon={<Activity />}
                  label="Recall"
                  value={validationResults.overallMetrics.recall.toFixed(3)}
                  color="purple"
                />
                <MetricCard
                  icon={<BarChart3 />}
                  label="F1-Score"
                  value={validationResults.overallMetrics.f1Score.toFixed(3)}
                  color="orange"
                />
                <MetricCard
                  icon={<CheckCircle />}
                  label="Accuracy"
                  value={`${(validationResults.overallMetrics.accuracy * 100).toFixed(1)}%`}
                  color="green"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Confusion Matrix */}
                <Card className="glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-gray-600" />
                      Confusion Matrix
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center">
                    <ConfusionMatrixHeatmap
                      data={validationResults.confusionMatrix}
                      classes={mockClasses}
                    />
                    <p className="text-xs text-gray-500 mt-4 text-center">
                      Darker colors indicate higher prediction counts. Green = correct predictions, Red = incorrect.
                    </p>
                  </CardContent>
                </Card>

                {/* Per-Class Performance */}
                <Card className="glass-effect border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-gray-600" />
                      Per-Class Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={validationResults.classMetrics}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="class" angle={-45} textAnchor="end" height={80} interval={0} fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip formatter={(value) => value.toFixed(3)} />
                          <Legend iconType="rect" wrapperStyle={{paddingTop: '10px'}} />
                          <Bar dataKey="precision" fill="#3b82f6" name="Precision" />
                          <Bar dataKey="recall" fill="#10b981" name="Recall" />
                          <Bar dataKey="f1Score" fill="#f59e0b" name="F1-Score" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Training Loss Curves */}
                <Card className="glass-effect border-0 shadow-lg lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-gray-600" />
                      Training & Validation Curves
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={validationResults.trainingCurves}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="epoch" fontSize={10} />
                          <YAxis fontSize={10} />
                          <Tooltip formatter={(value) => value.toFixed(4)} />
                          <Legend iconType="rect" wrapperStyle={{paddingTop: '10px'}} />
                          <Line type="monotone" dataKey="trainLoss" stroke="#ef4444" name="Training Loss" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="valLoss" stroke="#f97316" name="Validation Loss" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="trainAcc" stroke="#3b82f6" name="Training Accuracy" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="valAcc" stroke="#10b981" name="Validation Accuracy" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
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
                    Dive deeper into your model's performance by visually inspecting its predictions on the validation dataset. This is the best way to understand where your model excels and where it needs improvement.
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
                  <strong>Excellent Results!</strong> Your model achieved high precision ({(validationResults.overallMetrics.precision * 100).toFixed(1)}%)
                  and recall ({(validationResults.overallMetrics.recall * 100).toFixed(1)}%).
                  The validation curves show good convergence without significant overfitting.
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

                      {/* Existing action buttons */}
                      <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export Model
                      </Button>

                      <Button variant="outline">
                        <Share2 className="w-4 h-4 mr-2" />
                        Share Results
                      </Button>
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
