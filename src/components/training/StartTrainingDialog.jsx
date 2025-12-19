import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SOPStep } from '@/api/entities';
import { listStepImages } from '@/api/db';
import { createSignedImageUrl, getStoragePathFromUrl, uploadToSupabaseStorage } from '@/api/storage';

const TooltipLabel = ({ children, tooltipText }) => (
    <div className="flex items-center gap-1.5">
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

export default function StartTrainingDialog({ open, onOpenChange, onSubmit, stepId, stepTitle, existingRuns, stepData }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    const [formError, setFormError] = useState("");
    const [autoYamlSource, setAutoYamlSource] = useState("");
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
        if (!open) return;
        let isMounted = true;
        const newVersion = (existingRuns?.length || 0) + 1;
        const safeTitle = stepTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'training';
        const linkedYaml = stepData?.dataset_yaml_url || stepData?.dataset_yaml_path || "";

        setConfig(prev => ({
            ...prev,
            runName: `${safeTitle}_v${newVersion}`,
            dataYaml: linkedYaml || prev.dataYaml
        }));
        setAutoYamlSource(linkedYaml);

        const refreshYaml = async () => {
            if (!stepId) return;
            try {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                if (!isMounted || !freshStep) return;
                let freshYaml = freshStep.dataset_yaml_url || freshStep.dataset_yaml_path || "";
                if (!freshYaml) {
                    const projectId = freshStep.project_id || stepData?.project_id;
                    if (projectId) {
                        const yamlContent = buildDatasetYaml(freshStep.classes || []);
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
                        freshYaml = publicUrl;
                    }
                }
                if (!freshYaml || freshYaml === linkedYaml) return;
                setConfig(prev => {
                    if (prev.dataYaml && prev.dataYaml !== linkedYaml) {
                        return prev;
                    }
                    return { ...prev, dataYaml: freshYaml };
                });
                setAutoYamlSource(freshYaml);
            } catch (error) {
                console.warn("Failed to refresh dataset YAML:", error);
            }
        };

        refreshYaml();

        return () => {
            isMounted = false;
        };
    }, [open, stepId, stepTitle, existingRuns, stepData, buildDatasetYaml]);

    useEffect(() => {
        if (!autoYamlSource) return;
        setConfig(prev => (prev.dataYaml ? prev : { ...prev, dataYaml: autoYamlSource }));
    }, [autoYamlSource]);

    const dynamicModelOptions = useMemo(() => {
        const completedRuns = (existingRuns || []).filter(run => run.status === 'completed' && run.trained_model_url);
        if (completedRuns.length > 0) {
            return [
                { label: "Pre-trained Models", options: modelOptions },
                {
                    label: "Your Trained Models",
                    options: completedRuns.map(run => ({
                        value: run.id,
                        label: run.run_name,
                        description: `Completed on ${new Date(run.updated_date).toLocaleDateString()}. mAP: ${run.results?.mAP || 'N/A'}`
                    }))
                }
            ];
        }
        return [{ label: "Pre-trained Models", options: modelOptions }];
    }, [existingRuns]);

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

    const resolveDevice = (compute) => (compute === 'cpu' ? 'cpu' : 0);

    const getSplitName = (groupName) => {
        if (!groupName) return "train";
        const normalized = String(groupName).toLowerCase();
        if (normalized === "training") return "train";
        if (normalized === "inference" || normalized === "validation" || normalized === "val") return "val";
        if (normalized === "test" || normalized === "testing") return "test";
        return "train";
    };

    const clamp01 = (value) => Math.min(1, Math.max(0, value));

    const normalizeNumber = (value) => {
        if (!Number.isFinite(value)) return "0";
        return Number(value).toFixed(6);
    };

    const extractAnnotations = (imageRow) => {
        const raw = imageRow?.annotations;
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === "object") {
            if (Array.isArray(raw.annotations)) return raw.annotations;
            if (Array.isArray(raw.objects)) return raw.objects;
        }
        return [];
    };

    const getImageSize = (imageRow) => {
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
    };

    const buildLabelContent = (imageRow, classNames) => {
        const annotations = extractAnnotations(imageRow);
        const size = getImageSize(imageRow);
        if (!size || !size.width || !size.height) return { content: "", hasLabels: false };
        const lines = [];
        annotations.forEach((annotation) => {
            if (!annotation) return;
            if (annotation.status && ["deleted", "disabled", "archived"].includes(String(annotation.status))) {
                return;
            }
            const type = annotation.type || annotation.shape;
            const className = annotation.class || annotation.label;
            if (!className) return;
            const classIndex = classNames.indexOf(className);
            if (classIndex < 0) return;

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

            if (type === "polygon" || type === "segmentation") {
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
        return { content: lines.join("\n"), hasLabels: lines.length > 0 };
    };

    const ensureDatasetExport = async ({ projectId, stepId: activeStepId, classNames }) => {
        const stepImages = await listStepImages(activeStepId);
        if (!stepImages.length) {
            setFormError("No images found for this step. Upload or annotate images before training.");
            return { ok: false };
        }
        const hasTestSplit = stepImages.some((imageRow) => getSplitName(imageRow.image_group) === "test");
        let hasAnyLabels = false;

        for (const imageRow of stepImages) {
            const splitName = getSplitName(imageRow.image_group);
            const imageName = imageRow.image_name
                || imageRow.file_name
                || imageRow.name
                || getStoragePathFromUrl(imageRow.image_url, STEP_IMAGES_BUCKET)?.split("/").pop()
                || getStoragePathFromUrl(imageRow.image_url, DATASET_BUCKET)?.split("/").pop()
                || `image-${imageRow.id || Date.now()}.jpg`;

            const datasetImagePath = `${projectId}/${activeStepId}/images/${splitName}/${imageName}`;
            const existingDatasetPath = getStoragePathFromUrl(imageRow.image_url, DATASET_BUCKET);
            if (!existingDatasetPath || existingDatasetPath !== datasetImagePath) {
                if (imageRow.image_url) {
                    let imageUrl = imageRow.image_url;
                    const stepImagePath = getStoragePathFromUrl(imageRow.image_url, STEP_IMAGES_BUCKET);
                    if (stepImagePath) {
                        try {
                            imageUrl = await createSignedImageUrl(STEP_IMAGES_BUCKET, stepImagePath, {
                                expiresIn: 600,
                            });
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

            const { content, hasLabels } = buildLabelContent(imageRow, classNames);
            hasAnyLabels = hasAnyLabels || hasLabels;
            const labelContent = content || "";
            const labelName = imageName.replace(/\.[^/.]+$/, "");
            const labelPath = `${projectId}/${activeStepId}/labels/${splitName}/${labelName}.txt`;
            const labelBlob = new Blob([labelContent], { type: "text/plain" });
            await uploadToSupabaseStorage(labelBlob, labelPath, {
                bucket: DATASET_BUCKET,
                contentType: "text/plain",
            });
        }

        if (!hasAnyLabels) {
            setFormError("No annotations found for this step. Add labels in the annotation studio before training.");
            return { ok: false };
        }

        return { ok: true, hasTestSplit };
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        let dataYamlValue = (config.dataYaml || autoYamlSource || "").trim();
        setFormError("");
        setIsSubmitting(true);
        
        try {
            if (stepId) {
                const [freshStep] = await SOPStep.filter({ id: stepId });
                const projectId = freshStep?.project_id || stepData?.project_id;
                const classNames = (freshStep?.classes || stepData?.classes || []).filter(Boolean);
                if (!projectId) {
                    setFormError("Missing project information for this step.");
                    return;
                }
                const exportResult = await ensureDatasetExport({
                    projectId,
                    stepId,
                    classNames,
                });
                if (!exportResult?.ok) {
                    return;
                }
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
                    dataYamlValue = publicUrl;
                    setConfig(prev => ({ ...prev, dataYaml: publicUrl }));
                    setAutoYamlSource(publicUrl);
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
                    dataYamlValue = publicUrl;
                    setConfig(prev => ({ ...prev, dataYaml: publicUrl }));
                    setAutoYamlSource(publicUrl);
                }
            }
            if (!dataYamlValue) {
                setFormError("Dataset YAML is not linked to this step. Upload images or attach a dataset YAML before starting training.");
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
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl glass-effect border-0">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-blue-600" />
                        Start New Training Run
                    </DialogTitle>
                    <DialogDescription>Configure and launch a new model training job for step: "{stepTitle}"</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto pr-4">
                    {/* Step 1: Basic Configuration */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                            <h3 className="font-semibold text-gray-900">Basic Configuration</h3>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Give your model version a unique, descriptive name so you can easily identify it later.">Model Version Name</TooltipLabel>
                            <Input id="runName" value={config.runName} onChange={e => handleConfigChange('runName', e.target.value)} placeholder="e.g., Button_Detection_v1"/>
                        </div>

                        {autoYamlSource ? (
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                Dataset YAML linked from step: {autoYamlSource}
                            </div>
                        ) : null}
                        {!autoYamlSource && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                Dataset YAML missing. It will be generated automatically when you start training.
                            </div>
                        )}
                        
                        <div>
                            <TooltipLabel tooltipText="Choose a pre-trained model as your starting point. YOLOv8s offers the best balance of speed and accuracy for most tasks.">Base Model</TooltipLabel>
                            <Select value={config.baseModel} onValueChange={value => handleConfigChange('baseModel', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {dynamicModelOptions.map((group, index) => (
                                        <SelectGroup key={group.label || `group-${index}`}>
                                            <SelectLabel className="px-2 py-1.5 text-xs font-semibold">{group.label}</SelectLabel>
                                            {group.options.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
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
                            <TooltipLabel tooltipText="The optimization algorithm. Adam is highly recommended as it works well for most tasks and is very reliable.">Optimizer</TooltipLabel>
                            <Select value={config.optimizer} onValueChange={value => handleConfigChange('optimizer', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Adam">✅ Adam (Recommended - Works great for most tasks)</SelectItem>
                                    <SelectItem value="AdamW">AdamW (Advanced - Better for large models)</SelectItem>
                                    <SelectItem value="SGD">SGD (Classic - Requires careful tuning)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Choose your training hardware. Standard GPU is cost-effective and suitable for most projects.">Compute Resources</TooltipLabel>
                            <Select value={config.compute} onValueChange={value => handleConfigChange('compute', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {computeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                                <span className="text-gray-500 text-xs">{opt.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {formError && (
                        <Alert variant="destructive">
                            <AlertDescription>{formError}</AlertDescription>
                        </Alert>
                    )}
                    
                    <Separator />
                    
                    {/* Step 2: Recommended Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                            <h3 className="font-semibold text-gray-900">Recommended Training Settings</h3>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Good defaults for beginners</Badge>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-green-900 mb-1">💡 Beginner Tip</h4>
                                    <p className="text-sm text-green-800">These settings work well for most annotation projects. Train your first model with these defaults, then use Advanced Optimization (Step 3) to fine-tune if needed.</p>
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
                                    className={config.epochs === 100 ? "border-green-500" : ""} 
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
                                    <SelectTrigger className={config.batchSize === 16 ? "border-green-500" : ""}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="8">8 (Slower, less memory)</SelectItem>
                                        <SelectItem value="16">16 (Recommended)</SelectItem>
                                        <SelectItem value="32">32 (Faster, more memory)</SelectItem>
                                        <SelectItem value="64">64 (Advanced)</SelectItem>
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
                                    <SelectTrigger className={config.imgSize === 640 ? "border-green-500" : ""}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="320">320px (Fastest)</SelectItem>
                                        <SelectItem value="640">640px (Recommended)</SelectItem>
                                        <SelectItem value="1280">1280px (High detail)</SelectItem>
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
                                    className={config.learningRate === 0.001 ? "border-green-500" : ""} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.learningRate.enabled}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Step 3: Advanced Optimization */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                            <h3 className="font-semibold text-gray-900">Advanced Hyperparameter Optimization</h3>
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">For experienced users</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex-1">
                                <h4 className="font-medium text-purple-900 mb-1">Automatic Parameter Tuning</h4>
                                <p className="text-sm text-purple-800">Use AI to automatically find the best hyperparameters. Only recommended after training your first model with the defaults above.</p>
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
                                        <TooltipLabel tooltipText="Choose 'Manual' to set hyperparameters yourself, or 'Bayesian' to let the system automatically find the optimal settings.">Optimization Strategy</TooltipLabel>
                                        <Select value={config.optimizationStrategy} onValueChange={value => handleConfigChange('optimizationStrategy', value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual Tuning</SelectItem>
                                                <SelectItem value="bayesian">Bayesian Optimization</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {config.optimizationStrategy === 'manual' && (
                                        <Alert className="border-blue-300 bg-blue-50">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-blue-800">Manual Tuning Active</AlertTitle>
                                            <AlertDescription className="text-blue-700">
                                                You can now adjust the parameters in <strong>Step 2: Recommended Training Settings</strong>. The values you set there will be used for the training run.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {config.optimizationStrategy === 'bayesian' && (
                                        <div className="space-y-6">
                                            <Alert className="border-purple-300 bg-purple-50">
                                                <Info className="h-4 w-4 text-purple-600" />
                                                <AlertTitle className="text-purple-800">Bayesian Optimization Active</AlertTitle>
                                                <AlertDescription className="text-purple-700">
                                                    The system will automatically try different parameter combinations to find the best settings. Enable specific parameters below to include them in the search.
                                                </AlertDescription>
                                            </Alert>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <TooltipLabel tooltipText="Objective function to optimize during training.">Optimization Objective</TooltipLabel>
                                                    <Select value={config.bayesianConfig.objective} onValueChange={value => handleBayesianConfigChange('objective', value)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="maximize_mAP">Maximize mAP (Recommended)</SelectItem>
                                                            <SelectItem value="minimize_loss">Minimize Training Loss</SelectItem>
                                                            <SelectItem value="maximize_precision">Maximize Precision</SelectItem>
                                                            <SelectItem value="maximize_recall">Maximize Recall</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div>
                                                    <TooltipLabel tooltipText="Number of different parameter combinations to try.">Number of Trials</TooltipLabel>
                                                    <Input 
                                                        type="number" 
                                                        value={config.bayesianConfig.numTrials} 
                                                        onChange={e => handleBayesianConfigChange('numTrials', parseInt(e.target.value))} 
                                                        min="5" 
                                                        max="100"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <TooltipLabel tooltipText="Maximum time to spend on optimization (in hours).">Max Duration (hours)</TooltipLabel>
                                                <Input 
                                                    type="number" 
                                                    value={config.bayesianConfig.maxDuration} 
                                                    onChange={e => handleBayesianConfigChange('maxDuration', parseInt(e.target.value))} 
                                                    min="1" 
                                                    max="48"
                                                />
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <h4 className="font-medium text-gray-900">Parameter Search Space</h4>
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
                                                                className="w-16 h-8 text-xs"
                                                                placeholder="Min"
                                                            />
                                                            <Input 
                                                                type="number" 
                                                                value={config.bayesianConfig.searchSpace.epochs.max} 
                                                                onChange={e => handleSearchSpaceChange('epochs', 'max', parseInt(e.target.value))}
                                                                className="w-16 h-8 text-xs"
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

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700"
                        disabled={isSubmitting || !config.runName || !stepId}
                    >
                            {isSubmitting ? "Starting Training..." : "Start Training"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
