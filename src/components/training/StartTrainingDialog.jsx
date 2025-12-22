import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SOPStep } from '@/api/entities';
import { listStepImages } from '@/api/db';
import { createSignedImageUrl, getStoragePathFromUrl, uploadToSupabaseStorage } from '@/api/storage';

const TooltipLabel = ({ children, tooltipText }) => (
    <div className="flex items-center gap-1.5 mb-1.5">
        <Label>{children}</Label>
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="focus:outline-none -mb-0.5">
                        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-gray-800 text-white border-gray-700">
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    </div>
);

const modelOptions = [
  { value: 'YOLOv8s', label: 'YOLOv8s', description: 'Best balance of speed and accuracy.' },
  { value: 'YOLOv8n', label: 'YOLOv8n', description: 'Fastest, ideal for edge devices.' },
  { value: 'YOLOv8m', label: 'YOLOv8m', description: 'Most accurate, requires more compute.' },
  { value: 'EfficientDet-D0', label: 'EfficientDet-D0', description: 'Good performance, scalable.' },
];

const computeOptions = [
  { value: 'gpu', label: 'GPU (device 0)', description: 'Uses the trainer default GPU.' },
  { value: 'cpu', label: 'CPU', description: 'Much slower, useful for debugging.' },
];

const presetOptions = [
  {
    value: 'balanced',
    label: 'Balanced',
    description: 'Best overall tradeoff for most projects.',
    summary: '100 epochs, batch 16, img 640, lr 0.001, Adam, GPU.',
    config: { epochs: 100, batchSize: 16, imgSize: 640, learningRate: 0.001, optimizer: 'Adam', compute: 'gpu' }
  },
  {
    value: 'fast',
    label: 'Fast',
    description: 'Shorter training, faster iteration.',
    summary: '40 epochs, batch 32, img 640, lr 0.001, Adam, GPU.',
    config: { epochs: 40, batchSize: 32, imgSize: 640, learningRate: 0.001, optimizer: 'Adam', compute: 'gpu' }
  },
  {
    value: 'high_accuracy',
    label: 'High Accuracy',
    description: 'Longer training, higher accuracy targets.',
    summary: '150 epochs, batch 16, img 1280, lr 0.0008, AdamW, GPU.',
    config: { epochs: 150, batchSize: 16, imgSize: 1280, learningRate: 0.0008, optimizer: 'AdamW', compute: 'gpu' }
  },
  {
    value: 'edge_cpu',
    label: 'Edge/CPU',
    description: 'CPU-friendly baseline for edge testing.',
    summary: '60 epochs, batch 8, img 320, lr 0.001, SGD, CPU.',
    config: { epochs: 60, batchSize: 8, imgSize: 320, learningRate: 0.001, optimizer: 'SGD', compute: 'cpu' }
  },
];

const augmentationPresets = [
  {
    value: 'none',
    label: 'None',
    description: 'No augmentation (use raw images only).',
    summary: 'Turns off color, flip, mosaic, and mixup.',
    config: {
      hsv_h: 0,
      hsv_s: 0,
      hsv_v: 0,
      degrees: 0,
      translate: 0,
      scale: 0,
      shear: 0,
      perspective: 0,
      flipud: 0,
      fliplr: 0,
      mosaic: 0,
      mixup: 0,
      copy_paste: 0,
    },
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Small color jitter with mild geometry.',
    summary: 'hsv 0.01/0.4/0.3, translate 0.05, scale 0.3, mosaic 0.5.',
    config: {
      hsv_h: 0.01,
      hsv_s: 0.4,
      hsv_v: 0.3,
      degrees: 0,
      translate: 0.05,
      scale: 0.3,
      shear: 0,
      perspective: 0,
      flipud: 0,
      fliplr: 0.5,
      mosaic: 0.5,
      mixup: 0.0,
      copy_paste: 0.0,
    },
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Ultralytics YOLO defaults.',
    summary: 'hsv 0.015/0.7/0.4, translate 0.1, scale 0.5, mosaic 1.0.',
    config: {
      hsv_h: 0.015,
      hsv_s: 0.7,
      hsv_v: 0.4,
      degrees: 0,
      translate: 0.1,
      scale: 0.5,
      shear: 0,
      perspective: 0,
      flipud: 0,
      fliplr: 0.5,
      mosaic: 1.0,
      mixup: 0.0,
      copy_paste: 0.0,
    },
  },
  {
    value: 'strong',
    label: 'Strong',
    description: 'Aggressive augmentation for small datasets.',
    summary: 'degrees 10, translate 0.2, scale 0.8, mixup 0.2.',
    config: {
      hsv_h: 0.02,
      hsv_s: 0.8,
      hsv_v: 0.5,
      degrees: 10,
      translate: 0.2,
      scale: 0.8,
      shear: 2.0,
      perspective: 0.0,
      flipud: 0.0,
      fliplr: 0.5,
      mosaic: 1.0,
      mixup: 0.2,
      copy_paste: 0.1,
    },
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Manual overrides.',
    summary: 'Fine-tuned augmentation settings.',
    config: null,
  },
];

const DEFAULT_AUGMENTATION_PRESET =
  augmentationPresets.find((preset) => preset.value === 'standard') || augmentationPresets[0];
const DEFAULT_AUGMENTATION_CONFIG = {
  preset: DEFAULT_AUGMENTATION_PRESET.value,
  ...(DEFAULT_AUGMENTATION_PRESET.config || {}),
};

const DATASET_EXPORT_CONCURRENCY = Math.max(
    1,
    Number(import.meta.env.VITE_DATASET_EXPORT_CONCURRENCY || import.meta.env.VITE_UPLOAD_CONCURRENCY) || 4
);

const runWithConcurrency = async (items, limit, worker) => {
    if (!items.length) return;
    let index = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (index < items.length) {
            const currentIndex = index;
            index += 1;
            await worker(items[currentIndex], currentIndex);
        }
    });
    await Promise.all(runners);
};

