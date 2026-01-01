
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  completed: { icon: <CheckCircle className="w-4 h-4 text-blue-500" />, color: "bg-blue-100 text-blue-800", label: "Completed" },
  failed: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: "bg-red-100 text-red-800", label: "Failed" }
};

const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const INFERENCE_HEARTBEAT_TIMEOUT_MS = 60000;
const THUMBNAIL_SIZE = 96;
const THUMBNAIL_TRANSFORM = { width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE, resize: "cover" };
const THUMBNAIL_PREFETCH_LIMIT = 80;
const USE_THUMBNAIL_TRANSFORM = false;
const THUMBNAIL_FALLBACK_TO_FULL = false;
const THUMBNAIL_SERIAL_LOAD = false;
const THUMBNAIL_LOAD_INTERVAL_MS = 250;

const deriveImageName = (imageUrl) => {
  if (!imageUrl) return "Unknown image";
  const last = imageUrl.split("?")[0].split("/").pop();
  return last || "Unknown image";
};

const buildAbsoluteUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  try {
    const base = SUPABASE_URL || window.location.origin;
    return new URL(url, base);
  } catch {
    return null;
  }
};

const isSupabaseSignedUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = buildAbsoluteUrl(url);
    if (!parsed) return false;
    return (
      parsed.pathname.includes("/storage/v1/object/sign/") ||
      parsed.pathname.includes("/storage/v1/render/image/sign/") ||
      parsed.searchParams.has("token")
    );
  } catch {
    return false;
  }
};

const isSupabasePublicUrl = (url) => {
  if (!url) return false;
  try {
    const parsed = buildAbsoluteUrl(url);
    if (!parsed) return false;
    return (
      parsed.pathname.includes("/storage/v1/object/public/") ||
      parsed.pathname.includes("/storage/v1/render/image/public/")
    );
  } catch {
    return false;
  }
};

const parseSupabaseRenderUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = buildAbsoluteUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/storage\/v1\/render\/image\/(public|sign)\/([^/]+)\/(.+)/);
    if (!match) return null;
    return {
      access: match[1],
      bucket: match[2],
      path: decodeURIComponent(match[3]),
    };
  } catch {
    return null;
  }
};

const parseSupabaseObjectUrl = (url) => {
  if (!url) return null;
  try {
    const parsed = buildAbsoluteUrl(url);
    if (!parsed) return null;
    const match = parsed.pathname.match(/\/storage\/v1\/object(?:\/(public|sign))?\/([^/]+)\/(.+)/);
    if (!match) return null;
    return {
      access: match[1] || "object",
      bucket: match[2],
      path: decodeURIComponent(match[3]),
    };
  } catch {
    return null;
  }
};

const isSupabaseStorageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  if (parseSupabaseRenderUrl(url) || parseSupabaseObjectUrl(url)) return true;
  try {
    const parsed = buildAbsoluteUrl(url);
    return Boolean(parsed?.pathname?.includes("/storage/v1/"));
  } catch {
    return false;
  }
};

