
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { StepImage } from '@/api/entities';
import { PredictedAnnotation } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Upload,
  Image as ImageIcon,
  Brain,
  Target,
  ArrowLeft,
  Search,
  CheckCircle,
  AlertTriangle,
  Play,
  Loader2,
  Zap,
  BarChart3,
  Rocket,
  ChevronRight,
  History,
  Database,
  Spline
} from 'lucide-react';
import { createPageUrl } from '@/utils';

const statusConfig = {
  running: { icon: <Rocket className="w-4 h-4 text-blue-500" />, color: "bg-blue-100 text-blue-800", label: "Running" },
  completed: { icon: <CheckCircle className="w-4 h-4 text-green-500" />, color: "bg-green-100 text-green-800", label: "Completed" },
  failed: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: "bg-red-100 text-red-800", label: "Failed" }
};

const deriveImageName = (imageUrl) => {
  if (!imageUrl) return "Unknown image";
  const last = imageUrl.split("?")[0].split("/").pop();
  return last || "Unknown image";
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizePredictions = (annotations) => {
  let normalized = annotations;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch (error) {
      normalized = [];
    }
  }
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    normalized = normalized.predictions ?? normalized.annotations ?? [];
  }
  if (!Array.isArray(normalized)) return [];
  return normalized.map((annotation, index) => {
    const confidence = toNumber(
      annotation?.confidence ??
      annotation?.score ??
      annotation?.conf ??
      annotation?.prob
    );
    const rawBox = annotation?.bbox ?? annotation?.box ?? annotation?.bounding_box;
    let bbox = null;
    if (Array.isArray(rawBox) && rawBox.length >= 4) {
      const [x, y, width, height] = rawBox;
      bbox = { x, y, width, height };
    } else if (rawBox && typeof rawBox === "object") {
      if (rawBox.x1 !== undefined && rawBox.y1 !== undefined && rawBox.x2 !== undefined && rawBox.y2 !== undefined) {
        bbox = {
          x: rawBox.x1,
          y: rawBox.y1,
          width: rawBox.x2 - rawBox.x1,
          height: rawBox.y2 - rawBox.y1,
        };
      } else if (rawBox.x !== undefined && rawBox.y !== undefined && rawBox.width !== undefined && rawBox.height !== undefined) {
        bbox = { x: rawBox.x, y: rawBox.y, width: rawBox.width, height: rawBox.height };
      } else if (rawBox.cx !== undefined && rawBox.cy !== undefined && rawBox.w !== undefined && rawBox.h !== undefined) {
        bbox = {
          x: rawBox.cx - rawBox.w / 2,
          y: rawBox.cy - rawBox.h / 2,
          width: rawBox.w,
          height: rawBox.h,
        };
      }
    }

    let area = null;
    if (bbox) {
      const width = toNumber(bbox.width);
      const height = toNumber(bbox.height);
      if (width !== null && height !== null) {
        area = width * height;
      }
    }
    return {
      id: annotation?.id ?? `${index}-${annotation?.class ?? annotation?.label ?? "pred"}`,
      class: annotation?.class ?? annotation?.label ?? "Unknown",
      confidence,
      bbox,
      area,
    };
  });
};

