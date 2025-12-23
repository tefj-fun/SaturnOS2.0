
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { StepImage } from '@/api/entities';
import { PredictedAnnotation } from '@/api/entities';
import { InferenceWorker } from '@/api/entities';
import { createSignedImageUrl, getStoragePathFromUrl } from '@/api/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Cpu,
  AlertTriangle,
  Play,
  Loader2,
  WifiOff,
  RefreshCw,
  Info,
  BarChart3,
  Rocket,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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

const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";
const INFERENCE_HEARTBEAT_TIMEOUT_MS = 60000;
const THUMBNAIL_SIZE = 96;
const THUMBNAIL_TRANSFORM = { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, resize: "cover" };
const THUMBNAIL_PREFETCH_LIMIT = 80;
const THUMBNAIL_PREFETCH_BATCH = 20;

const deriveImageName = (imageUrl) => {
  if (!imageUrl) return "Unknown image";
  const last = imageUrl.split("?")[0].split("/").pop();
  return last || "Unknown image";
};

const toNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

const normalizePredictions = (annotations) => {
  let normalized = annotations;
  if (typeof normalized === "string") {
    try {
      normalized = JSON.parse(normalized);
    } catch {
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

const isNormalizedBox = (bbox) => {
  if (!bbox) return false;
  const values = [bbox.x, bbox.y, bbox.width, bbox.height]
    .map((value) => toNumber(value))
    .filter((value) => value !== null);
  if (values.length !== 4) return false;
  return values.every((value) => value >= 0 && value <= 1);
};

const toPixelBox = (bbox, naturalWidth, naturalHeight) => {
  if (!bbox || !naturalWidth || !naturalHeight) return null;
  if (isNormalizedBox(bbox)) {
    return {
      x: bbox.x * naturalWidth,
      y: bbox.y * naturalHeight,
      width: bbox.width * naturalWidth,
      height: bbox.height * naturalHeight,
    };
  }
  return bbox;
};

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const resolveSignedUrl = async (url, { transform } = {}) => {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  const trySignedUrl = async (bucket) => {
    const path = getStoragePathFromUrl(url, bucket);
    if (!path) return null;
    try {
      const signed = await createSignedImageUrl(bucket, path, { expiresIn: 3600, transform });
      return signed || url;
    } catch {
      return url;
    }
  };

  const stepImageUrl = await trySignedUrl(STEP_IMAGES_BUCKET);
  if (stepImageUrl) return stepImageUrl;
  const datasetUrl = await trySignedUrl(DATASET_BUCKET);
  return datasetUrl || url;
};

const buildInferenceUrl = (endpoint, saveResults) => {
  if (!endpoint) return "";
  if (!saveResults) return endpoint;
  try {
    const url = new URL(endpoint, window.location.origin);
    url.searchParams.set("save", "1");
    return url.toString();
  } catch {
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${separator}save=1`;
  }
};

export default function ResultsAndAnalysisPage() {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);
  const [deployedModels, setDeployedModels] = useState([]);
  const [dbImages, setDbImages] = useState([]);
  const [isImagesLoading, setIsImagesLoading] = useState(true);
  const [inferenceHistory, setInferenceHistory] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inferenceStatus, setInferenceStatus] = useState({
    state: "checking",
    workersOnline: 0,
    lastCheckedAt: null,
    activeWorkers: [],
    isSupported: true,
  });
  const [showInferenceAdvanced, setShowInferenceAdvanced] = useState(false);
  const [inferenceResults, setInferenceResults] = useState(null);
  const [hoveredPredictionId, setHoveredPredictionId] = useState(null);
  const [imageSearch, setImageSearch] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageMetrics, setImageMetrics] = useState(null);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const fileInputRef = useRef(null);
  const imageContainerRef = useRef(null);
  const imageRef = useRef(null);

  const loadInferenceStatus = useCallback(async (force = false) => {
    if (!force && !inferenceStatus.isSupported) return;
    try {
      const workers = await InferenceWorker.list('-last_seen');
      const now = Date.now();
      const activeWorkers = (workers || []).filter((worker) => {
        if (!worker?.last_seen) return false;
        const lastSeen = new Date(worker.last_seen).getTime();
        return Number.isFinite(lastSeen) && (now - lastSeen) <= INFERENCE_HEARTBEAT_TIMEOUT_MS;
      });
      const workersOnline = activeWorkers.length;
      const state = workersOnline === 0 ? 'offline' : 'idle';
      setInferenceStatus({
        state,
        workersOnline,
        lastCheckedAt: new Date().toISOString(),
        activeWorkers,
        isSupported: true,
      });
    } catch (error) {
      if (error?.code === "PGRST205") {
        setInferenceStatus({
          state: 'unsupported',
          workersOnline: 0,
          lastCheckedAt: new Date().toISOString(),
          activeWorkers: [],
          isSupported: false,
        });
        return;
      }
      console.error('Error loading inference worker status:', error);
      setInferenceStatus({
        state: 'unknown',
        workersOnline: 0,
        lastCheckedAt: new Date().toISOString(),
        activeWorkers: [],
        isSupported: true,
      });
    }
  }, [inferenceStatus.isSupported]);

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

  useEffect(() => {
    loadInferenceStatus();
    if (!inferenceStatus.isSupported) return undefined;
    const interval = setInterval(loadInferenceStatus, 15000);
    return () => clearInterval(interval);
  }, [loadInferenceStatus, inferenceStatus.isSupported]);

  useEffect(() => {
    setZoomLevel(1);
    setHoveredPredictionId(null);
  }, [selectedImage, uploadPreview]);

  useEffect(() => {
    if (!imageContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateImageMetrics();
    });
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [imageContainerRef, selectedImage, uploadPreview]);

  const updateImageMetrics = () => {
    const container = imageContainerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const fitScale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
    if (!Number.isFinite(fitScale)) return;
    setImageMetrics({
      containerWidth,
      containerHeight,
      naturalWidth,
      naturalHeight,
      fitScale,
    });
  };

  const prefetchImageThumbnails = async (images) => {
    if (!Array.isArray(images) || images.length === 0) return;
    const targets = images.slice(0, THUMBNAIL_PREFETCH_LIMIT);
    for (let i = 0; i < targets.length; i += THUMBNAIL_PREFETCH_BATCH) {
      const batch = targets.slice(i, i + THUMBNAIL_PREFETCH_BATCH);
      try {
        const signedBatch = await Promise.all(batch.map(async (image) => {
          const rawThumbnail = image.rawThumbnail || image.thumbnail || image.rawUrl || image.url;
          if (!rawThumbnail) return null;
          const signedThumbnail = await resolveSignedUrl(rawThumbnail, { transform: THUMBNAIL_TRANSFORM });
          return { id: image.id, thumbnail: signedThumbnail || rawThumbnail };
        }));
        const signedById = new Map(
          signedBatch.filter(Boolean).map((entry) => [entry.id, entry.thumbnail])
        );
        if (signedById.size === 0) continue;
        setDbImages((prev) => prev.map((item) => {
          const signedThumbnail = signedById.get(item.id);
          return signedThumbnail ? { ...item, thumbnail: signedThumbnail } : item;
        }));
        setSelectedImage((prev) => {
          if (!prev) return prev;
          const signedThumbnail = signedById.get(prev.id);
          return signedThumbnail ? { ...prev, thumbnail: signedThumbnail } : prev;
        });
      } catch (error) {
        console.warn("Failed to prefetch image thumbnails:", error);
      }
    }
  };

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
    setIsImagesLoading(true);
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
        const fallbackUrl = image.display_url || image.image_url || image.thumbnail_url || "";
        const thumbnailFallback = image.thumbnail_url || image.display_url || image.image_url || "";
        return {
          id: image.id,
          name: image.image_name || deriveImageName(image.display_url || image.image_url),
          url: fallbackUrl,
          thumbnail: thumbnailFallback,
          rawUrl: fallbackUrl,
          rawThumbnail: thumbnailFallback,
          isSigned: false,
          project: project?.name || "Unknown project",
          date: image.created_date,
          tags,
        };
      });

      setDbImages(normalized);
      prefetchImageThumbnails(normalized);
    } catch (error) {
      console.error('Error loading image database:', error);
    } finally {
      setIsImagesLoading(false);
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
        const hasStepImage = Boolean(prediction.step_image_id);
        const imageName = image
          ? (image.image_name || deriveImageName(image.display_url || image.image_url))
          : (hasStepImage ? "Unknown image" : "Uploaded image");
        const projectName = project?.name || (hasStepImage ? "Unknown project" : "Uploaded image");

        return {
          id: prediction.id,
          run_name: run?.run_name || "Inference run",
          model_name: run?.base_model || run?.run_name || "Unknown model",
          project_name: projectName,
          image_name: imageName,
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

  const ensureSignedImage = async (image) => {
    if (!image) return null;
    if (image.isSigned) return image;
    const rawUrl = image.rawUrl || image.url;
    const rawThumbnail = image.rawThumbnail || image.thumbnail || rawUrl;
    const [signedUrl, signedThumbnail] = await Promise.all([
      rawUrl ? resolveSignedUrl(rawUrl) : null,
      rawThumbnail ? resolveSignedUrl(rawThumbnail, { transform: THUMBNAIL_TRANSFORM }) : null,
    ]);
    const nextImage = {
      ...image,
      url: signedUrl || rawUrl,
      thumbnail: signedThumbnail || rawThumbnail,
      isSigned: true,
    };
    setDbImages((prev) => prev.map((item) => (
      item.id === image.id ? { ...item, ...nextImage } : item
    )));
    setSelectedImage((prev) => (prev?.id === image.id ? nextImage : prev));
    return nextImage;
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

  const handleSelectImage = (image) => {
    setSelectedImage(image);
    setUploadFile(null);
    setUploadPreview(null);
    setInferenceResults(null);
    if (image) {
      ensureSignedImage(image);
    }
  };

  const handleRunInference = async () => {
    if (!selectedModel) {
      setInferenceResults({
        status: "error",
        message: "Select a deployed model before running inference.",
      });
      return;
    }

    if (!selectedImage && !uploadFile) {
      setInferenceResults({
        status: "error",
        message: "Select an image from the library or upload a new one.",
      });
      return;
    }

    const run = deployedModels.find((model) => model.id === selectedModel);
    if (!run) {
      setInferenceResults({
        status: "error",
        message: "Select a deployed model before running inference.",
      });
      return;
    }
    const endpoint = run?.deployment_url;

    if (!endpoint) {
      setInferenceResults({
        status: "error",
        message: "This model does not have a deployment endpoint yet. Deploy it and wait for the inference worker.",
      });
      return;
    }

    const requestUrl = buildInferenceUrl(endpoint, true);
    setIsProcessing(true);
    setInferenceResults({ status: "processing" });

    try {
      let requestBody = null;
      let headers = {};
      let imageForInference = selectedImage;
      if (imageForInference) {
        imageForInference = await ensureSignedImage(imageForInference);
      }
      const stepImageId = imageForInference?.id || null;

      if (uploadFile) {
        const formData = new FormData();
        formData.append("image", uploadFile);
        formData.append("file", uploadFile);
        if (stepImageId) {
          formData.append("step_image_id", stepImageId);
        }
        requestBody = formData;
      } else if (imageForInference?.url) {
        headers = { "Content-Type": "application/json" };
        requestBody = JSON.stringify({
          image_url: imageForInference.url,
          url: imageForInference.url,
          step_image_id: stepImageId,
        });
      }

      if (!requestBody) {
        throw new Error("Select an image to run inference.");
      }

      const response = await fetch(requestUrl, {
        method: "POST",
        headers,
        body: requestBody,
      });

      const contentType = response.headers.get("content-type") || "";
      let payload = null;
      if (contentType.includes("application/json")) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = text ? { raw: text } : null;
      }

      if (!response.ok) {
        const message = payload?.error || payload?.message || `Inference failed (${response.status}).`;
        throw new Error(message);
      }

      const normalizedPredictions = normalizePredictions(payload);
      const avgConfidence = averageConfidence(normalizedPredictions);
      const timestamp = payload?.timestamp || new Date().toISOString();
      const logicEvaluation = payload?.logic_evaluation || payload?.logic || null;

      const nextResults = {
        status: "completed",
        timestamp,
        model_used: selectedModel,
        model_name: run?.run_name || run?.base_model || "Deployed model",
        image_analyzed: imageForInference?.name || uploadFile?.name || "Uploaded image",
        processing_time: payload?.processing_time ?? payload?.processing_time_ms ?? payload?.duration ?? null,
        predictions: normalizedPredictions,
        logic_evaluation: logicEvaluation,
        raw_response: payload,
      };

      setInferenceResults(nextResults);
      setInferenceHistory((prev) => [
        {
          id: `local-${Date.now()}`,
          run_name: run?.run_name || "Inference run",
          model_name: run?.base_model || run?.run_name || "Deployed model",
          project_name: imageForInference?.project || "Uploaded image",
          image_name: imageForInference?.name || uploadFile?.name || "Uploaded image",
          status: "completed",
          created_date: timestamp,
          created_by: "you",
          results: {
            total_predictions: normalizedPredictions.length,
            avg_confidence: avgConfidence ?? 0,
            logic_status: logicEvaluation?.status ?? null,
            compliance_score: logicEvaluation?.compliance_score ?? null,
          },
        },
        ...prev,
      ]);
      loadInferenceHistory();
    } catch (error) {
      console.error("Error running inference:", error);
      setInferenceResults({
        status: "error",
        message: error?.message || "Unable to run inference at the moment.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedRun = deployedModels.find((model) => model.id === selectedModel);
  const previewSrc = uploadPreview || selectedImage?.url || selectedImage?.thumbnail || null;
  const previewLabel = selectedImage?.name || uploadFile?.name || "No image selected";
  const previewProject = selectedImage?.project || (uploadFile ? "Uploaded image" : "N/A");
  const predictionsSummary = inferenceResults?.predictions || [];
  const predictionsAvgConfidence = averageConfidence(predictionsSummary);

  const filteredImages = dbImages.filter((image) => {
    if (!imageSearch) return true;
    const haystack = [
      image.name,
      image.project,
      ...(image.tags || []),
    ].join(" ").toLowerCase();
    return haystack.includes(imageSearch.toLowerCase());
  });

  const displayScale = imageMetrics ? imageMetrics.fitScale * zoomLevel : 1;
  const stageWidth = imageMetrics ? imageMetrics.naturalWidth * displayScale : 0;
  const stageHeight = imageMetrics ? imageMetrics.naturalHeight * displayScale : 0;

  const filteredHistory = inferenceHistory.filter((item) => {
    if (historyFilter !== 'all' && item.status !== historyFilter) return false;
    if (searchQuery) {
      const runName = item.run_name || "";
      if (!runName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    return true;
  });

  const inferenceStatusConfig = {
    checking: { label: 'Checking inference...', color: 'bg-gray-100 text-gray-700', icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" /> },
    busy: { label: 'Inference running', color: 'bg-amber-100 text-amber-800', icon: <Cpu className="w-3 h-3 mr-1" /> },
    idle: { label: 'Inference available', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
    offline: { label: 'Inference offline', color: 'bg-red-100 text-red-800', icon: <WifiOff className="w-3 h-3 mr-1" /> },
    unknown: { label: 'Inference status unknown', color: 'bg-red-100 text-red-800', icon: <Info className="w-3 h-3 mr-1" /> },
    unsupported: { label: 'Inference status unavailable', color: 'bg-gray-100 text-gray-700', icon: <Info className="w-3 h-3 mr-1" /> },
  };
  const inferenceStatusDescriptions = {
    checking: 'Checking the inference worker status.',
    busy: 'Inference worker is processing a request.',
    idle: 'Inference worker is online and ready to serve requests.',
    offline: 'No inference workers were seen recently. Requests may fail.',
    unknown: 'Inference worker status could not be determined.',
    unsupported: 'Inference worker status table is not configured in Supabase.',
  };
  const effectiveInferenceState = isProcessing ? 'busy' : inferenceStatus.state;
  const currentInferenceStatus = inferenceStatusConfig[effectiveInferenceState] || inferenceStatusConfig.unknown;
  const inferenceStatusDescription = inferenceStatusDescriptions[effectiveInferenceState] || inferenceStatusDescriptions.unknown;
  const isInferenceOffline = effectiveInferenceState === 'offline' || effectiveInferenceState === 'unknown';
  const isInferenceStatusUnsupported = effectiveInferenceState === 'unsupported';
  const activeInferenceWorkers = inferenceStatus.activeWorkers || [];
  const inferenceProcessingCount = isProcessing ? 1 : 0;
  const workersOnlineLabel = inferenceStatus.isSupported ? inferenceStatus.workersOnline : "n/a";
  return (
    <div className="min-h-screen bg-slate-50/40 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-0 bg-white">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                Results & Analysis Hub
              </h1>
              <p className="text-gray-600 mt-1">Run live inference, review outcomes, and track history.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-col items-start sm:items-end gap-1">
              <div className="flex items-center gap-2">
                <Popover onOpenChange={(open) => { if (!open) setShowInferenceAdvanced(false); }}>
                  <PopoverTrigger
                    className="appearance-none border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded-md"
                    type="button"
                  >
                    <Badge className={`${currentInferenceStatus.color} border-0 font-medium`}>
                      {currentInferenceStatus.icon}
                      <span>{currentInferenceStatus.label}</span>
                    </Badge>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Inference worker status</p>
                        <p className="text-xs text-gray-600 mt-1">{inferenceStatusDescription}</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Badge className={`${currentInferenceStatus.color} border-0 font-medium`}>
                          {currentInferenceStatus.icon}
                          <span>{currentInferenceStatus.label}</span>
                        </Badge>
                        <span className="text-xs text-gray-500">
                          Last checked: {formatTime(inferenceStatus.lastCheckedAt)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-md bg-gray-50 p-2 text-center">
                          <div className="text-sm font-semibold text-gray-900">{workersOnlineLabel}</div>
                          <div className="text-[11px] text-gray-500">Workers</div>
                        </div>
                        <div className="rounded-md bg-gray-50 p-2 text-center">
                          <div className="text-sm font-semibold text-gray-900">{inferenceProcessingCount}</div>
                          <div className="text-[11px] text-gray-500">Processing</div>
                        </div>
                      </div>
                      <div className="border-t border-gray-100 pt-3">
                        <button
                          type="button"
                          onClick={() => setShowInferenceAdvanced((prev) => !prev)}
                          className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                          Advanced details
                          <ChevronDown className={`w-3 h-3 transition-transform ${showInferenceAdvanced ? 'rotate-180' : ''}`} />
                        </button>
                        {showInferenceAdvanced && (
                          <div className="mt-2 space-y-2">
                            {!inferenceStatus.isSupported && (
                              <p className="text-xs text-gray-500">Inference worker table not configured.</p>
                            )}
                            {inferenceStatus.isSupported && activeInferenceWorkers.length === 0 && (
                              <p className="text-xs text-gray-500">No active inference workers detected.</p>
                            )}
                            {inferenceStatus.isSupported && activeInferenceWorkers.map((worker, index) => {
                              const hardwareLabel = getWorkerHardwareLabel(worker);
                              return (
                                <div key={worker.worker_id || index} className="rounded-md bg-gray-50 p-2 text-xs text-gray-600">
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-[11px] text-gray-500">
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
                    setInferenceStatus((prev) => ({ ...prev, state: "checking" }));
                    loadInferenceStatus(true);
                  }}
                  aria-label="Refresh inference status"
                  title="Refresh inference status"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <span className="text-xs text-gray-500 self-start sm:self-auto">
                workers: {workersOnlineLabel}
              </span>
              {isInferenceStatusUnsupported && (
                <span className="text-xs text-gray-500 self-start sm:self-auto">Inference worker status not configured</span>
              )}
              {isInferenceOffline && !isInferenceStatusUnsupported && (
                <span className="text-xs text-amber-600 self-start sm:self-auto">Inference requests may fail while offline</span>
              )}
            </div>
            <Button variant="outline" onClick={() => setShowHistory((prev) => !prev)} className="w-full sm:w-auto">
              <History className="w-4 h-4 mr-2" />
              {showHistory ? "Back to Testing" : "Inference History"}
            </Button>
          </div>
        </div>

        {!showHistory ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Rail - Image Library */}
            <div className={`w-full ${isLibraryCollapsed ? "lg:w-16" : "lg:w-72"} transition-all`}>
              <Card className="shadow-lg h-full">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Database className="w-5 h-5 text-blue-600" />
                      {!isLibraryCollapsed && "Image Library"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsLibraryCollapsed((prev) => !prev)}
                      className="text-gray-500"
                    >
                      {isLibraryCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                  </div>
                  {!isLibraryCollapsed && (
                    <div className="relative mt-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search images..."
                        value={imageSearch}
                        onChange={(e) => setImageSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {isLibraryCollapsed ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4" />
                      </Button>
                      <span className="text-xs text-gray-500">Upload</span>
                    </div>
                  ) : (
                    <>
                      <ScrollArea className="max-h-[60vh] lg:max-h-[calc(100vh-340px)]">
                        <div className="space-y-3">
                          {isImagesLoading && filteredImages.length === 0 && (
                            <div className="text-sm text-gray-500 text-center py-8">
                              Loading images...
                            </div>
                          )}
                          {!isImagesLoading && filteredImages.length === 0 && (
                            <div className="text-sm text-gray-500 text-center py-8">
                              No images found yet.
                            </div>
                          )}
                          {filteredImages.map((image) => (
                            <div
                              key={image.id}
                              onClick={() => handleSelectImage(image)}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedImage?.id === image.id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {image.thumbnail || image.url ? (
                                  <img
                                    src={image.thumbnail || image.url}
                                    alt={image.name}
                                    className="w-12 h-12 rounded object-cover"
                                    loading="lazy"
                                    decoding="async"
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
                                      {image.tags.map((tag) => (
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

                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-16 border-dashed"
                      >
                        <div className="text-center">
                          <Upload className="w-5 h-5 mx-auto mb-1 text-gray-400" />
                          <p className="text-xs text-gray-600">Upload new image</p>
                        </div>
                      </Button>
                      {uploadFile && (
                        <p className="text-xs text-gray-500">
                          Using upload: <span className="font-medium">{uploadFile.name}</span>
                        </p>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Center - Image Canvas */}
            <div className="flex-1">
              <Card className="shadow-lg h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    Image Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedRun?.run_name || "Select a model"}</Badge>
                      <span>{previewLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Zoom</span>
                      <input
                        type="range"
                        min="1"
                        max="2.5"
                        step="0.1"
                        value={zoomLevel}
                        onChange={(event) => setZoomLevel(Number(event.target.value))}
                        className="w-28"
                      />
                      <span>{Math.round(zoomLevel * 100)}%</span>
                    </div>
                  </div>

                  <div
                    ref={imageContainerRef}
                    className="relative h-[420px] lg:h-[620px] bg-gray-50 rounded-lg overflow-hidden"
                  >
                    {previewSrc ? (
                      <div className="absolute inset-0 overflow-auto">
                        <div
                          className={`min-w-full min-h-full flex ${
                            zoomLevel > 1 ? "items-start justify-start" : "items-center justify-center"
                          }`}
                        >
                          <div
                            className="relative"
                            style={{
                              width: imageMetrics ? `${stageWidth}px` : "100%",
                              height: imageMetrics ? `${stageHeight}px` : "100%",
                            }}
                          >
                            <img
                              ref={imageRef}
                              src={previewSrc}
                              alt={previewLabel}
                              onLoad={updateImageMetrics}
                              className="w-full h-full object-contain"
                            />

                            {imageMetrics && inferenceResults?.predictions && inferenceResults.status === "completed" && (
                              <>
                                {inferenceResults.predictions.map((prediction) => {
                                  if (!prediction.bbox) return null;
                                  const pixelBox = toPixelBox(
                                    prediction.bbox,
                                    imageMetrics.naturalWidth,
                                    imageMetrics.naturalHeight
                                  );
                                  if (!pixelBox) return null;
                                  const isHovered = hoveredPredictionId === prediction.id;
                                  return (
                                    <div
                                      key={prediction.id}
                                      onMouseEnter={() => setHoveredPredictionId(prediction.id)}
                                      onMouseLeave={() => setHoveredPredictionId(null)}
                                      className={`absolute border-2 ${
                                        isHovered ? "border-yellow-400 bg-yellow-400/20" : "border-red-500 bg-red-500/10"
                                      }`}
                                      style={{
                                        left: `${pixelBox.x * displayScale}px`,
                                        top: `${pixelBox.y * displayScale}px`,
                                        width: `${pixelBox.width * displayScale}px`,
                                        height: `${pixelBox.height * displayScale}px`,
                                      }}
                                    >
                                      <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 text-xs rounded">
                                        {prediction.class}
                                        {prediction.confidence !== null
                                          ? ` (${(prediction.confidence * 100).toFixed(1)}%)`
                                          : ""}
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p>Select an image from the library or upload a new one.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Panel - Inspector */}
            <div className="w-full lg:w-80 space-y-6">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    Model & Run
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
                        deployedModels.map((model) => (
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
                        No models are currently deployed. Train and deploy a model first.
                        <Link to={createPageUrl('TrainingConfiguration')} className="block mt-2">
                          <Button variant="outline" size="sm">
                            <Spline className="w-4 h-4 mr-2" />
                            Go to Training
                          </Button>
                        </Link>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="rounded-lg border bg-white p-3 text-xs space-y-2">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-gray-500">Model</span>
                      <span className="font-medium">{selectedRun?.run_name || "None selected"}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-gray-500">Image</span>
                      <span className="font-medium truncate max-w-[140px]">{previewLabel}</span>
                    </div>
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-gray-500">Project</span>
                      <span className="font-medium truncate max-w-[140px]">{previewProject}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handleRunInference}
                    disabled={!selectedModel || (!selectedImage && !uploadFile) || isProcessing || deployedModels.length === 0}
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

              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-600" />
                    Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!inferenceResults && (
                    <p className="text-sm text-gray-500">Run inference to see results here.</p>
                  )}

                  {inferenceResults?.status === "processing" && (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-gray-200 rounded" />
                      <div className="h-3 bg-gray-200 rounded w-4/5" />
                      <div className="h-3 bg-gray-200 rounded w-2/3" />
                    </div>
                  )}

                  {inferenceResults?.status === "error" && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{inferenceResults.message}</AlertDescription>
                    </Alert>
                  )}

                  {inferenceResults?.status === "completed" && (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-gray-500">Detections</p>
                          <p className="text-lg font-semibold text-gray-900">{predictionsSummary.length}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 p-3">
                          <p className="text-gray-500">Avg Confidence</p>
                          <p className="text-lg font-semibold text-gray-900">
                            {typeof predictionsAvgConfidence === "number"
                              ? `${(predictionsAvgConfidence * 100).toFixed(1)}%`
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <p><span className="font-medium text-gray-700">Ran at:</span> {formatDateTime(inferenceResults.timestamp)}</p>
                        {inferenceResults.processing_time && (
                          <p><span className="font-medium text-gray-700">Processing time:</span> {inferenceResults.processing_time}</p>
                        )}
                        {inferenceResults.logic_evaluation?.status && (
                          <p><span className="font-medium text-gray-700">Logic status:</span> {inferenceResults.logic_evaluation.status}</p>
                        )}
                      </div>

                      {inferenceResults.logic_evaluation && (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-green-50 rounded-lg text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
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

                      <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-sm font-medium">Detections</h4>
                          <Badge variant="outline" className="text-xs">
                            {predictionsSummary.length}
                          </Badge>
                        </div>
                        {predictionsSummary.length === 0 ? (
                          <p className="text-xs text-gray-500">No detections returned.</p>
                        ) : (
                          <div className="space-y-2">
                            {predictionsSummary.map((pred) => (
                              <div
                                key={pred.id}
                                onMouseEnter={() => setHoveredPredictionId(pred.id)}
                                onMouseLeave={() => setHoveredPredictionId(null)}
                                className={`p-2 rounded text-sm border ${
                                  hoveredPredictionId === pred.id ? "border-yellow-400 bg-yellow-50" : "border-gray-100 bg-gray-50"
                                }`}
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <span className="font-medium">{pred.class}</span>
                                  {pred.confidence !== null && (
                                    <Badge variant="outline">
                                      {(pred.confidence * 100).toFixed(1)}%
                                    </Badge>
                                  )}
                                </div>
                                {pred.bbox && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Location: ({pred.bbox.x}, {pred.bbox.y}) | Size: {pred.bbox.width}x{pred.bbox.height}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

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
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Inference History
              </CardTitle>
              <CardDescription>Review past inference runs and results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Search inference runs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={historyFilter} onValueChange={setHistoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
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

              <ScrollArea className="max-h-[60vh]">
                <div className="overflow-x-auto">
                  <Table className="min-w-[960px]">
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
                                <Badge className={status.color}>{status.label}</Badge>
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
                                  <Badge className={logicBadgeClass}>{logicStatus}</Badge>
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
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