const toPublicObjectUrl = (bucket, path) => {
  if (!SUPABASE_URL || !bucket || !path) return null;
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const encodedPath = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encodedPath}`;
};

const toAbsoluteStorageUrl = (url) => {
  if (!url || !SUPABASE_URL || typeof url !== "string") return url;
  if (/^(data|blob):/i.test(url)) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  if (!normalized.startsWith("/storage/v1/")) return url;
  const base = SUPABASE_URL.replace(/\/+$/, "");
  return `${base}${normalized}`;
};

const normalizeSupabaseSourceUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  const renderInfo = parseSupabaseRenderUrl(url);
  if (renderInfo) {
    if (renderInfo.access === "public") {
      return toPublicObjectUrl(renderInfo.bucket, renderInfo.path) || url;
    }
    return url;
  }
  return toAbsoluteStorageUrl(url);
};

const resolveSignedStorageUrl = async (url, { transform } = {}) => {
  const normalized = normalizeSupabaseSourceUrl(url);
  if (!normalized) return null;
  const renderInfo = parseSupabaseRenderUrl(normalized);
  if (renderInfo) {
    return createSignedImageUrl(renderInfo.bucket, renderInfo.path, { expiresIn: 3600, transform });
  }
  const objectInfo = parseSupabaseObjectUrl(normalized);
  if (objectInfo) {
    return createSignedImageUrl(objectInfo.bucket, objectInfo.path, { expiresIn: 3600, transform });
  }
  const absolute = buildAbsoluteUrl(normalized);
  const storageUrl = absolute ? absolute.toString() : normalized;
  const datasetPath = getStoragePathFromUrl(storageUrl, DATASET_BUCKET);
  if (datasetPath) {
    return createSignedImageUrl(DATASET_BUCKET, datasetPath, { expiresIn: 3600, transform });
  }
  const stepPath = getStoragePathFromUrl(storageUrl, STEP_IMAGES_BUCKET);
  if (stepPath) {
    return createSignedImageUrl(STEP_IMAGES_BUCKET, stepPath, { expiresIn: 3600, transform });
  }
  return normalized;
};

const buildImageEntry = (image, projectName) => {
  if (!image) return null;
  const tags = [];
  if (image.image_group) tags.push(image.image_group);
  if (image.processing_status) tags.push(image.processing_status);
  const fallbackUrl = normalizeSupabaseSourceUrl(
    image.display_url || image.image_url || image.thumbnail_url || ""
  );
  const thumbnailFallback = normalizeSupabaseSourceUrl(
    image.thumbnail_url || image.display_url || image.image_url || ""
  );
  const effectiveThumbnail = thumbnailFallback === fallbackUrl ? "" : thumbnailFallback;
  const shouldDeferUrl = isSupabaseStorageUrl(fallbackUrl) || isSupabaseSignedUrl(fallbackUrl);
  const shouldDeferThumbnail =
    isSupabaseStorageUrl(effectiveThumbnail) || isSupabaseSignedUrl(effectiveThumbnail);
  return {
    id: image.id,
    name: image.image_name || deriveImageName(image.display_url || image.image_url),
    url: shouldDeferUrl ? null : fallbackUrl,
    thumbnail: shouldDeferThumbnail ? null : effectiveThumbnail,
    rawUrl: fallbackUrl,
    rawThumbnail: effectiveThumbnail,
    isSigned: false,
    project: projectName || "Unknown project",
    date: image.created_date,
    tags,
  };
};

function ImageLibraryItem({ image, selected, onSelect, onRequestSigned, onThumbnailError }) {
  const itemRef = useRef(null);
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false);
  const thumbnailSrc = image?.thumbnail || (THUMBNAIL_FALLBACK_TO_FULL ? image?.url : "");
  const renderThumbnailSrc = useMemo(() => {
    if (!thumbnailSrc) return "";
    if (THUMBNAIL_SERIAL_LOAD && isSupabasePublicUrl(thumbnailSrc)) return "";
    const normalized = normalizeSupabaseSourceUrl(thumbnailSrc);
    if (isSupabaseStorageUrl(normalized) && !isSupabaseSignedUrl(normalized)) return "";
    return normalized;
  }, [thumbnailSrc]);

  useEffect(() => {
    if (THUMBNAIL_SERIAL_LOAD) return undefined;
    if (!itemRef.current || !image?.id || image?.thumbnailFailed) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onRequestSigned(image);
          observer.disconnect();
        }
      },
      { rootMargin: "200px", threshold: 0.1 }
    );
    observer.observe(itemRef.current);
    return () => observer.disconnect();
  }, [image, onRequestSigned]);

  useEffect(() => {
    setThumbnailLoaded(false);
  }, [renderThumbnailSrc, image?.id]);

  return (
    <div
      ref={itemRef}
      onClick={() => onSelect(image)}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        selected ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-3">
        {image.thumbnailFailed ? (
          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400">
            <ImageIcon className="w-5 h-5" />
          </div>
        ) : (
          <div className="relative w-12 h-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden">
            <ImageIcon className={`w-5 h-5 transition-opacity ${thumbnailLoaded ? "opacity-0" : "opacity-100"}`} />
            {renderThumbnailSrc && (
              <img
                src={renderThumbnailSrc}
                alt={image.name}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity ${thumbnailLoaded ? "opacity-100" : "opacity-0"}`}
                loading="lazy"
                decoding="async"
                onLoad={() => setThumbnailLoaded(true)}
                onError={() => {
                  setThumbnailLoaded(false);
                  onThumbnailError(image);
                }}
              />
            )}
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
  );
}

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
  const [showResultsDetail, setShowResultsDetail] = useState(false);
  const [hoveredPredictionId, setHoveredPredictionId] = useState(null);
  const [showDetections, setShowDetections] = useState(true);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0);
  const [imageSearch, setImageSearch] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [imageMetrics, setImageMetrics] = useState(null);
  const [detailZoom, setDetailZoom] = useState(1);
  const [detailImageMetrics, setDetailImageMetrics] = useState(null);
  const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [imagePage, setImagePage] = useState(1);
  const [serialVisibleCount, setSerialVisibleCount] = useState(0);
  const fileInputRef = useRef(null);
  const imageContainerRef = useRef(null);
  const imageRef = useRef(null);
  const detailImageContainerRef = useRef(null);
  const detailImageRef = useRef(null);
  const thumbnailRetryRef = useRef(new Map());
  const fullImageRetryRef = useRef(new Map());
  const signedRequestRef = useRef(new Set());
  const fullImageRequestRef = useRef(new Set());

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
    if (!showResultsDetail) return;
    setDetailZoom(1);
    setHoveredPredictionId(null);
  }, [showResultsDetail, selectedImage, uploadPreview]);

  useEffect(() => {
    if (!imageContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateImageMetrics();
    });
    observer.observe(imageContainerRef.current);
    return () => observer.disconnect();
  }, [imageContainerRef, selectedImage, uploadPreview]);

  useEffect(() => {
    if (!showResultsDetail || !detailImageContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      updateDetailImageMetrics();
    });
    observer.observe(detailImageContainerRef.current);
    return () => observer.disconnect();
  }, [detailImageContainerRef, showResultsDetail, selectedImage, uploadPreview]);

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

  const updateDetailImageMetrics = () => {
    const container = detailImageContainerRef.current;
    const image = detailImageRef.current;
    if (!container || !image) return;
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (!naturalWidth || !naturalHeight) return;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const fitScale = Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
    if (!Number.isFinite(fitScale)) return;
    setDetailImageMetrics({
      containerWidth,
      containerHeight,
      naturalWidth,
      naturalHeight,
      fitScale,
    });
  };

  const handleConfidenceChange = (value) => {
    const snapPoint = 80;
    const snapRange = 2;
    const nextValue = Math.abs(value - snapPoint) <= snapRange ? snapPoint : value;
    setConfidenceThreshold(nextValue);
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

      const normalized = images
        .map((image) => {
          const step = stepsById.get(image.step_id);
          const project = step ? projectsById.get(step.project_id) : null;
          return buildImageEntry(image, project?.name);
        })
        .filter(Boolean);

      setDbImages(normalized);
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
        const imageEntry = image ? buildImageEntry(image, projectName) : null;

        return {
          id: prediction.id,
          run_id: prediction.run_id,
          step_image_id: prediction.step_image_id,
          run_name: run?.run_name || "Inference run",
          model_name: run?.base_model || run?.run_name || "Unknown model",
          project_name: projectName,
          image_name: imageName,
          status: run?.status || "completed",
          created_date: prediction.created_date,
          created_by: run?.created_by || "system",
          annotations: prediction.annotations,
          predictions: normalizedPredictions,
          image_entry: imageEntry,
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

  const ensureSignedThumbnail = useCallback(async (image, options = {}) => {
    if (!image) return null;
    const { force = false } = options;
    if (image.thumbnailFailed) return image;
    const hasThumbnail = Boolean(image.thumbnail);
    const thumbnailIsSigned = isSupabaseSignedUrl(image.thumbnail);
    const thumbnailIsPublic = isSupabasePublicUrl(image.thumbnail);
    if (!force && hasThumbnail && !thumbnailIsPublic && !thumbnailIsSigned) return image;
    if (!force && hasThumbnail && (thumbnailIsSigned || thumbnailIsPublic)) return image;
    const rawThumbnail = image.rawThumbnail ? normalizeSupabaseSourceUrl(image.rawThumbnail) : null;
    const rawUrl = image.rawUrl ? normalizeSupabaseSourceUrl(image.rawUrl) : null;
    const thumbnailSource = rawThumbnail || (USE_THUMBNAIL_TRANSFORM ? rawUrl : null);
    if (!thumbnailSource) return image;
    const useTransform = USE_THUMBNAIL_TRANSFORM && !rawThumbnail;
    try {
      const signedThumbnail = await resolveSignedStorageUrl(
        thumbnailSource,
        useTransform ? { transform: THUMBNAIL_TRANSFORM } : undefined
      );
      if (!signedThumbnail) return image;
      setDbImages((prev) => prev.map((item) => (
        item.id === image.id ? { ...item, thumbnail: signedThumbnail } : item
      )));
      setSelectedImage((prev) =>
        prev?.id === image.id ? { ...prev, thumbnail: signedThumbnail } : prev
      );
      return { ...image, thumbnail: signedThumbnail };
    } catch (error) {
      console.warn("Failed to load thumbnail:", error);
      return image;
    }
  }, []);

  const ensureSignedFullImage = useCallback(async (image, options = {}) => {
    if (!image) return null;
    const { force = false } = options;
    const urlIsSigned = isSupabaseSignedUrl(image.url);
    if (!force && image.url && (image.isSigned || isSupabasePublicUrl(image.url) || urlIsSigned)) return image;
    const rawUrl = normalizeSupabaseSourceUrl(image.rawUrl || image.url);
    if (!rawUrl) return null;
    try {
      const signedUrl = await resolveSignedStorageUrl(rawUrl);
      if (!signedUrl) return image;
      const nextImage = {
        ...image,
        url: signedUrl,
        isSigned: true,
      };
      setDbImages((prev) => prev.map((item) => (
        item.id === image.id ? { ...item, ...nextImage } : item
      )));
      setSelectedImage((prev) => (prev?.id === image.id ? nextImage : prev));
      return nextImage;
    } catch (error) {
      console.warn("Failed to load full image:", error);
      return image;
    }
  }, []);

  const requestSignedThumbnail = useCallback((image) => {
    if (!image?.id) return;
    if (image.thumbnailFailed) return;
    const hasThumbnail = Boolean(image.thumbnail);
    const thumbnailIsSigned = isSupabaseSignedUrl(image.thumbnail);
    const thumbnailIsPublic = isSupabasePublicUrl(image.thumbnail);
    if (hasThumbnail && !thumbnailIsPublic && !thumbnailIsSigned) return;
    if (hasThumbnail && (thumbnailIsSigned || thumbnailIsPublic)) return;
    if (signedRequestRef.current.has(image.id)) return;
    signedRequestRef.current.add(image.id);
    Promise.resolve(ensureSignedThumbnail(image)).finally(() => {
      signedRequestRef.current.delete(image.id);
    });
  }, [ensureSignedThumbnail]);

  const shouldRequestThumbnail = useCallback((image) => {
    if (!image?.id || image.thumbnailFailed) return false;
    const hasThumbnail = Boolean(image.thumbnail);
    const thumbnailIsSigned = isSupabaseSignedUrl(image.thumbnail);
    const thumbnailIsPublic = isSupabasePublicUrl(image.thumbnail);
    if (hasThumbnail && !thumbnailIsPublic && !thumbnailIsSigned) return false;
    if (hasThumbnail && (thumbnailIsSigned || thumbnailIsPublic)) return false;
    return true;
  }, []);

  const requestSignedFullImage = useCallback((image, options = {}) => {
    if (!image?.id) return;
    if (image.url && image.isSigned) return;
    if (fullImageRequestRef.current.has(image.id)) return;
    fullImageRequestRef.current.add(image.id);
    Promise.resolve(ensureSignedFullImage(image, options)).finally(() => {
      fullImageRequestRef.current.delete(image.id);
    });
  }, [ensureSignedFullImage]);

  const handlePreviewError = useCallback(() => {
    const image = selectedImage;
    if (!image?.id) return;
    const retryCount = fullImageRetryRef.current.get(image.id) || 0;
    if (retryCount >= 1) return;
    fullImageRetryRef.current.set(image.id, retryCount + 1);
    Promise.resolve(ensureSignedFullImage(image, { force: true })).finally(() => {
      fullImageRetryRef.current.delete(image.id);
    });
  }, [selectedImage, ensureSignedFullImage]);

  const handleThumbnailError = useCallback((image) => {
    if (!image?.id) return;
    const retryCount = thumbnailRetryRef.current.get(image.id) || 0;
    if (retryCount >= 1) {
      setDbImages((prev) =>
        prev.map((item) =>
          item.id === image.id ? { ...item, thumbnailFailed: true, thumbnail: null, url: null } : item
        )
      );
      return;
    }
    thumbnailRetryRef.current.set(image.id, retryCount + 1);
    Promise.resolve(ensureSignedThumbnail(image, { force: true })).finally(() => {
      thumbnailRetryRef.current.delete(image.id);
    });
  }, [ensureSignedThumbnail]);

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
      requestSignedFullImage(image);
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
        imageForInference = await ensureSignedFullImage(imageForInference);
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
          run_id: run?.id || null,
          step_image_id: stepImageId || null,
          run_name: run?.run_name || "Inference run",
          model_name: run?.base_model || run?.run_name || "Deployed model",
          project_name: imageForInference?.project || "Uploaded image",
          image_name: imageForInference?.name || uploadFile?.name || "Uploaded image",
          status: "completed",
          created_date: timestamp,
          created_by: "you",
          annotations: payload,
          predictions: normalizedPredictions,
          image_entry: imageForInference || null,
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

  const handleHistoryAction = (item) => {
    if (!item) return;
    setShowHistory(false);
    setHoveredPredictionId(null);
    setUploadFile(null);
    setUploadPreview(null);

    let historyImage = null;
    if (item.step_image_id) {
      historyImage = dbImages.find((image) => image.id === item.step_image_id) || item.image_entry;
    } else {
      historyImage = item.image_entry || null;
    }

    if (historyImage) {
      setSelectedImage(historyImage);
      requestSignedFullImage(historyImage);
    } else {
      setSelectedImage(null);
    }

    setInferenceResults({
      status: "completed",
      timestamp: item.created_date,
      model_used: item.run_id || null,
      model_name: item.model_name || "Unknown model",
      image_analyzed: item.image_name || "Unknown image",
      processing_time: null,
      predictions: item.predictions || [],
      logic_evaluation: item.logic_evaluation || null,
      raw_response: item.annotations || item.predictions || null,
    });
  };

  const selectedRun = deployedModels.find((model) => model.id === selectedModel);
  const handleBack = () => {
    if (selectedRun?.project_id) {
      const stepId = selectedRun.step_id;
      const projectId = selectedRun.project_id;
      const url = stepId
        ? createPageUrl(`TrainingConfiguration?projectId=${projectId}&stepId=${stepId}`)
        : createPageUrl(`TrainingConfiguration?projectId=${projectId}`);
      navigate(url);
      return;
    }
    navigate(createPageUrl('Projects'));
  };
  const previewSrc = useMemo(() => {
    if (uploadPreview) return uploadPreview;
    if (!selectedImage) return null;
    const primary = selectedImage.url || selectedImage.rawUrl || null;
    const primaryNormalized = normalizeSupabaseSourceUrl(primary);
    const primaryIsStorage = isSupabaseStorageUrl(primaryNormalized);
    const primaryIsSigned = isSupabaseSignedUrl(primaryNormalized) || selectedImage.isSigned;
    if (primaryNormalized && (!primaryIsStorage || primaryIsSigned)) {
      return primaryNormalized;
    }
    const fallback = selectedImage.thumbnail || selectedImage.rawThumbnail || null;
    const fallbackNormalized = normalizeSupabaseSourceUrl(fallback);
    const fallbackIsStorage = isSupabaseStorageUrl(fallbackNormalized);
    const fallbackIsSigned = isSupabaseSignedUrl(fallbackNormalized);
    if (fallbackNormalized && (!fallbackIsStorage || fallbackIsSigned)) {
      return fallbackNormalized;
    }
    return null;
  }, [uploadPreview, selectedImage]);
  const previewLabel = selectedImage?.name || uploadFile?.name || "No image selected";
  const previewProject = selectedImage?.project || (uploadFile ? "Uploaded image" : "N/A");
  const predictionsSummary = useMemo(
    () => inferenceResults?.predictions || [],
    [inferenceResults]
  );
  const filteredPredictions = useMemo(() => {
    if (!predictionsSummary.length) return [];
    const threshold = confidenceThreshold / 100;
    return predictionsSummary.filter((prediction) => {
      const confidence = toNumber(prediction.confidence);
      if (confidence === null) return threshold <= 0;
      return confidence >= threshold;
    });
  }, [confidenceThreshold, predictionsSummary]);
  const predictionsAvgConfidence = averageConfidence(filteredPredictions);

  const filteredImages = useMemo(() => {
    if (!imageSearch) return dbImages;
    const query = imageSearch.toLowerCase();
    return dbImages.filter((image) => {
      const haystack = [
        image.name,
        image.project,
        ...(image.tags || []),
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [dbImages, imageSearch]);

  const pageEnd = imagePage * THUMBNAIL_PREFETCH_LIMIT;
  const visibleImages = useMemo(
    () => filteredImages.slice(0, pageEnd),
    [filteredImages, pageEnd]
  );
  const serialImages = useMemo(
    () => (THUMBNAIL_SERIAL_LOAD ? visibleImages.slice(0, serialVisibleCount) : visibleImages),
    [visibleImages, serialVisibleCount]
  );

  useEffect(() => {
    if (!THUMBNAIL_SERIAL_LOAD) return undefined;
    const candidates = serialImages.filter(shouldRequestThumbnail);
    if (candidates.length === 0) return undefined;
    let index = 0;
    const interval = setInterval(() => {
      const next = candidates[index];
      index += 1;
      if (!next) {
        clearInterval(interval);
        return;
      }
      requestSignedThumbnail(next);
    }, THUMBNAIL_LOAD_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [serialImages, requestSignedThumbnail, shouldRequestThumbnail]);

  useEffect(() => {
    setImagePage(1);
  }, [imageSearch, dbImages.length]);
  useEffect(() => {
    if (!THUMBNAIL_SERIAL_LOAD) return;
    setSerialVisibleCount(0);
  }, [imageSearch, dbImages.length]);
  useEffect(() => {
    if (!THUMBNAIL_SERIAL_LOAD) return undefined;
    if (serialVisibleCount >= visibleImages.length) return undefined;
    const timeout = setTimeout(() => {
      setSerialVisibleCount((prev) => Math.min(prev + 1, visibleImages.length));
    }, THUMBNAIL_LOAD_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [serialVisibleCount, visibleImages.length]);

  const displayScale = imageMetrics ? imageMetrics.fitScale * zoomLevel : 1;
  const stageWidth = imageMetrics ? imageMetrics.naturalWidth * displayScale : 0;
  const stageHeight = imageMetrics ? imageMetrics.naturalHeight * displayScale : 0;
  const detailDisplayScale = detailImageMetrics ? detailImageMetrics.fitScale * detailZoom : 1;
  const detailStageWidth = detailImageMetrics ? detailImageMetrics.naturalWidth * detailDisplayScale : 0;
  const detailStageHeight = detailImageMetrics ? detailImageMetrics.naturalHeight * detailDisplayScale : 0;

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
    idle: { label: 'Inference available', color: 'bg-blue-100 text-blue-800', icon: <CheckCircle className="w-3 h-3 mr-1" /> },
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
    <div className="min-h-screen bg-slate-50/40 p-4 sm:p-6 lg:h-screen lg:overflow-hidden">
      <div className="w-full h-full flex flex-col gap-6 min-h-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handleBack}
              className="border-0 bg-white"
            >
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
              <div className="flex flex-wrap items-center gap-2">
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
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                  workers: {workersOnlineLabel}
                </span>
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
          <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 lg:overflow-hidden">
            {/* Left Rail - Image Library */}
            <div className={`w-full ${isLibraryCollapsed ? "lg:w-20" : "lg:w-72"} transition-all flex flex-col min-h-0`}>
              <Card className="shadow-lg lg:h-full flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className={`flex items-center gap-2 text-sm ${isLibraryCollapsed ? "justify-center" : ""}`}>
                      <Database className="w-5 h-5 text-blue-600" />
                      {!isLibraryCollapsed && "Image Library"}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsLibraryCollapsed((prev) => !prev)}
                      className={`text-gray-500 ${isLibraryCollapsed ? "mx-auto" : ""}`}
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
                <CardContent
                  className={`flex flex-col gap-4 ${
                    isLibraryCollapsed ? "items-center px-4" : "pr-2"
                  } lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {isLibraryCollapsed ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Upload new image"
                        title="Upload new image"
                        className="mx-auto"
                      >
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
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
                        {serialImages.map((image) => (
                          <ImageLibraryItem
                            key={image.id}
                            image={image}
                            selected={selectedImage?.id === image.id}
                            onSelect={handleSelectImage}
                            onRequestSigned={requestSignedThumbnail}
                            onThumbnailError={handleThumbnailError}
                          />
                        ))}
                      </div>
                      {visibleImages.length < filteredImages.length && (
                        <Button
                          variant="outline"
                          onClick={() => setImagePage((prev) => prev + 1)}
                          className="w-full"
                        >
                          Load more images
                        </Button>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:grid-rows-[minmax(0,1fr)_minmax(0,0.55fr)] gap-6">
              {/* Center - Image Canvas */}
              <div className="min-h-0">
                <Card className="shadow-lg h-full flex flex-col min-h-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-blue-600" />
                      Image Preview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 flex flex-col gap-3">
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
                      className="relative flex-1 min-h-[320px] bg-gray-50 rounded-lg overflow-hidden"
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
                                onError={handlePreviewError}
                                className="w-full h-full object-contain"
                              />

                              {showDetections && imageMetrics && inferenceResults?.predictions && inferenceResults.status === "completed" && (
                                <>
                                  {filteredPredictions.map((prediction) => {
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

              {/* Model & Run */}
              <div className="min-h-0">
                <Card className="shadow-lg h-full flex flex-col">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      Model & Run
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-4">
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
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
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
                        <span className="font-medium truncate max-w-[160px]">{previewLabel}</span>
                      </div>
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-gray-500">Project</span>
                        <span className="font-medium truncate max-w-[160px]">{previewProject}</span>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-gray-50/70 p-3 space-y-3 text-xs">
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Min confidence</span>
                        <span className="font-medium text-gray-900">{confidenceThreshold}%</span>
                      </div>
                      <div className="relative">
                        <div className="pointer-events-none absolute left-[80%] top-1/2 h-3 -translate-y-1/2 border-l border-blue-500/70" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                        value={confidenceThreshold}
                        onChange={(event) => handleConfidenceChange(Number(event.target.value))}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>0%</span>
                        <span>Recommended 80%</span>
                        <span>100%</span>
                      </div>
                      <div className="flex items-center justify-between text-gray-600">
                        <span>Show detections</span>
                        <Switch checked={showDetections} onCheckedChange={setShowDetections} />
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
              </div>

              {/* Results */}
              <div className="min-h-0 lg:col-span-2">
                <Card className="shadow-lg h-full flex flex-col min-h-0">
                  <CardHeader className="flex flex-row items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      Results
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowResultsDetail(true)}
                      disabled={!inferenceResults || inferenceResults.status !== "completed"}
                    >
                      View Details
                    </Button>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
                    {!inferenceResults && (
                      <div className="flex flex-col items-center justify-center flex-1 min-h-[220px] text-center text-gray-500">
                        <Target className="w-10 h-10 text-gray-300 mb-3" />
                        <p className="text-sm">Run inference to see results here.</p>
                      </div>
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
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-gray-500">Detections</p>
                            <p className="text-xl font-semibold text-gray-900">{filteredPredictions.length}</p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-gray-500">Avg Confidence</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {typeof predictionsAvgConfidence === "number"
                                ? `${(predictionsAvgConfidence * 100).toFixed(1)}%`
                                : "N/A"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-gray-500">Logic Score</p>
                            <p className="text-xl font-semibold text-gray-900">
                              {typeof inferenceResults.logic_evaluation?.compliance_score === "number"
                                ? `${(inferenceResults.logic_evaluation.compliance_score * 100).toFixed(0)}%`
                                : "N/A"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="text-gray-500">Processing</p>
                            <p className="text-sm font-semibold text-gray-900">
                              {inferenceResults.processing_time || "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                          <span><span className="font-medium text-gray-700">Ran at:</span> {formatDateTime(inferenceResults.timestamp)}</span>
                          {inferenceResults.logic_evaluation?.status && (
                            <span><span className="font-medium text-gray-700">Logic status:</span> {inferenceResults.logic_evaluation.status}</span>
                          )}
                        </div>

                        {inferenceResults.logic_evaluation && (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between p-3 bg-blue-50 rounded-lg text-xs">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-800">
                                Logic Status: {inferenceResults.logic_evaluation.status}
                              </span>
                            </div>
                            {typeof inferenceResults.logic_evaluation.compliance_score === "number" && (
                              <Badge className="bg-blue-100 text-blue-800">
                                {(inferenceResults.logic_evaluation.compliance_score * 100).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        )}

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
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <Card className="shadow-lg h-full flex flex-col min-h-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Inference History
                </CardTitle>
                <CardDescription>Review past inference runs and results</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col">
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

                <ScrollArea className="flex-1 min-h-0">
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
                              ? "bg-blue-100 text-blue-800"
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
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleHistoryAction(item)}
                                  aria-label="View inference results"
                                >
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
          </div>
        )}

        <Dialog open={showResultsDetail} onOpenChange={setShowResultsDetail}>
          <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden flex flex-col">
            <div className="flex h-full flex-col">
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>Inference Details</DialogTitle>
                <DialogDescription>
                  Zoomed preview with the full prediction list.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 px-6 pb-6">
                <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:grid-rows-[minmax(0,1fr)]">
                  <div className="h-full min-h-0 rounded-lg border bg-white p-4 flex flex-col overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
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
                          value={detailZoom}
                          onChange={(event) => setDetailZoom(Number(event.target.value))}
                          className="w-32"
                        />
                        <span>{Math.round(detailZoom * 100)}%</span>
                      </div>
                    </div>
                    <div
                      ref={detailImageContainerRef}
                      className="relative flex-1 min-h-0 mt-3 bg-gray-50 rounded-lg overflow-hidden"
                    >
                      {previewSrc ? (
                        <div className="absolute inset-0 overflow-auto">
                          <div
                            className={`min-w-full min-h-full flex ${
                              detailZoom > 1 ? "items-start justify-start" : "items-center justify-center"
                            }`}
                          >
                            <div
                              className="relative"
                              style={{
                                width: detailImageMetrics ? `${detailStageWidth}px` : "100%",
                                height: detailImageMetrics ? `${detailStageHeight}px` : "100%",
                              }}
                            >
                              <img
                                ref={detailImageRef}
                                src={previewSrc}
                                alt={previewLabel}
                                onLoad={updateDetailImageMetrics}
                                onError={handlePreviewError}
                                className="w-full h-full object-contain"
                              />

                              {showDetections && detailImageMetrics && inferenceResults?.predictions && inferenceResults.status === "completed" && (
                                <>
                                  {filteredPredictions.map((prediction) => {
                                    if (!prediction.bbox) return null;
                                    const pixelBox = toPixelBox(
                                      prediction.bbox,
                                      detailImageMetrics.naturalWidth,
                                      detailImageMetrics.naturalHeight
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
                                          left: `${pixelBox.x * detailDisplayScale}px`,
                                          top: `${pixelBox.y * detailDisplayScale}px`,
                                          width: `${pixelBox.width * detailDisplayScale}px`,
                                          height: `${pixelBox.height * detailDisplayScale}px`,
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
                          <ImageIcon className="w-14 h-14 mx-auto mb-3 text-gray-300" />
                          <p>Select an image to preview results.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="h-full min-h-0 rounded-lg border bg-white p-4 flex flex-col">
                    <div className="flex items-center justify-between text-sm font-medium text-gray-900">
                      <span>Predictions</span>
                      <Badge variant="outline" className="text-xs">
                        {filteredPredictions.length}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {showDetections ? "Hover a row to highlight the box on the image." : "Detections are hidden."}
                    </div>
                    <ScrollArea className="flex-1 min-h-0 mt-3 pr-2">
                      {!showDetections ? (
                        <div className="text-sm text-gray-500 py-8 text-center">
                          Toggle “Show detections” to view the list.
                        </div>
                      ) : filteredPredictions.length === 0 ? (
                        <div className="text-sm text-gray-500 py-8 text-center">
                          No detections returned.
                        </div>
                      ) : (
                        <Table className="table-fixed w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Class</TableHead>
                              <TableHead>Confidence</TableHead>
                              <TableHead className="w-1/2">Box</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredPredictions.map((pred) => (
                              <TableRow
                                key={pred.id}
                                onMouseEnter={() => setHoveredPredictionId(pred.id)}
                                onMouseLeave={() => setHoveredPredictionId(null)}
                                className={hoveredPredictionId === pred.id ? "bg-yellow-50" : ""}
                              >
                                <TableCell className="font-medium">{pred.class}</TableCell>
                                <TableCell>
                                  {pred.confidence !== null
                                    ? `${(pred.confidence * 100).toFixed(1)}%`
                                    : "N/A"}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500 break-all">
                                  {pred.bbox
                                    ? `${pred.bbox.x}, ${pred.bbox.y}, ${pred.bbox.width}x${pred.bbox.height}`
                                    : "n/a"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