const averageConfidence = (predictions) => {
  if (!predictions.length) return null;
  const values = predictions
    .map((prediction) => toNumber(prediction.confidence))
    .filter((value) => value !== null);
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

export default function ResultsAndAnalysisPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inference-testing');
  const [deployedModels, setDeployedModels] = useState([]); // New state for deployed models
  const [dbImages, setDbImages] = useState([]);
  const [inferenceHistory, setInferenceHistory] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inferenceResults, setInferenceResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDeployedModels();
    loadImageDatabase();
    loadInferenceHistory();

    // Check if a specific model was selected from URL
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('modelId');
    if (modelId) {
      setSelectedModel(modelId);
    }
  }, []);

  const loadDeployedModels = async () => {
    try {
      const allRuns = await TrainingRun.list();
      const deployed = allRuns.filter(run =>
        run.is_deployed && run.deployment_status === 'deployed'
      );
      setDeployedModels(deployed);
    } catch (error) {
      console.error('Error loading deployed models:', error);
    }
  };

  const loadImageDatabase = async () => {
    try {
      const [images, steps, projects] = await Promise.all([
        StepImage.list("-created_date"),
        SOPStep.list(),
        Project.list(),
      ]);

      const stepsById = new Map(steps.map((step) => [step.id, step]));
      const projectsById = new Map(projects.map((project) => [project.id, project]));

      const normalized = images.map((image) => {
        const step = stepsById.get(image.step_id);
        const project = step ? projectsById.get(step.project_id) : null;
        const tags = [];
        if (image.image_group) tags.push(image.image_group);
        if (image.processing_status) tags.push(image.processing_status);
        return {
          id: image.id,
          name: image.image_name || deriveImageName(image.display_url || image.image_url),
          url: image.display_url || image.image_url,
          thumbnail: image.thumbnail_url || image.display_url || image.image_url,
          project: project?.name || "Unknown project",
          date: image.created_date,
          tags,
        };
      });

      setDbImages(normalized);
    } catch (error) {
      console.error('Error loading image database:', error);
    }
  };

  const loadInferenceHistory = async () => {
    try {
      const [predictions, runs, images, steps, projects] = await Promise.all([
        PredictedAnnotation.list("-created_date"),
        TrainingRun.list(),
        StepImage.list(),
        SOPStep.list(),
        Project.list(),
      ]);

      const runsById = new Map(runs.map((run) => [run.id, run]));
      const imagesById = new Map(images.map((image) => [image.id, image]));
      const stepsById = new Map(steps.map((step) => [step.id, step]));
      const projectsById = new Map(projects.map((project) => [project.id, project]));

      const normalized = predictions.map((prediction) => {
        const run = runsById.get(prediction.run_id);
        const image = imagesById.get(prediction.step_image_id);
        const step = image ? stepsById.get(image.step_id) : null;
        const project = step ? projectsById.get(step.project_id) : null;
        const normalizedPredictions = normalizePredictions(prediction.annotations);
        const avgConfidence = averageConfidence(normalizedPredictions);

        return {
          id: prediction.id,
          run_name: run?.run_name || "Inference run",
          model_name: run?.base_model || run?.run_name || "Unknown model",
          project_name: project?.name || "Unknown project",
          image_name: image?.image_name || deriveImageName(image?.display_url || image?.image_url),
          status: run?.status || "completed",
          created_date: prediction.created_date,
          created_by: run?.created_by || "system",
          results: normalizedPredictions.length
            ? {
              total_predictions: normalizedPredictions.length,
              avg_confidence: avgConfidence ?? 0,
              logic_status: null,
              compliance_score: null,
            }
            : null,
        };
      });

      setInferenceHistory(normalized);
    } catch (error) {
      console.error('Error loading inference history:', error);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(null);
      setUploadFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setInferenceResults(null);
    }
  };

  const handleRunInference = async () => {
    if (!selectedModel || !selectedImage) {
      return;
    }

    setIsProcessing(true);
    setInferenceResults(null);

    try {
      const predictions = await PredictedAnnotation.filter(
        { run_id: selectedModel, step_image_id: selectedImage.id },
        "-created_date"
      );
      const latest = predictions[0];
      if (!latest) {
        setInferenceResults({
          status: "missing",
          message: "No stored inference results for this model and image yet.",
        });
        setIsProcessing(false);
        return;
      }

      const normalizedPredictions = normalizePredictions(latest.annotations);
      setInferenceResults({
        status: "completed",
        timestamp: latest.created_date,
        model_used: selectedModel,
        image_analyzed: selectedImage?.name,
        processing_time: null,
        predictions: normalizedPredictions,
        logic_evaluation: null,
        raw_response: latest.annotations,
      });
    } catch (error) {
      console.error("Error loading inference results:", error);
      setInferenceResults({
        status: "missing",
        message: "Unable to load inference results from Supabase.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredHistory = inferenceHistory.filter(item => {
    if (historyFilter !== 'all' && item.status !== historyFilter) return false;
    if (searchQuery) {
      const runName = item.run_name || "";
      if (!runName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                Results & Analysis Hub
              </h1>
              <p className="text-gray-600 mt-1">Test your models and review inference history</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-white p-1 rounded-lg shadow-sm">
            <TabsTrigger value="inference-testing" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Zap className="inline-block w-4 h-4 mr-2" /> Live Model Testing
            </TabsTrigger>
            <TabsTrigger value="inference-history" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <History className="inline-block w-4 h-4 mr-2" /> Inference History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inference-testing" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
              {/* Left Panel - Database Images */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Image Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {dbImages.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-8">
                          No images found in Supabase yet.
                        </div>
                      )}
                      {dbImages.map((image) => (
                        <div
                          key={image.id}
                          onClick={() => {
                            setSelectedImage(image);
                            setUploadFile(null);
                            setUploadPreview(null);
                            setInferenceResults(null);
                          }}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedImage?.id === image.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {image.thumbnail ? (
                              <img
                                src={image.thumbnail}
                                alt={image.name}
                                className="w-12 h-12 rounded object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                <ImageIcon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{image.name}</p>
                              <p className="text-xs text-gray-500">{image.project}</p>
                              {image.tags.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {image.tags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Center Panel - Image Display */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    Image Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-[600px] bg-gray-50 rounded-lg flex items-center justify-center">
                    {selectedImage ? (
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : uploadPreview ? (
                      <img
                        src={uploadPreview}
                        alt="Upload preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p>Select an image from database or upload new one</p>
                      </div>
                    )}

                    {/* Inference Results Overlay */}
                    {inferenceResults?.predictions && (
                      <>
                        {inferenceResults.predictions.map((prediction) => (
                          prediction.bbox ? (
                            <div
                              key={prediction.id}
                              className="absolute border-2 border-red-500 bg-red-500/10"
                              style={{
                                left: `${prediction.bbox.x}px`,
                                top: `${prediction.bbox.y}px`,
                                width: `${prediction.bbox.width}px`,
                                height: `${prediction.bbox.height}px`,
                              }}
                            >
                              <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 text-xs rounded">
                                {prediction.class}
                                {prediction.confidence !== null ? ` (${(prediction.confidence * 100).toFixed(1)}%)` : ""}
                              </div>
                            </div>
                          ) : null
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right Panel - Upload & Results */}
              <div className="space-y-6">
                {/* Upload Area */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-blue-600" />
                      Upload New Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 border-dashed"
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to upload image</p>
                      </div>
                    </Button>
                    {uploadFile && (
                      <p className="mt-3 text-xs text-gray-500">
                        Selected upload: {uploadFile.name}. Uploads are not yet linked to inference results.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Model Selection & Run */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      Deployed Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a deployed model" />
                      </SelectTrigger>
                      <SelectContent>
                        {deployedModels.length === 0 ? (
                          <SelectItem value={null} disabled>
                            No deployed models available
                          </SelectItem>
                        ) : (
                          deployedModels.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Deployed
                                </Badge>
                                {model.run_name}
                                {model.results?.mAP && (
                                  <span className="text-gray-500 text-xs">
                                    ({(model.results.mAP * 100).toFixed(1)}% mAP)
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {deployedModels.length === 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No models are currently deployed. Train and deploy a model from the Training Configuration page first.
                          <Link to={createPageUrl('TrainingConfiguration')} className="block mt-2">
                            <Button variant="outline" size="sm">
                              <Spline className="w-4 h-4 mr-2" />
                              Go to Training
                            </Button>
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleRunInference}
                      disabled={!selectedModel || !selectedImage || isProcessing || deployedModels.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Inference
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Results */}
                {inferenceResults && (
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {inferenceResults.status === "missing" && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{inferenceResults.message}</AlertDescription>
                        </Alert>
                      )}

                      {/* Logic Status */}
                      {inferenceResults.logic_evaluation && (
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="font-medium text-green-800">
                              Logic Status: {inferenceResults.logic_evaluation.status}
                            </span>
                          </div>
                          {typeof inferenceResults.logic_evaluation.compliance_score === "number" && (
                            <Badge className="bg-green-100 text-green-800">
                              {(inferenceResults.logic_evaluation.compliance_score * 100).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Predictions List */}
                      {inferenceResults.predictions && (
                        <div>
                          <h4 className="font-medium mb-2">Detections ({inferenceResults.predictions.length})</h4>
                          <div className="space-y-2">
                            {inferenceResults.predictions.map((pred) => (
                              <div key={pred.id} className="p-2 bg-gray-50 rounded text-sm">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium">{pred.class}</span>
                                  {pred.confidence !== null && (
                                    <Badge variant="outline">
                                      {(pred.confidence * 100).toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                                {pred.bbox && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Location: ({pred.bbox.x}, {pred.bbox.y}) |
                                    Size: {pred.bbox.width}x{pred.bbox.height} |
                                    Area: {pred.area ?? "N/A"} px
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw JSON */}
                      {inferenceResults.raw_response && (
                        <details className="text-xs">
                          <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                            View Raw JSON Response
                          </summary>
                          <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-40">
                            {JSON.stringify(inferenceResults.raw_response, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inference-history" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Inference History
                </CardTitle>
                <CardDescription>Review past inference runs and results</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search inference runs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* History Table */}
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run Name</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Image</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Results</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item) => {
                        const status = statusConfig[item.status] || statusConfig.completed;
                        const logicStatus = item.results?.logic_status || "N/A";
                        const logicBadgeClass =
                          logicStatus === "PASS"
                            ? "bg-green-100 text-green-800"
                            : logicStatus === "FAIL"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-700";
                        const avgConfidence = item.results?.avg_confidence;
                        const createdAt = item.created_date ? new Date(item.created_date).toLocaleDateString() : "N/A";
                        const createdBy = item.created_by ? item.created_by.split("@")[0] : "system";

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.run_name}</TableCell>
                            <TableCell>{item.model_name}</TableCell>
                            <TableCell>{item.project_name}</TableCell>
                            <TableCell>{item.image_name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {status.icon}
                                <Badge className={status.color}>
                                  {status.label}
                                </Badge>
                              </div>
                            </TableCell>
                            <TableCell>{createdAt}</TableCell>
                            <TableCell>{createdBy}</TableCell>
                            <TableCell>
                              {item.results ? (
                                <div className="text-sm">
                                  <div>Objects: {item.results.total_predictions}</div>
                                  <div>
                                    Confidence: {typeof avgConfidence === "number" ? `${(avgConfidence * 100).toFixed(1)}%` : "N/A"}
                                  </div>
                                  <Badge className={logicBadgeClass}>
                                    {logicStatus}
                                  </Badge>
                                </div>
                              ) : (
                                <span className="text-gray-400">N/A</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                <ChevronRight className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