export default function StartTrainingDialog({ open, onOpenChange, onSubmit, stepId, stepTitle, existingRuns, stepData, trainerOffline }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [formError, setFormError] = useState("");
    const [autoYamlSource, setAutoYamlSource] = useState({ path: "", display: "" });
    const [datasetSummary, setDatasetSummary] = useState(null);
    const [isCheckingDataset, setIsCheckingDataset] = useState(false);
    const [datasetStatus, setDatasetStatus] = useState({ state: "idle", message: "", processed: 0, total: 0 });
    const [selectedPreset, setSelectedPreset] = useState('balanced');
    const hasInitializedRef = useRef(false);
    const lastStepIdRef = useRef(null);
    const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";
    const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
    
    const [config, setConfig] = useState({
        runName: "",
        dataYaml: "",
        baseModel: 'YOLOv8s',
        epochs: 100,
        batchSize: 16,
        imgSize: 640,
        learningRate: 0.001,
        optimizer: 'Adam',
        compute: 'gpu',
        augmentation: { ...DEFAULT_AUGMENTATION_CONFIG },
        optimizationStrategy: 'manual',
        bayesianConfig: {
            objective: 'maximize_mAP',
            numTrials: 20,
            maxDuration: 6,
            searchSpace: {
                epochs: { enabled: false, min: 50, max: 200, type: 'integer' },
                batchSize: { enabled: false, options: [8, 16, 32], type: 'categorical' },
                learningRate: { enabled: false, min: 0.0001, max: 0.01, type: 'log_uniform' },
                imgSize: { enabled: false, options: [320, 640, 1280], type: 'categorical' }
            }
        }
    });

    const buildDatasetYaml = useMemo(() => {
        return (classes = []) => {
            const names = (classes || []).filter(Boolean);
            const namesYaml = names.length
                ? names.map((name, index) => `  ${index}: ${JSON.stringify(name)}`).join("\n")
                : "";
            const yamlLines = [
                "path: .",
                "train: images/train",
                "val: images/val",
            ];
            if (namesYaml) {
                yamlLines.push("names:", namesYaml);
            } else {
                yamlLines.push("names: []");
            }
            return `${yamlLines.join("\n")}\n`;
        };
    }, []);

    useEffect(() => {
        if (!autoYamlSource.path) return;
        setConfig(prev => (prev.dataYaml ? prev : { ...prev, dataYaml: autoYamlSource.path }));
    }, [autoYamlSource]);

    const dynamicModelOptions = useMemo(() => {
        const completedRuns = (existingRuns || []).filter(run => run.status === 'completed' && run.trained_model_url);
        if (completedRuns.length > 0) {
            return [
                { label: "Pretrained models (recommended)", options: modelOptions },
                {
                    label: "Fine-tune from your runs",
                    options: completedRuns.map(run => ({
                        value: run.id,
                        label: run.run_name,
                        description: `Completed on ${new Date(run.updated_date).toLocaleDateString()}. mAP: ${run.results?.mAP || 'N/A'}`
                    }))
                }
            ];
        }
        return [{ label: "Pretrained models (recommended)", options: modelOptions }];
    }, [existingRuns]);

    const activePreset = useMemo(() => {
        return presetOptions.find(option => option.value === selectedPreset) || presetOptions[0];
    }, [selectedPreset]);
    const augmentationConfig = useMemo(() => ({
        ...DEFAULT_AUGMENTATION_CONFIG,
        ...(config.augmentation || {}),
    }), [config.augmentation]);
    const activeAugmentationPreset = useMemo(() => {
        const presetValue = augmentationConfig.preset || DEFAULT_AUGMENTATION_CONFIG.preset;
        return (
            augmentationPresets.find(option => option.value === presetValue)
            || augmentationPresets.find(option => option.value === 'custom')
            || augmentationPresets[0]
        );
    }, [augmentationConfig.preset]);

    const handleConfigChange = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));
    const handleBayesianConfigChange = (key, value) => setConfig(prev => ({ ...prev, bayesianConfig: { ...prev.bayesianConfig, [key]: value } }));
    const handleSearchSpaceChange = (param, field, value) => {
        setConfig(prev => ({
            ...prev,
            bayesianConfig: {
                ...prev.bayesianConfig,
                searchSpace: {
                    ...prev.bayesianConfig.searchSpace,
                    [param]: { ...prev.bayesianConfig.searchSpace[param], [field]: value }
                }
            }
        }));
    };

    const applyPreset = (presetValue) => {
        const preset = presetOptions.find(option => option.value === presetValue);
        if (!preset) return;
        setConfig(prev => ({
            ...prev,
            ...preset.config,
        }));
    };
    const applyAugmentationPreset = (presetValue) => {
        const preset = augmentationPresets.find(option => option.value === presetValue);
        if (!preset) return;
        setConfig(prev => {
            const current = { ...DEFAULT_AUGMENTATION_CONFIG, ...(prev.augmentation || {}) };
            if (preset.config) {
                return {
                    ...prev,
                    augmentation: {
                        ...current,
                        ...preset.config,
                        preset: preset.value,
                    },
                };
            }
            return {
                ...prev,
                augmentation: {
                    ...current,
                    preset: preset.value,
                },
            };
        });
    };
    const handleAugmentationChange = (key, value) => {
        setConfig(prev => ({
            ...prev,
            augmentation: {
                ...DEFAULT_AUGMENTATION_CONFIG,
                ...(prev.augmentation || {}),
                [key]: value,
                preset: 'custom',
            },
        }));
    };
    const coerceNumber = (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    };

    const resolveDevice = (compute) => (compute === 'cpu' ? 'cpu' : 0);

    const getSplitName = useCallback((groupName) => {
        if (!groupName) return "train";
        const normalized = String(groupName).toLowerCase();
        if (normalized === "training") return "train";
        if (normalized === "inference" || normalized === "validation" || normalized === "val") return "val";
        if (normalized === "test" || normalized === "testing") return "test";
        return "train";
    }, []);

    const clamp01 = useCallback((value) => Math.min(1, Math.max(0, value)), []);

    const normalizeNumber = useCallback((value) => {
        if (!Number.isFinite(value)) return "0";
        return Number(value).toFixed(6);
    }, []);

    const parseClassIndex = useCallback((value) => {
        if (value === undefined || value === null) return null;
        if (typeof value === "number" && Number.isInteger(value)) return value;
        const text = String(value).trim();
        if (!text) return null;
        const numeric = Number(text);
        if (Number.isInteger(numeric)) return numeric;
        const match = text.match(/^class\s*(\d+)$/i);
        return match ? Number(match[1]) : null;
    }, []);

    const resolveAnnotationClassIndex = useCallback((annotation, classNames) => {
        if (!annotation) return { index: null, reason: "missing" };
        if (!Array.isArray(classNames) || classNames.length === 0) {
            return { index: null, reason: "no-classes" };
        }
        const direct =
            annotation.class ??
            annotation.label ??
            annotation.class_name ??
            annotation.name ??
            annotation.predicted_class;
        if (direct !== undefined && direct !== null && String(direct).trim() !== "") {
            const directText = String(direct).trim();
            const directIndex = classNames.indexOf(directText);
            if (directIndex >= 0) return { index: directIndex, reason: "name" };
            const numeric = parseClassIndex(directText);
            if (numeric !== null && classNames[numeric]) {
                return { index: numeric, reason: "index" };
            }
            return { index: null, reason: "mismatch" };
        }
        const rawId =
            annotation.class_id ??
            annotation.classId ??
            annotation.classIndex ??
            annotation.category_id ??
            annotation.categoryId;
        const numericId = parseClassIndex(rawId);
        if (numericId !== null && classNames[numericId]) {
            return { index: numericId, reason: "index" };
        }
        if (classNames.length === 1) {
            return { index: 0, reason: "default" };
        }
        return { index: null, reason: "missing" };
    }, [parseClassIndex]);

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

    const getImageSize = useCallback((imageRow) => {
        const raw = imageRow?.annotations;
        if (raw?.image_natural_size?.width && raw?.image_natural_size?.height) {
            return raw.image_natural_size;
        }
        if (imageRow?.image_natural_size?.width && imageRow?.image_natural_size?.height) {
            return imageRow.image_natural_size;
        }
        if (imageRow?.width && imageRow?.height) {
            return { width: imageRow.width, height: imageRow.height };
        }
        return null;
    }, []);

    const buildLabelContent = useCallback((imageRow, classNames) => {
        const annotations = extractAnnotations(imageRow);
        const size = getImageSize(imageRow);
        if (!size || !size.width || !size.height) {
            return { content: "", hasLabels: false, stats: { total: 0, missing: 0, mismatched: 0 } };
        }
        const lines = [];
        let total = 0;
        let missing = 0;
        let mismatched = 0;
        annotations.forEach((annotation) => {
            if (!annotation) return;
            if (annotation.status && ["deleted", "disabled", "archived"].includes(String(annotation.status))) {
                return;
            }
            const type = annotation.type || annotation.shape;
            total += 1;
            const { index: classIndex, reason } = resolveAnnotationClassIndex(annotation, classNames);
            if (classIndex === null) {
                if (reason === "mismatch") {
                    mismatched += 1;
                } else {
                    missing += 1;
                }
                return;
            }

            if (type === "bbox" || type === "rectangle") {
                const width = annotation.width;
                const height = annotation.height;
                const x = annotation.x;
                const y = annotation.y;
                if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return;
                }
                const cx = clamp01((x + width / 2) / size.width);
                const cy = clamp01((y + height / 2) / size.height);
                const w = clamp01(width / size.width);
                const h = clamp01(height / size.height);
                lines.push([
                    classIndex,
                    normalizeNumber(cx),
                    normalizeNumber(cy),
                    normalizeNumber(w),
                    normalizeNumber(h),
                ].join(" "));
                return;
            }

            if (type === "polygon" || type === "segmentation" || type === "brush") {
                const points = annotation.points || annotation.vertices;
                if (!Array.isArray(points) || points.length < 3) return;
                const coords = points.flatMap((point) => {
                    const px = clamp01(point.x / size.width);
                    const py = clamp01(point.y / size.height);
                    return [normalizeNumber(px), normalizeNumber(py)];
                });
                lines.push([classIndex, ...coords].join(" "));
            }
        });
        return { content: lines.join("\n"), hasLabels: lines.length > 0, stats: { total, missing, mismatched } };
    }, [clamp01, extractAnnotations, getImageSize, normalizeNumber, resolveAnnotationClassIndex]);

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
            if (enforceClasses) {
                const { index: classIndex } = resolveAnnotationClassIndex(annotation, classNames);
                if (classIndex === null) return;
            } else {
                const className = annotation.class || annotation.label;
                if (!className) return;
            }
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
    }, [extractAnnotations, resolveAnnotationClassIndex]);

    const getClassNames = useCallback((stepSnapshot) => {
        return (stepSnapshot?.classes || stepData?.classes || []).filter(Boolean);
    }, [stepData?.classes]);

    const refreshDatasetSummary = useCallback(async (stepSnapshot) => {
        if (!stepId) return;
        setIsCheckingDataset(true);
        try {
            let activeStep = stepSnapshot;
            if (!activeStep) {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                activeStep = freshStep;
            }
            const classNames = getClassNames(activeStep);
            const stepImages = await listStepImages(stepId);
            const splits = { train: 0, val: 0, test: 0 };
            let labeled = 0;
            const labelTypes = { boxes: 0, segments: 0 };

            stepImages.forEach((imageRow) => {
                const splitName = getSplitName(imageRow.image_group);
                if (splitName === "train") splits.train += 1;
                if (splitName === "val") splits.val += 1;
                if (splitName === "test") splits.test += 1;
                const counts = getAnnotationTypeCounts(imageRow, classNames);
                labelTypes.boxes += counts.boxes;
                labelTypes.segments += counts.segments;

                if (classNames.length > 0) {
                    const { hasLabels } = buildLabelContent(imageRow, classNames);
                    if (hasLabels) labeled += 1;
                } else {
                    const annotations = extractAnnotations(imageRow);
                    if (annotations.length > 0) labeled += 1;
                }
            });

            const total = stepImages.length;
            const ready = total > 0 && labeled > 0 && classNames.length > 0;
            setDatasetSummary({
                total,
                labeled,
                splits,
                classesCount: classNames.length,
                labelTypes,
                ready,
            });
        } catch (error) {
            console.warn("Failed to load dataset summary:", error);
            setDatasetSummary(null);
        } finally {
            setIsCheckingDataset(false);
        }
    }, [
        buildLabelContent,
        extractAnnotations,
        getAnnotationTypeCounts,
        getClassNames,
        getSplitName,
        stepId,
    ]);

    useEffect(() => {
        if (!open) {
            hasInitializedRef.current = false;
            lastStepIdRef.current = null;
            return;
        }

        const stepChanged = lastStepIdRef.current !== stepId;
        if (hasInitializedRef.current && !stepChanged) {
            return;
        }

        hasInitializedRef.current = true;
        lastStepIdRef.current = stepId;

        let isMounted = true;
        const newVersion = (existingRuns?.length || 0) + 1;
        const safeTitle = stepTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'training';
        const linkedYamlPath = stepData?.dataset_yaml_path || stepData?.dataset_yaml_url || "";
        const linkedYamlDisplay = stepData?.dataset_yaml_url || stepData?.dataset_yaml_path || "";

        setFormError("");
        setShowAdvancedSettings(false);
        setDatasetStatus({ state: "idle", message: "", processed: 0, total: 0 });
        setDatasetSummary(null);
        setSelectedPreset('balanced');

        const defaultPreset = presetOptions[0];
        setConfig(prev => ({
            ...prev,
            ...defaultPreset.config,
            augmentation: { ...DEFAULT_AUGMENTATION_CONFIG },
            runName: `${safeTitle}_v${newVersion}`,
            dataYaml: linkedYamlPath || prev.dataYaml
        }));
        setAutoYamlSource({ path: linkedYamlPath, display: linkedYamlDisplay });

        const refreshYaml = async () => {
            if (!stepId) return;
            try {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                if (!isMounted || !freshStep) return;
                let freshYamlPath = freshStep.dataset_yaml_path || freshStep.dataset_yaml_url || "";
                let freshYamlDisplay = freshStep.dataset_yaml_url || freshStep.dataset_yaml_path || "";
                await refreshDatasetSummary(freshStep);
                if (!freshYamlPath || freshYamlPath === linkedYamlPath) return;
                setConfig(prev => {
                    if (prev.dataYaml && prev.dataYaml !== linkedYamlPath) {
                        return prev;
                    }
                    return { ...prev, dataYaml: freshYamlPath };
                });
                setAutoYamlSource({ path: freshYamlPath, display: freshYamlDisplay });
            } catch (error) {
                console.warn("Failed to refresh dataset YAML:", error);
            }
        };

        refreshYaml();

        return () => {
            isMounted = false;
        };
    }, [open, stepId, stepTitle, existingRuns, stepData, buildDatasetYaml, refreshDatasetSummary]);

    const ensureDatasetExport = async ({ projectId, stepId: activeStepId, classNames }) => {
        const stepImages = await listStepImages(activeStepId);
        if (!stepImages.length) {
            setFormError("No images found for this step. Upload or annotate images before training.");
            return { ok: false };
        }
        if (!Array.isArray(classNames) || classNames.length === 0) {
            setFormError("Add at least one class before starting training.");
            return { ok: false };
        }
        const hasTestSplit = stepImages.some((imageRow) => getSplitName(imageRow.image_group) === "test");
        let hasAnyLabels = false;
        let labeledCount = 0;
        const total = stepImages.length;
        const labelTypes = { boxes: 0, segments: 0 };
        let missingLabels = 0;
        let mismatchedLabels = 0;
        let processed = 0;
        setDatasetStatus(prev => ({
            ...prev,
            state: "preparing",
            processed: 0,
            total,
            message: total ? `Preparing dataset 0/${total}` : "Preparing dataset..."
        }));

        const updateProgress = () => {
            processed += 1;
            setDatasetStatus(prev => ({
                ...prev,
                state: "preparing",
                processed,
                total,
                message: `Preparing dataset ${processed}/${total}`
            }));
        };

        await runWithConcurrency(stepImages, DATASET_EXPORT_CONCURRENCY, async (imageRow) => {
            const splitName = getSplitName(imageRow.image_group);
            const stepImagePath = getStoragePathFromUrl(imageRow.image_url, STEP_IMAGES_BUCKET);
            const datasetImagePathFromUrl = getStoragePathFromUrl(imageRow.image_url, DATASET_BUCKET);
            const storageImageName = (datasetImagePathFromUrl || stepImagePath)?.split("/").pop();
            const imageName = storageImageName
                || imageRow.image_name
                || imageRow.file_name
                || imageRow.name
                || `image-${imageRow.id || Date.now()}.jpg`;

            const datasetImagePath = `${projectId}/${activeStepId}/images/${splitName}/${imageName}`;
            const existingDatasetPath = datasetImagePathFromUrl;
            if (!existingDatasetPath || existingDatasetPath !== datasetImagePath) {
                if (imageRow.image_url) {
                    let imageUrl = imageRow.image_url;
                    const signedCandidates = [];
                    if (datasetImagePathFromUrl) {
                        signedCandidates.push({ bucket: DATASET_BUCKET, path: datasetImagePathFromUrl });
                    }
                    if (stepImagePath) {
                        signedCandidates.push({ bucket: STEP_IMAGES_BUCKET, path: stepImagePath });
                    }
                    for (const candidate of signedCandidates) {
                        try {
                            const signed = await createSignedImageUrl(candidate.bucket, candidate.path, {
                                expiresIn: 600,
                            });
                            if (signed) {
                                imageUrl = signed;
                                break;
                            }
                        } catch (error) {
                            console.warn("Failed to create signed image URL, falling back to raw URL.", error);
                        }
                    }
                    const response = await fetch(imageUrl);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch image ${imageName}`);
                    }
                    const blob = await response.blob();
                    await uploadToSupabaseStorage(blob, datasetImagePath, {
                        bucket: DATASET_BUCKET,
                        contentType: blob.type || "image/jpeg",
                    });
                }
            }

            const counts = getAnnotationTypeCounts(imageRow, classNames);
            labelTypes.boxes += counts.boxes;
            labelTypes.segments += counts.segments;
            const { content, hasLabels, stats } = buildLabelContent(imageRow, classNames);
            if (stats) {
                missingLabels += stats.missing;
                mismatchedLabels += stats.mismatched;
            }
            hasAnyLabels = hasAnyLabels || hasLabels;
            if (hasLabels) labeledCount += 1;
            const labelContent = content || "";
            const labelName = imageName.replace(/\.[^/.]+$/, "");
            const labelPath = `${projectId}/${activeStepId}/labels/${splitName}/${labelName}.txt`;
            const labelBlob = new Blob([labelContent], { type: "text/plain" });
            await uploadToSupabaseStorage(labelBlob, labelPath, {
                bucket: DATASET_BUCKET,
                contentType: "text/plain",
            });
            updateProgress();
        });

        if (!hasAnyLabels) {
            if (mismatchedLabels > 0) {
                setFormError("Annotations use classes that are not in this step. Update the class list or relabel.");
            } else if (missingLabels > 0) {
                setFormError("Annotations are missing class labels. Assign labels or add a single class to auto-assign.");
            } else {
                setFormError("No annotations found for this step. Add labels in the annotation studio before training.");
            }
            return { ok: false };
        }

        return { ok: true, hasTestSplit, labeledCount, total, labelTypes };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let dataYamlValue = (config.dataYaml || autoYamlSource.path || "").trim();
        setFormError("");
        setDatasetStatus({ state: "preparing", message: "Preparing dataset...", processed: 0, total: 0 });
        setIsSubmitting(true);
        
        try {
            if (stepId) {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                const projectId = freshStep?.project_id || stepData?.project_id;
                const classNames = (freshStep?.classes || stepData?.classes || []).filter(Boolean);
                if (!projectId) {
                    setFormError("Missing project information for this step.");
                    setDatasetStatus({ state: "error", message: "Missing project information.", processed: 0, total: 0 });
                    return;
                }
                const exportResult = await ensureDatasetExport({
                    projectId,
                    stepId,
                    classNames,
                });
                if (!exportResult?.ok) {
                    setDatasetStatus({ state: "error", message: "Dataset not ready. Add images and labels, then try again.", processed: 0, total: 0 });
                    return;
                }
                setDatasetStatus({
                    state: "ready",
                    message: "Dataset prepared and ready for training.",
                    processed: exportResult.total,
                    total: exportResult.total
                });
                setDatasetSummary(prev => ({
                    total: exportResult.total,
                    labeled: exportResult.labeledCount,
                    splits: prev?.splits || { train: 0, val: 0, test: 0 },
                    classesCount: prev?.classesCount || classNames.length,
                    labelTypes: exportResult.labelTypes || prev?.labelTypes || { boxes: 0, segments: 0 },
                    ready: classNames.length > 0 && exportResult.total > 0 && exportResult.labeledCount > 0,
                }));
                if (!dataYamlValue) {
                    const yamlContent = buildDatasetYaml(classNames);
                    const blob = new Blob([yamlContent], { type: "text/plain" });
                    const storagePath = `${projectId}/${stepId}/data.yaml`;
                    const { path, publicUrl } = await uploadToSupabaseStorage(blob, storagePath, {
                        bucket: DATASET_BUCKET,
                        contentType: "text/plain",
                    });
                    await SOPStep.update(stepId, {
                        dataset_yaml_path: `storage:${DATASET_BUCKET}/${path}`,
                        dataset_yaml_url: publicUrl,
                        dataset_yaml_name: "data.yaml",
                    });
                    dataYamlValue = `storage:${DATASET_BUCKET}/${path}`;
                    setConfig(prev => ({ ...prev, dataYaml: dataYamlValue }));
                    setAutoYamlSource({ path: dataYamlValue, display: publicUrl });
                }
            }
            if (!dataYamlValue && stepId) {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                const projectId = freshStep?.project_id || stepData?.project_id;
                if (projectId) {
                    const yamlContent = buildDatasetYaml(freshStep?.classes || stepData?.classes || []);
                    const blob = new Blob([yamlContent], { type: "text/plain" });
                    const storagePath = `${projectId}/${stepId}/data.yaml`;
                    const { path, publicUrl } = await uploadToSupabaseStorage(blob, storagePath, {
                        bucket: DATASET_BUCKET,
                        contentType: "text/plain",
                    });
                    await SOPStep.update(stepId, {
                        dataset_yaml_path: `storage:${DATASET_BUCKET}/${path}`,
                        dataset_yaml_url: publicUrl,
                        dataset_yaml_name: "data.yaml",
                    });
                    dataYamlValue = `storage:${DATASET_BUCKET}/${path}`;
                    setConfig(prev => ({ ...prev, dataYaml: dataYamlValue }));
                    setAutoYamlSource({ path: dataYamlValue, display: publicUrl });
                }
            }
            if (!dataYamlValue) {
                setFormError("Dataset YAML is not linked to this step. Upload images or attach a dataset YAML before starting training.");
                setDatasetStatus({ state: "error", message: "Dataset YAML missing.", processed: 0, total: 0 });
                return;
            }
            await onSubmit({
                step_id: stepId,
                run_name: config.runName,
                base_model: config.baseModel,
                data_yaml: dataYamlValue,
                status: 'queued',
                configuration: {
                    ...config,
                    device: resolveDevice(config.compute),
                },
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error starting training:', error);
            setFormError("Failed to start training. Please try again.");
            setDatasetStatus({ state: "error", message: "Failed to prepare dataset.", processed: 0, total: 0 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const datasetReady = !datasetSummary || datasetSummary.ready;
    const datasetStatusLabel = datasetSummary
        ? (datasetSummary.ready ? "Ready" : "Needs attention")
        : "Not checked";
    const datasetStatusClass = datasetSummary
        ? (datasetSummary.ready ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")
        : "bg-gray-100 text-gray-700";
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
    const fieldBaseClass = "bg-white/95 border-amber-200 text-slate-900 placeholder:text-slate-500 shadow-md shadow-amber-100/60 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:border-amber-400 hover:border-amber-300";
    const selectContentClass = "border-amber-200 bg-white/95 text-slate-900 shadow-lg shadow-amber-100/60";
    const selectItemClass = "focus:bg-amber-50 focus:text-amber-900 data-[state=checked]:bg-amber-100 data-[state=checked]:text-amber-900";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl glass-effect border-0 p-0 overflow-hidden">
                <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-teal-50 px-8 pt-6 pb-5">
                    <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
                    <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-teal-200/40 blur-3xl" />
                    <DialogHeader className="relative space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shadow-sm">
                                        <Sparkles className="w-5 h-5" />
                                    </span>
                                    Start New Training Run
                                </DialogTitle>
                                <DialogDescription className="text-sm text-slate-600">
                                    Configure and launch a new model training job for step: &quot;{stepTitle}&quot;
                                </DialogDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-slate-900 text-white">Training Studio</Badge>
                                <Badge variant="outline" className="border-amber-200 bg-white/70 text-amber-700">
                                    {trainerOffline ? "Queue Mode" : "Live Trainer"}
                                </Badge>
                                <Badge variant="outline" className="border-teal-200 bg-white/70 text-teal-700">
                                    Dataset {datasetStatusLabel}
                                </Badge>
                            </div>
                        </div>
                    </DialogHeader>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-8 pb-6 pt-4">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="font-semibold text-gray-900">Dataset status</h3>
                            <Badge variant="secondary" className={datasetStatusClass}>
                                {datasetStatusLabel}
                            </Badge>
                        </div>

                        {trainerOffline && (
                            <Alert className="border-amber-300 bg-amber-50">
                                <AlertTitle className="text-amber-900">Trainer offline</AlertTitle>
                                <AlertDescription className="text-amber-800">
                                    Runs will stay queued until a trainer worker is online. You can still queue this run now.
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-amber-100/60 backdrop-blur">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 text-sm text-slate-700">
                                    <p><span className="font-medium">Images:</span> {datasetSummary ? datasetSummary.total : (isCheckingDataset ? "Checking..." : "Not checked")}</p>
                                    <p><span className="font-medium">Labeled images:</span> {datasetSummary ? datasetSummary.labeled : "n/a"}</p>
                                    <p><span className="font-medium">Splits:</span> train {datasetSummary?.splits?.train ?? "n/a"} / val {datasetSummary?.splits?.val ?? "n/a"} / test {datasetSummary?.splits?.test ?? "n/a"}</p>
                                    <p><span className="font-medium">Classes:</span> {datasetSummary ? datasetSummary.classesCount : "n/a"}</p>
                                    <p><span className="font-medium">Annotation types:</span> {annotationTypeLabel}</p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refreshDatasetSummary()}
                                    disabled={isCheckingDataset || isSubmitting || !stepId}
                                    className="border-amber-200 text-amber-700 hover:bg-amber-50"
                                >
                                    {isCheckingDataset ? "Refreshing..." : "Refresh"}
                                </Button>
                            </div>

                            <div className="mt-3 text-xs text-slate-600">
                                {autoYamlSource.path ? (
                                    <span>Dataset YAML linked: {autoYamlSource.display || autoYamlSource.path}</span>
                                ) : (
                                    <span>Dataset YAML missing. It will be generated when training starts.</span>
                                )}
                            </div>

                            {datasetSummary?.classesCount === 0 && (
                                <div className="mt-3 text-xs text-amber-700">
                                    No classes defined for this step. Add class names before training.
                                </div>
                            )}

                            {datasetSummary?.total === 0 && (
                                <div className="mt-3 text-xs text-amber-700">
                                    No images found for this step. Upload images before training.
                                </div>
                            )}

                            {datasetSummary?.total > 0 && datasetSummary?.labeled === 0 && (
                                <div className="mt-3 text-xs text-amber-700">
                                    No labeled images found. Add annotations to produce meaningful training results.
                                </div>
                            )}

                            {hasMixedLabels && (
                                <div className="mt-3 text-xs text-amber-700">
                                    Mixed box and polygon labels detected. Use only boxes for detection or only polygons for segmentation.
                                </div>
                            )}
                        </div>

                        {datasetStatus.state === "preparing" && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                <div className="flex items-center justify-between text-sm text-blue-900">
                                    <span>Preparing dataset...</span>
                                    <span>{datasetStatus.processed}/{datasetStatus.total}</span>
                                </div>
                                <Progress value={datasetStatus.total ? (datasetStatus.processed / datasetStatus.total) * 100 : 0} className="mt-2" />
                                {datasetStatus.message && (
                                    <p className="text-xs text-blue-800 mt-2">{datasetStatus.message}</p>
                                )}
                            </div>
                        )}

                        {datasetStatus.state === "ready" && datasetStatus.message && (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                {datasetStatus.message}
                            </div>
                        )}

                        {datasetStatus.state === "error" && datasetStatus.message && (
                            <Alert variant="destructive">
                                <AlertDescription>{datasetStatus.message}</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}

                    <Separator />

                    <Tabs defaultValue="fast" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="fast">Fast Start</TabsTrigger>
                            <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        </TabsList>

                        <TabsContent value="fast" className="space-y-6 mt-4">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <h3 className="font-semibold text-gray-900">Basic configuration</h3>
                                </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Give your model version a unique, descriptive name so you can easily identify it later.">Run name</TooltipLabel>
                            <Input
                                id="runName"
                                value={config.runName}
                                onChange={e => handleConfigChange('runName', e.target.value)}
                                placeholder="e.g., Button_Detection_v1"
                                className={fieldBaseClass}
                            />
                        </div>

                        <div>
                            <TooltipLabel tooltipText="Presets apply recommended training settings for speed or accuracy.">Preset</TooltipLabel>
                            <Select
                                value={selectedPreset}
                                onValueChange={(value) => {
                                    setSelectedPreset(value);
                                    applyPreset(value);
                                }}
                            >
                                <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                <SelectContent className={selectContentClass}>
                                    {presetOptions.map(option => (
                                        <SelectItem key={option.value} value={option.value} className={selectItemClass}>
                                            <div className="flex flex-col">
                                                <span>{option.label}</span>
                                                <span className="text-gray-500 text-xs">{option.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {activePreset && (
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                                <p className="font-medium">{activePreset.label} preset</p>
                                <p className="text-xs text-blue-800 mt-1">{activePreset.summary}</p>
                                <p className="text-xs text-blue-700 mt-2">Advanced edits override preset values.</p>
                            </div>
                        )}
                        
                        <div>
                            <TooltipLabel tooltipText="Choose a starting checkpoint. Pretrained models are best for first runs, while your runs let you fine-tune further.">Base model</TooltipLabel>
                            <Select value={config.baseModel} onValueChange={value => handleConfigChange('baseModel', value)}>
                                <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                <SelectContent className={selectContentClass}>
                                    {dynamicModelOptions.map((group, index) => (
                                        <SelectGroup key={group.label || `group-${index}`}>
                                            <SelectLabel className="px-2 py-1.5 text-xs font-semibold">{group.label}</SelectLabel>
                                            {group.options.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                                                    <div className="flex flex-col">
                                                        <span>{opt.label}</span>
                                                        <span className="text-gray-500 text-xs">{opt.description}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Choose your training hardware. Standard GPU is cost-effective and suitable for most projects.">Compute</TooltipLabel>
                            <Select value={config.compute} onValueChange={value => handleConfigChange('compute', value)}>
                                <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                <SelectContent className={selectContentClass}>
                                    {computeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                                <span className="text-gray-500 text-xs">{opt.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <TooltipLabel tooltipText="Random transforms that improve generalization. Standard matches YOLO defaults.">Augmentation preset</TooltipLabel>
                            <Select value={augmentationConfig.preset} onValueChange={value => applyAugmentationPreset(value)}>
                                <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                <SelectContent className={selectContentClass}>
                                    {augmentationPresets.map(option => (
                                        <SelectItem key={option.value} value={option.value} className={selectItemClass}>
                                            <div className="flex flex-col">
                                                <span>{option.label}</span>
                                                <span className="text-gray-500 text-xs">{option.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {activeAugmentationPreset && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <p className="font-medium">{activeAugmentationPreset.label} augmentation</p>
                                <p className="text-xs text-amber-800 mt-1">{activeAugmentationPreset.summary}</p>
                                <p className="text-xs text-amber-700 mt-2">Fine-tune in Advanced if needed.</p>
                            </div>
                        )}
                    </div>

                    <Separator />
                    
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <h3 className="font-semibold text-gray-900">Training settings</h3>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Defaults</Badge>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-green-900 mb-1">Beginner Tip</h4>
                                    <p className="text-sm text-green-800">These settings work well for most annotation projects. Train your first model with these defaults, then use the Advanced tab to fine-tune if needed.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <TooltipLabel tooltipText="How many times the model will see your entire dataset. 100 epochs is a good starting point - enough to learn well without taking too long.">Epochs (Recommended: 100)</TooltipLabel>
                                <Input 
                                    type="number" 
                                    value={config.epochs} 
                                    onChange={e => handleConfigChange('epochs', parseInt(e.target.value))} 
                                    className={`${fieldBaseClass} ${config.epochs === 100 ? "border-green-500" : ""}`} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.epochs.enabled}
                                />
                            </div>
                            <div>
                                <TooltipLabel tooltipText="How many images to process together. 16 is a sweet spot - fast training without using too much memory.">Batch Size (Recommended: 16)</TooltipLabel>
                                <Select 
                                    value={String(config.batchSize)} 
                                    onValueChange={value => handleConfigChange('batchSize', parseInt(value))} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.batchSize.enabled}
                                >
                                    <SelectTrigger className={`${fieldBaseClass} ${config.batchSize === 16 ? "border-green-500" : ""}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className={selectContentClass}>
                                        <SelectItem value="8" className={selectItemClass}>8 (Slower, less memory)</SelectItem>
                                        <SelectItem value="16" className={selectItemClass}>16 (Recommended)</SelectItem>
                                        <SelectItem value="32" className={selectItemClass}>32 (Faster, more memory)</SelectItem>
                                        <SelectItem value="64" className={selectItemClass}>64 (Advanced)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <TooltipLabel tooltipText="Images will be resized to this size for training. 640 pixels is perfect for most detection tasks - big enough to see details, not too slow.">Image Size (Recommended: 640)</TooltipLabel>
                                <Select 
                                    value={String(config.imgSize)} 
                                    onValueChange={value => handleConfigChange('imgSize', parseInt(value))} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.imgSize.enabled}
                                >
                                    <SelectTrigger className={`${fieldBaseClass} ${config.imgSize === 640 ? "border-green-500" : ""}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className={selectContentClass}>
                                        <SelectItem value="320" className={selectItemClass}>320px (Fastest)</SelectItem>
                                        <SelectItem value="640" className={selectItemClass}>640px (Recommended)</SelectItem>
                                        <SelectItem value="1280" className={selectItemClass}>1280px (High detail)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <TooltipLabel tooltipText="How fast the model learns. 0.001 is a safe, proven value that works well with Adam optimizer.">Learning Rate (Recommended: 0.001)</TooltipLabel>
                                <Input 
                                    type="number" 
                                    step="0.0001" 
                                    value={config.learningRate} 
                                    onChange={e => handleConfigChange('learningRate', parseFloat(e.target.value))} 
                                    className={`${fieldBaseClass} ${config.learningRate === 0.001 ? "border-green-500" : ""}`} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.learningRate.enabled}
                                />
                            </div>
                        </div>
                    </div>
                        </TabsContent>

                        <TabsContent value="advanced" className="space-y-6 mt-4">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="font-semibold text-gray-900">Data augmentation</h3>
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">YOLOv8</Badge>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <TooltipLabel tooltipText="Hue jitter amount. Typical range: 0 to 0.1.">HSV Hue</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.005"
                                                min="0"
                                                max="0.1"
                                                value={augmentationConfig.hsv_h}
                                                onChange={e => handleAugmentationChange('hsv_h', coerceNumber(e.target.value, augmentationConfig.hsv_h))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Saturation jitter amount. Typical range: 0 to 1.">HSV Saturation</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.hsv_s}
                                                onChange={e => handleAugmentationChange('hsv_s', coerceNumber(e.target.value, augmentationConfig.hsv_s))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Value/brightness jitter amount. Typical range: 0 to 1.">HSV Value</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.hsv_v}
                                                onChange={e => handleAugmentationChange('hsv_v', coerceNumber(e.target.value, augmentationConfig.hsv_v))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Rotation range in degrees.">Rotate (degrees)</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="45"
                                                value={augmentationConfig.degrees}
                                                onChange={e => handleAugmentationChange('degrees', coerceNumber(e.target.value, augmentationConfig.degrees))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Translate fraction of image size.">Translate</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                max="0.5"
                                                value={augmentationConfig.translate}
                                                onChange={e => handleAugmentationChange('translate', coerceNumber(e.target.value, augmentationConfig.translate))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Scale gain. 0.5 means 50% zoom in/out range.">Scale</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="2"
                                                value={augmentationConfig.scale}
                                                onChange={e => handleAugmentationChange('scale', coerceNumber(e.target.value, augmentationConfig.scale))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Horizontal flip probability.">Flip Left/Right</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.fliplr}
                                                onChange={e => handleAugmentationChange('fliplr', coerceNumber(e.target.value, augmentationConfig.fliplr))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Vertical flip probability.">Flip Up/Down</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.flipud}
                                                onChange={e => handleAugmentationChange('flipud', coerceNumber(e.target.value, augmentationConfig.flipud))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Mosaic probability.">Mosaic</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.mosaic}
                                                onChange={e => handleAugmentationChange('mosaic', coerceNumber(e.target.value, augmentationConfig.mosaic))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Mixup probability.">Mixup</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.mixup}
                                                onChange={e => handleAugmentationChange('mixup', coerceNumber(e.target.value, augmentationConfig.mixup))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                        <div>
                                            <TooltipLabel tooltipText="Copy-paste probability (segmentation only).">Copy-Paste</TooltipLabel>
                                            <Input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                max="1"
                                                value={augmentationConfig.copy_paste}
                                                onChange={e => handleAugmentationChange('copy_paste', coerceNumber(e.target.value, augmentationConfig.copy_paste))}
                                                className={fieldBaseClass}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <h3 className="font-semibold text-gray-900">Advanced optimization</h3>
                                        <Badge variant="secondary" className="bg-purple-100 text-purple-800">For experienced users</Badge>
                                    </div>

                                <div>
                                    <TooltipLabel tooltipText="The optimization algorithm. Adam is highly recommended as it works well for most tasks and is very reliable.">Optimizer</TooltipLabel>
                                    <Select value={config.optimizer} onValueChange={value => handleConfigChange('optimizer', value)}>
                                        <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                        <SelectContent className={selectContentClass}>
                                            <SelectItem value="Adam" className={selectItemClass}>Adam (Recommended - Works great for most tasks)</SelectItem>
                                            <SelectItem value="AdamW" className={selectItemClass}>AdamW (Advanced - Better for large models)</SelectItem>
                                            <SelectItem value="SGD" className={selectItemClass}>SGD (Classic - Requires careful tuning)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                        
                        <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex-1">
                                <h4 className="font-medium text-purple-900 mb-1">Automatic parameter tuning</h4>
                                <p className="text-sm text-purple-800">Use Bayesian optimization to search for better hyperparameters after your first baseline run.</p>
                            </div>
                            <Switch checked={showAdvancedSettings} onCheckedChange={setShowAdvancedSettings}/>
                        </div>
                        
                        <AnimatePresence>
                            {showAdvancedSettings && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: "auto" }} 
                                    exit={{ opacity: 0, height: 0 }} 
                                    transition={{ duration: 0.3 }} 
                                    className="overflow-hidden space-y-6 pt-4 border-t border-purple-200"
                                >
                                    <div>
                                        <TooltipLabel tooltipText="Choose 'Manual' to set hyperparameters yourself, or 'Bayesian' to let the system automatically find the optimal settings.">Optimization strategy</TooltipLabel>
                                        <Select value={config.optimizationStrategy} onValueChange={value => handleConfigChange('optimizationStrategy', value)}>
                                            <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                            <SelectContent className={selectContentClass}>
                                                <SelectItem value="manual" className={selectItemClass}>Manual tuning</SelectItem>
                                                <SelectItem value="bayesian" className={selectItemClass}>Bayesian optimization</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {config.optimizationStrategy === 'manual' && (
                                        <Alert className="border-blue-300 bg-blue-50">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-blue-800">Manual tuning active</AlertTitle>
                                            <AlertDescription className="text-blue-700">
                                                Use the settings in the Fast Start tab for this run.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {config.optimizationStrategy === 'bayesian' && (
                                        <div className="space-y-6">
                                            <Alert className="border-purple-300 bg-purple-50">
                                                <Info className="h-4 w-4 text-purple-600" />
                                                <AlertTitle className="text-purple-800">Bayesian optimization active</AlertTitle>
                                                <AlertDescription className="text-purple-700">
                                                    Enable specific parameters below to include them in the search.
                                                </AlertDescription>
                                            </Alert>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <TooltipLabel tooltipText="Objective function to optimize during training.">Optimization objective</TooltipLabel>
                                                    <Select value={config.bayesianConfig.objective} onValueChange={value => handleBayesianConfigChange('objective', value)}>
                                                        <SelectTrigger className={fieldBaseClass}><SelectValue /></SelectTrigger>
                                                        <SelectContent className={selectContentClass}>
                                                            <SelectItem value="maximize_mAP" className={selectItemClass}>Maximize mAP (Recommended)</SelectItem>
                                                            <SelectItem value="minimize_loss" className={selectItemClass}>Minimize Training Loss</SelectItem>
                                                            <SelectItem value="maximize_precision" className={selectItemClass}>Maximize Precision</SelectItem>
                                                            <SelectItem value="maximize_recall" className={selectItemClass}>Maximize Recall</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div>
                                                    <TooltipLabel tooltipText="Number of different parameter combinations to try.">Number of trials</TooltipLabel>
                                                    <Input 
                                                        type="number" 
                                                        value={config.bayesianConfig.numTrials} 
                                                        onChange={e => handleBayesianConfigChange('numTrials', parseInt(e.target.value))} 
                                                        min="5" 
                                                        max="100"
                                                        className={fieldBaseClass}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                            <TooltipLabel tooltipText="Maximum time to spend on optimization (in hours).">Max duration (hours)</TooltipLabel>
                                                <Input 
                                                    type="number" 
                                                    value={config.bayesianConfig.maxDuration} 
                                                    onChange={e => handleBayesianConfigChange('maxDuration', parseInt(e.target.value))} 
                                                    min="1" 
                                                    max="48"
                                                    className={fieldBaseClass}
                                                />
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <h4 className="font-medium text-gray-900">Parameter search space</h4>
                                                <p className="text-sm text-gray-600">Enable parameters you want the optimizer to tune automatically:</p>
                                                
                                                {/* Epochs */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.epochs.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('epochs', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Epochs</span>
                                                            <p className="text-xs text-gray-600">Search between {config.bayesianConfig.searchSpace.epochs.min} and {config.bayesianConfig.searchSpace.epochs.max}</p>
                                                        </div>
                                                    </div>
                                                    {config.bayesianConfig.searchSpace.epochs.enabled && (
                                                        <div className="flex gap-2">
                                                            <Input 
                                                                type="number" 
                                                                value={config.bayesianConfig.searchSpace.epochs.min} 
                                                                onChange={e => handleSearchSpaceChange('epochs', 'min', parseInt(e.target.value))}
                                                                className={`${fieldBaseClass} w-16 h-8 text-xs`}
                                                                placeholder="Min"
                                                            />
                                                            <Input 
                                                                type="number" 
                                                                value={config.bayesianConfig.searchSpace.epochs.max} 
                                                                onChange={e => handleSearchSpaceChange('epochs', 'max', parseInt(e.target.value))}
                                                                className={`${fieldBaseClass} w-16 h-8 text-xs`}
                                                                placeholder="Max"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Batch Size */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.batchSize.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('batchSize', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Batch Size</span>
                                                            <p className="text-xs text-gray-600">Choose from: {config.bayesianConfig.searchSpace.batchSize.options.join(', ')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Learning Rate */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.learningRate.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('learningRate', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Learning Rate</span>
                                                            <p className="text-xs text-gray-600">Search between {config.bayesianConfig.searchSpace.learningRate.min} and {config.bayesianConfig.searchSpace.learningRate.max}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Image Size */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.imgSize.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('imgSize', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Image Size</span>
                                                            <p className="text-xs text-gray-600">Choose from: {config.bayesianConfig.searchSpace.imgSize.options.join(', ')}px</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-slate-900 text-white hover:bg-slate-800"
                            disabled={isSubmitting || !config.runName || !stepId || !datasetReady}
                        >
                            {isSubmitting
                                ? (trainerOffline ? "Queueing..." : "Starting Training...")
                                : (trainerOffline ? "Queue Training" : "Start Training")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
