
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import JSZip from "jszip";
import { createSignedImageUrl, uploadToSupabaseStorage } from "@/api/storage";
import { createStepImages, updateStep } from "@/api/db";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, File as FileIcon, X, ChevronRight, ChevronLeft, Sprout, TestTube2, Folder, Loader2, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper function to shuffle an array
const shuffleArray = (array) => {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
};

const getFileStem = (filename) => filename.replace(/\.[^/.]+$/, "");
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const isImageFile = (file) => (
  file.type.startsWith("image/") || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)
);
const isZipFile = (file) => file.type === "application/zip" || /\.zip$/i.test(file.name);
const isLabelFile = (file) => /\.txt$/i.test(file.name);
const isClassFile = (file) => /\.(txt|names|ya?ml)$/i.test(file.name);
const isYamlFile = (file) => /\.(ya?ml)$/i.test(file.name);
const toSafeSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
const IMAGE_MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
  gif: "image/gif",
};
const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";
const UPLOAD_CONCURRENCY = Math.max(1, Number(import.meta.env.VITE_UPLOAD_CONCURRENCY) || 6);
const INSERT_BATCH_SIZE = Math.max(1, Number(import.meta.env.VITE_UPLOAD_INSERT_BATCH) || 25);
const MAX_IMAGE_PREVIEWS = 24;
const MAX_LABEL_PREVIEWS = 20;
const UPLOAD_UI_THROTTLE_MS = 200;
const THUMBNAIL_SIZE = 320;
const THUMBNAIL_QUALITY = 70;
const THUMBNAIL_MIME_WEBP = "image/webp";
const THUMBNAIL_MIME_JPEG = "image/jpeg";

const stripInlineComment = (value) => value.split(/\s+#/)[0].trim();
const stripQuotes = (value) => value.replace(/^['"]|['"]$/g, "");

const resolveSplitName = (groupName) => {
  const normalized = String(groupName || "").toLowerCase();
  if (normalized === "training" || normalized === "train") return "train";
  if (normalized === "inference" || normalized === "validation" || normalized === "val") return "val";
  if (normalized === "test" || normalized === "testing") return "test";
  return "train";
};

const createCanvas = () => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  }
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  return canvas;
};

const canvasToBlob = async (canvas, type) => {
  const quality = clamp01(THUMBNAIL_QUALITY / 100);
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type, quality });
  }
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
};

const loadImageFromBlob = async (blob) => {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close?.(),
    };
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({
        image: img,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        cleanup: () => URL.revokeObjectURL(url),
      });
    };
    img.onerror = (error) => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    img.src = url;
  });
};

const renderThumbnailFromBlob = async (blob) => {
  const source = await loadImageFromBlob(blob);
  const canvas = createCanvas();
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    source.cleanup();
    return null;
  }
  const target = THUMBNAIL_SIZE;
  const scale = Math.max(target / source.width, target / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const dx = (target - drawWidth) / 2;
  const dy = (target - drawHeight) / 2;

  ctx.clearRect(0, 0, target, target);
  ctx.imageSmoothingEnabled = true;
  if (ctx.imageSmoothingQuality) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(source.image, dx, dy, drawWidth, drawHeight);
  source.cleanup();

  let output = await canvasToBlob(canvas, THUMBNAIL_MIME_WEBP);
  if (!output) {
    output = await canvasToBlob(canvas, THUMBNAIL_MIME_JPEG);
  }
  if (!output) return null;
  const contentType = output.type || THUMBNAIL_MIME_JPEG;
  const extension = contentType === THUMBNAIL_MIME_WEBP ? "webp" : "jpg";
  return { blob: output, contentType, extension };
};

const createThumbnailBlob = async ({ bucket, path, publicUrl }) => {
  let signedSourceUrl = null;
  try {
    signedSourceUrl = await createSignedImageUrl(bucket, path, { expiresIn: 3600 });
  } catch (error) {
    console.warn(`Signed source URL failed for ${path}:`, error);
  }
  const urlsToTry = [signedSourceUrl, publicUrl].filter(Boolean);
  if (!urlsToTry.length) return null;
  for (const url of urlsToTry) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Thumbnail source fetch failed (${response.status}) for ${path}`);
        continue;
      }
      const sourceBlob = await response.blob();
      const thumbnail = await renderThumbnailFromBlob(sourceBlob);
      if (thumbnail) return thumbnail;
    } catch (error) {
      console.warn(`Thumbnail source request failed for ${path}:`, error);
    }
  }
  return null;
};

const uploadThumbnailFromImage = async ({
  bucket,
  path,
  publicUrl,
  projectId,
  stepId,
  splitName,
  safeName,
}) => {
  const thumbnailResult = await createThumbnailBlob({ bucket, path, publicUrl });
  if (!thumbnailResult) return null;
  const thumbnailName = `${getFileStem(safeName)}.${thumbnailResult.extension}`;
  const thumbnailPath = `${projectId}/${stepId}/thumbnails/${splitName}/${thumbnailName}`;
  try {
    const { publicUrl: thumbnailUrl } = await uploadToSupabaseStorage(thumbnailResult.blob, thumbnailPath, {
      bucket,
      contentType: thumbnailResult.contentType,
    });
    return thumbnailUrl || null;
  } catch (error) {
    console.warn(`Failed to upload thumbnail for ${path}:`, error);
    return null;
  }
};

const runWithConcurrency = async (items, limit, worker, shouldContinue) => {
  if (!items.length) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      if (shouldContinue && !shouldContinue()) return;
      const nextIndex = index;
      index += 1;
      const next = items[nextIndex];
      if (!next) return;
      await worker(next);
    }
  });
  await Promise.all(runners);
};

const parseClassListFromText = (content) => (
  content
    .split(/\r?\n/)
    .map((line) => stripInlineComment(line.trim()))
    .filter((line) => line && !line.startsWith("#"))
);

const parseYamlNames = (content) => {
  const lines = content.split(/\r?\n/);
  const names = [];
  let inNames = false;
  let namesIndent = 0;

  const assignName = (idx, value) => {
    if (!Number.isInteger(idx) || idx < 0) return;
    names[idx] = stripQuotes(stripInlineComment(value));
  };

  const parseInlineList = (raw) => {
    const listText = raw.replace(/^\[/, "").replace(/\]$/, "");
    listText.split(",").map((item) => stripQuotes(stripInlineComment(item.trim()))).filter(Boolean).forEach((item) => {
      names.push(item);
    });
  };

  const parseInlineMap = (raw) => {
    const mapText = raw.replace(/^\{/, "").replace(/\}$/, "");
    mapText.split(",").forEach((pair) => {
      const match = pair.match(/^\s*(\d+)\s*:\s*(.+)$/);
      if (!match) return;
      assignName(Number(match[1]), match[2].trim());
    });
  };

  lines.forEach((line) => {
    const indent = line.match(/^\s*/)[0].length;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    if (!inNames) {
      if (trimmed.startsWith("names:")) {
        inNames = true;
        namesIndent = indent;
        const after = trimmed.slice("names:".length).trim();
        if (after) {
          if (after.startsWith("[")) {
            parseInlineList(after);
          } else if (after.startsWith("{")) {
            parseInlineMap(after);
          } else {
            names.push(stripQuotes(stripInlineComment(after)));
          }
        }
      }
      return;
    }

    if (indent <= namesIndent) {
      inNames = false;
      return;
    }

    if (trimmed.startsWith("-")) {
      const value = stripQuotes(stripInlineComment(trimmed.slice(1).trim()));
      if (value) names.push(value);
      return;
    }

    const match = trimmed.match(/^(\d+)\s*:\s*(.+)$/);
    if (match) {
      assignName(Number(match[1]), match[2].trim());
    }
  });

  return names;
};

const loadImageDimensions = (file) => (
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for size detection"));
    };
    img.src = url;
  })
);

const parseYoloLabels = (content, imageSize, classNames) => {
  const { width, height } = imageSize;
  if (!width || !height) return [];

  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const annotations = [];
  lines.forEach((line) => {
    const parts = line.split(/\s+/).map((value) => Number(value));
    if (parts.length < 5 || parts.some((value) => Number.isNaN(value))) {
      return;
    }

    const classId = parts[0];
    const className = classNames[classId] ?? `Class ${classId}`;
    const coords = parts.slice(1);

    if (coords.length === 4) {
      const [cx, cy, w, h] = coords.map(clamp01);
      annotations.push({
        type: "bbox",
        x: (cx - w / 2) * width,
        y: (cy - h / 2) * height,
        width: w * width,
        height: h * height,
        class: className,
        status: "neutral",
      });
      return;
    }

    if (coords.length >= 6 && coords.length % 2 === 0) {
      const points = [];
      for (let i = 0; i < coords.length; i += 2) {
        const x = clamp01(coords[i]) * width;
        const y = clamp01(coords[i + 1]) * height;
        points.push({ x, y });
      }
      if (points.length >= 3) {
        annotations.push({
          type: "polygon",
          points,
          class: className,
          status: "neutral",
        });
      }
    }
  });

  return annotations;
};

const isImageName = (filename) => /\.(png|jpe?g|webp|bmp|gif)$/i.test(filename);

const getImageMimeType = (filename) => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return IMAGE_MIME_BY_EXT[ext] || "";
};

const buildStorageName = (entryName) => (
  entryName
    .split("/")
    .filter(Boolean)
    .join("__")
);

const extractZipImages = async (zipFile) => {
  const zip = await JSZip.loadAsync(zipFile);
  const entries = Object.values(zip.files);
  const images = [];

  for (const entry of entries) {
    if (entry.dir) continue;
    const entryName = entry.name.replace(/\\/g, "/");
    const baseName = entryName.split("/").pop();
    if (!baseName || !isImageName(baseName)) continue;
    const blob = await entry.async("blob");
    const mimeType = getImageMimeType(baseName) || blob.type || "application/octet-stream";
    const typedBlob = blob.type ? blob : blob.slice(0, blob.size, mimeType);
    const file = new File([typedBlob], baseName, {
      type: mimeType,
      lastModified: zipFile.lastModified || Date.now(),
    });
    images.push({
      file,
      sourceId: `${zipFile.name}-${zipFile.lastModified || "zip"}:${entryName}`,
      storageName: buildStorageName(entryName),
    });
  }

  return images;
};

const buildImageWrapper = (file, sourceId, storageName) => ({
  file,
  id: sourceId ? `${sourceId}-${file.size}` : `${file.name}-${file.size}-${file.lastModified}`,
  storageName: storageName || file.name,
});

export default function ImageUploadDialog({
  open,
  onOpenChange,
  onUploadComplete,
  currentStepId,
  currentStep,
  projectId,
}) {
  const [step, setStep] = useState('select'); // 'select', 'split', 'uploading'
  const [uploadMode, setUploadMode] = useState('guided'); // 'guided', 'training-only'
  const [files, setFiles] = useState([]);
  const [labelFiles, setLabelFiles] = useState([]);
  const [classFile, setClassFile] = useState(null);
  const [yamlUploadStatus, setYamlUploadStatus] = useState({ state: "idle", message: "" });
  const previewUrlsRef = useRef(new Map());
  const uploadUiRef = useRef({ lastProgressUpdate: 0, lastProgress: 0, lastMessage: "" });

  const stepClasses = useMemo(
    () => (currentStep?.classes || []).filter(Boolean),
    [currentStep]
  );

  const getPreviewUrl = useCallback((fileWrapper) => {
    if (!fileWrapper?.id) return "";
    const cached = previewUrlsRef.current.get(fileWrapper.id);
    if (cached) return cached;
    const url = URL.createObjectURL(fileWrapper.file);
    previewUrlsRef.current.set(fileWrapper.id, url);
    return url;
  }, []);

  const revokePreviewUrl = useCallback((fileId) => {
    const url = previewUrlsRef.current.get(fileId);
    if (url) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(fileId);
    }
  }, []);

  const revokeAllPreviews = useCallback(() => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  const updateUploadUi = useCallback((next) => {
    const now = (typeof performance !== "undefined" && performance.now)
      ? performance.now()
      : Date.now();
    const last = uploadUiRef.current;
    const nextProgress = typeof next?.progress === "number" ? next.progress : last.lastProgress;
    const nextMessage = typeof next?.message === "string" ? next.message : last.lastMessage;
    if (nextMessage !== last.lastMessage) {
      setUploadMessage(nextMessage);
    }
    const shouldUpdateProgress = nextProgress !== last.lastProgress
      && (now - last.lastProgressUpdate >= UPLOAD_UI_THROTTLE_MS || nextProgress === 100);
    if (shouldUpdateProgress) {
      setUploadProgress(nextProgress);
      uploadUiRef.current = {
        ...last,
        lastProgressUpdate: now,
        lastProgress: nextProgress,
        lastMessage: nextMessage,
      };
      return;
    }
    uploadUiRef.current = {
      ...last,
      lastProgress: nextProgress,
      lastMessage: nextMessage,
    };
  }, []);

  useEffect(() => () => {
    revokeAllPreviews();
  }, [revokeAllPreviews]);

  const classMapping = useMemo(() => {
    if (!classFile?.content) return stepClasses;
    const filename = classFile.file?.name?.toLowerCase() || "";
    const parsed = filename.endsWith(".yaml") || filename.endsWith(".yml")
      ? parseYamlNames(classFile.content)
      : parseClassListFromText(classFile.content);
    return parsed.length > 0 ? parsed : stepClasses;
  }, [classFile, stepClasses]);

  const saveYamlToStep = useCallback(async (file) => {
    if (!file || !isYamlFile(file)) {
      setYamlUploadStatus({
        state: "skipped",
        message: "Class file is not YAML. Upload a .yaml/.yml file to link training.",
      });
      return;
    }
    if (!projectId || !currentStepId) {
      setYamlUploadStatus({
        state: "error",
        message: "Missing project or step id for saving dataset YAML.",
      });
      return;
    }

    setYamlUploadStatus({ state: "uploading", message: "Saving dataset YAML for training..." });
    try {
      const safeName = toSafeSegment(file.name);
      const storagePath = `${projectId}/${currentStepId}/${Date.now()}-${safeName}`;
      const { path, publicUrl } = await uploadToSupabaseStorage(file, storagePath, {
        bucket: DATASET_BUCKET,
        contentType: "text/plain",
      });
      await updateStep(currentStepId, {
        dataset_yaml_path: `storage:${DATASET_BUCKET}/${path}`,
        dataset_yaml_url: publicUrl,
        dataset_yaml_name: file.name,
      });
      setYamlUploadStatus({ state: "saved", message: "Dataset YAML linked for training." });
    } catch (error) {
      console.error("Failed to save dataset YAML:", error);
      setYamlUploadStatus({ state: "error", message: "Failed to save dataset YAML. Try again." });
    }
  }, [projectId, currentStepId]);

  const generateDatasetYaml = useCallback(async (hasTestSplit) => {
    if (!projectId || !currentStepId) return null;
    const names = classMapping.length > 0 ? classMapping : stepClasses;
    const namesYaml = names.length
      ? names.map((name, index) => `  ${index}: ${JSON.stringify(name)}`).join("\n")
      : "";
    const yamlLines = [
      "path: .",
      "train: images/train",
      "val: images/val",
    ];
    if (hasTestSplit) {
      yamlLines.push("test: images/test");
    }
    if (namesYaml) {
      yamlLines.push("names:", namesYaml);
    } else {
      yamlLines.push("names: []");
    }
    const yamlContent = `${yamlLines.join("\n")}\n`;
    const blob = new Blob([yamlContent], { type: "text/plain" });
    const storagePath = `${projectId}/${currentStepId}/data.yaml`;
    const { path, publicUrl } = await uploadToSupabaseStorage(blob, storagePath, {
      bucket: DATASET_BUCKET,
      contentType: "text/plain",
    });
    await updateStep(currentStepId, {
      dataset_yaml_path: `storage:${DATASET_BUCKET}/${path}`,
      dataset_yaml_url: publicUrl,
      dataset_yaml_name: "data.yaml",
    });
    return { path, publicUrl };
  }, [projectId, currentStepId, classMapping, stepClasses]);

  const uploadDatasetArtifact = useCallback(async ({
    file,
    stem,
    labelContent,
    groupName,
    skipImageUpload = false,
    storageName,
  }) => {
    if (!projectId || !currentStepId) return;
    const splitName = resolveSplitName(groupName);
    if (!skipImageUpload && file) {
      const safeName = toSafeSegment(storageName || file.name);
      const imagePath = `${projectId}/${currentStepId}/images/${splitName}/${safeName}`;
      await uploadToSupabaseStorage(file, imagePath, { bucket: DATASET_BUCKET });
    }
    if (labelContent === undefined) {
      return;
    }
    const labelPayload = labelContent;
    const labelBlob = new Blob([labelPayload], { type: "text/plain" });
    const labelPath = `${projectId}/${currentStepId}/labels/${splitName}/${stem}.txt`;
    await uploadToSupabaseStorage(labelBlob, labelPath, {
      bucket: DATASET_BUCKET,
      contentType: "text/plain",
    });
  }, [projectId, currentStepId]);
  
  // Split configuration state
  const [splitType, setSplitType] = useState('auto'); // 'auto', 'manual'
  const [trainingRatio, setTrainingRatio] = useState(80);
  const [inferenceRatio, setInferenceRatio] = useState(20);
  const [otherGroupName, setOtherGroupName] = useState("Test");

  const otherRatio = useMemo(() => {
    const calculatedOther = 100 - trainingRatio - inferenceRatio;
    return Math.max(0, calculatedOther); // Ensure ratio is not negative
  }, [trainingRatio, inferenceRatio]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("Preparing upload...");
  const cancelRef = useRef(false);

  const visibleImageFiles = useMemo(() => files.slice(0, MAX_IMAGE_PREVIEWS), [files]);
  const hiddenImageCount = Math.max(0, files.length - visibleImageFiles.length);
  const visibleLabelFiles = useMemo(() => labelFiles.slice(0, MAX_LABEL_PREVIEWS), [labelFiles]);
  const hiddenLabelCount = Math.max(0, labelFiles.length - visibleLabelFiles.length);

  const handleFileSelect = async (selectedFiles) => {
    const incoming = Array.from(selectedFiles || []);
    const directImages = incoming.filter(isImageFile);
    const zipFiles = incoming.filter(isZipFile);
    const extracted = [];

    if (zipFiles.length > 0) {
      const zipResults = await Promise.all(
        zipFiles.map(async (zipFile) => {
          try {
            return await extractZipImages(zipFile);
          } catch (error) {
            console.error(`Failed to read zip ${zipFile.name}:`, error);
            return [];
          }
        })
      );
      zipResults.forEach((result) => extracted.push(...result));
    }

    const newFiles = [
      ...directImages.map((file) => buildImageWrapper(file)),
      ...extracted.map(({ file, sourceId, storageName }) => buildImageWrapper(file, sourceId, storageName)),
    ];

    if (newFiles.length === 0) return;

    setFiles((prev) => {
      const existingIds = new Set(prev.map((f) => f.id));
      return [...prev, ...newFiles.filter((f) => !existingIds.has(f.id))];
    });
  };

  const handleLabelSelect = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles)
      .filter(isLabelFile)
      .map(file => ({
        file,
        id: `${file.name}-${file.size}-${file.lastModified}`,
      }));
    setLabelFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      return [...prev, ...newFiles.filter(f => !existingIds.has(f.id))];
    });
  };

  const handleClassSelect = async (selectedFiles) => {
    const file = Array.from(selectedFiles || []).find(isClassFile);
    if (!file) return;
    setClassFile({ file, content: "" });
    try {
      const content = await file.text();
      setClassFile({
        file,
        content,
      });
      await saveYamlToStep(file);
    } catch (error) {
      console.error("Failed to read class file:", error);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleLabelDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleLabelSelect(e.dataTransfer.files);
    }
  };

  const handleClassDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleClassSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (fileId) => {
    revokePreviewUrl(fileId);
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const removeLabelFile = (fileId) => {
    setLabelFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const removeClassFile = () => {
    setClassFile(null);
    setYamlUploadStatus({ state: "idle", message: "" });
  };

  const labelStats = useMemo(() => {
    const imageStems = new Set(files.map(f => getFileStem(f.file.name).toLowerCase()));
    const labelStems = new Set(labelFiles.map(f => getFileStem(f.file.name).toLowerCase()));
    let matched = 0;
    labelStems.forEach((stem) => {
      if (imageStems.has(stem)) matched += 1;
    });
    return {
      images: imageStems.size,
      labels: labelStems.size,
      matched,
    };
  }, [files, labelFiles]);

  const buildLabelContentByStem = async () => {
    const labelContentByStem = new Map();
    if (labelFiles.length === 0) return labelContentByStem;
    const labelEntries = await Promise.all(
      labelFiles.map(async (labelWrapper) => ({
        stem: getFileStem(labelWrapper.file.name).toLowerCase(),
        content: await labelWrapper.file.text(),
      }))
    );
    labelEntries.forEach(({ stem, content }) => {
      if (!labelContentByStem.has(stem)) {
        labelContentByStem.set(stem, content);
      }
    });
    return labelContentByStem;
  };

  const handleClose = () => {
    // Reset state when closing dialog
    revokeAllPreviews();
    uploadUiRef.current = { lastProgressUpdate: 0, lastProgress: 0, lastMessage: "" };
    setFiles([]);
    setLabelFiles([]);
    setClassFile(null);
    setStep('select');
    setUploadMode('guided');
    setSplitType('auto');
    setTrainingRatio(80);
    setInferenceRatio(20);
    setOtherGroupName("Test");
    setIsUploading(false);
    setUploadProgress(0);
    setUploadMessage("Preparing upload...");
    onOpenChange(false);
  };

  const cancelUpload = () => {
    cancelRef.current = true;
    handleClose();
  };

  const startUploadProcess = async ({ mode = 'guided' } = {}) => {
    if (files.length === 0 || !currentStepId) return;

    cancelRef.current = false;
    uploadUiRef.current = { lastProgressUpdate: 0, lastProgress: 0, lastMessage: "" };
    setUploadMode(mode);
    setUploadMessage(mode === 'training-only' ? 'Preparing training upload...' : 'Preparing upload...');
    setStep('uploading');
    setIsUploading(true);

    const shuffledFiles = shuffleArray([...files]);
    const totalFiles = shuffledFiles.length;
    const labelContentByStem = await buildLabelContentByStem();
    if (cancelRef.current) return;

    let assignments = {};
    if (mode === 'training-only') {
      assignments = { Training: shuffledFiles };
    } else {
      let splits;
      if (splitType === 'auto') {
        splits = { Training: 0.8, Validation: 0.2 };
      } else {
        const otherRatioValue = otherRatio > 0 ? otherRatio : 0;
        splits = {
          Training: trainingRatio / 100,
          Validation: inferenceRatio / 100,
        };
        if (otherRatioValue > 0 && otherGroupName.trim()) {
          splits[otherGroupName.trim()] = otherRatioValue / 100;
        }
      }

      // Ensure Training and Validation always exist as groups, even if empty
      if (!splits.Training) splits.Training = 0;
      if (!splits.Validation) splits.Validation = 0;

      let currentIndex = 0;

      // Distribute files based on calculated ratios
      for (const [group, ratio] of Object.entries(splits)) {
        if (ratio > 0) {
          // Use Math.floor to avoid overallocating, we'll handle remainders later
          const count = Math.floor(totalFiles * ratio);
          assignments[group] = shuffledFiles.slice(currentIndex, currentIndex + count);
          currentIndex += count;
        }
      }
      
      // Distribute any remaining files (due to rounding) to the largest group
      let assignedCount = Object.values(assignments).reduce((sum, arr) => sum + arr.length, 0);
      if (assignedCount < totalFiles) {
         const remainingFiles = shuffledFiles.slice(assignedCount);
         if (Object.keys(assignments).length > 0) {
           const largestGroup = Object.keys(assignments).reduce((a, b) => assignments[a].length > assignments[b].length ? a : b);
           assignments[largestGroup].push(...remainingFiles);
         } else if (remainingFiles.length > 0) {
           // This case happens if all ratios are 0 or no groups were specified, assign all to 'Untagged'
           assignments['Untagged'] = remainingFiles;
         }
      }
    }

    try {
      const uploadTargets = [];
      for (const [groupName, groupFiles] of Object.entries(assignments)) {
        if (!groupFiles || groupFiles.length === 0) continue;
        for (const fileWrapper of groupFiles) {
          uploadTargets.push({ groupName, fileWrapper });
        }
      }

      const insertQueue = [];
      let insertPromise = Promise.resolve();

      const scheduleInsert = (batch) => {
        insertPromise = insertPromise.then(() => createStepImages(batch));
      };

      const enqueueInsert = (payload) => {
        insertQueue.push(payload);
        if (insertQueue.length >= INSERT_BATCH_SIZE) {
          const batch = insertQueue.splice(0, insertQueue.length);
          scheduleInsert(batch);
        }
      };

      const flushInserts = async () => {
        if (insertQueue.length > 0) {
          const batch = insertQueue.splice(0, insertQueue.length);
          scheduleInsert(batch);
        }
        await insertPromise;
      };

      let filesUploaded = 0;
      const totalUploads = uploadTargets.length;
      const uploadSingle = async ({ groupName, fileWrapper }) => {
        if (cancelRef.current) return;
        updateUploadUi({ message: `Uploading to "${groupName}": ${fileWrapper.file.name}` });
        const lookupStem = getFileStem(fileWrapper.file.name).toLowerCase();
        const labelContent = labelContentByStem.get(lookupStem);
        const splitName = resolveSplitName(groupName);
        const storageBaseName = fileWrapper.storageName || fileWrapper.file.name;
        const safeName = toSafeSegment(storageBaseName);
        const storageStem = getFileStem(storageBaseName).toLowerCase();
        const datasetImagePath = `${projectId}/${currentStepId}/images/${splitName}/${safeName}`;
        const uploadPromise = uploadToSupabaseStorage(fileWrapper.file, datasetImagePath, {
          bucket: DATASET_BUCKET,
        });
        const imageSizePromise = labelContent !== undefined
          ? loadImageDimensions(fileWrapper.file).catch((error) => {
            console.warn(`Failed to load image size for ${fileWrapper.file.name}:`, error);
            return null;
          })
          : Promise.resolve(null);
        const labelUploadPromise = labelContent !== undefined
          ? uploadDatasetArtifact({
            file: fileWrapper.file,
            stem: storageStem,
            labelContent,
            groupName,
            skipImageUpload: true,
            storageName: fileWrapper.storageName,
          })
          : Promise.resolve();
        const [{ publicUrl, path: storagePath }, imageSize] = await Promise.all([uploadPromise, imageSizePromise]);
        if (cancelRef.current) return;

        const thumbnailUrl = await uploadThumbnailFromImage({
          bucket: DATASET_BUCKET,
          path: storagePath,
          publicUrl,
          projectId,
          stepId: currentStepId,
          splitName,
          safeName,
        });
        if (cancelRef.current) return;

        let annotationPayload = null;
        let noAnnotationsNeeded = false;
        if (labelContent !== undefined) {
          const trimmedLabel = labelContent.trim();
          if (imageSize) {
            const annotations = parseYoloLabels(labelContent, imageSize, classMapping);
            annotationPayload = {
              annotations,
              classColors: {},
              image_natural_size: imageSize,
              timestamp: new Date().toISOString(),
            };
            if (annotations.length === 0 && trimmedLabel.length === 0) {
              noAnnotationsNeeded = true;
            } else if (annotations.length === 0 && trimmedLabel.length > 0) {
              console.warn(`No valid annotations found in ${fileWrapper.file.name} label file.`);
            }
          } else if (trimmedLabel.length === 0) {
            noAnnotationsNeeded = true;
          } else {
            console.warn(`Skipping annotations for ${fileWrapper.file.name} because image size could not be read.`);
          }
        }

        const payload = {
          step_id: currentStepId,
          image_url: publicUrl,
          thumbnail_url: thumbnailUrl || publicUrl,
          display_url: publicUrl,
          image_name: fileWrapper.file.name,
          file_size: fileWrapper.file.size,
          image_group: groupName, // Assign the calculated group name
          processing_status: 'completed',
          no_annotations_needed: noAnnotationsNeeded
        };

        if (annotationPayload) {
          payload.annotations = annotationPayload;
        }

        if (cancelRef.current) return;
        enqueueInsert(payload);
        await labelUploadPromise;

        filesUploaded += 1;
        if (!cancelRef.current) {
          updateUploadUi({ progress: Math.round((filesUploaded / totalUploads) * 100) });
        }
      };

      await runWithConcurrency(uploadTargets, UPLOAD_CONCURRENCY, uploadSingle, () => !cancelRef.current);
      if (cancelRef.current) return;
      setUploadMessage("Finalizing image records...");
      await flushInserts();
      if (cancelRef.current) return;

      if (!classFile || !isYamlFile(classFile.file)) {
        const hasTestSplit = Object.keys(assignments).some(
          (name) => resolveSplitName(name) === "test"
        );
        setYamlUploadStatus({ state: "uploading", message: "Generating dataset YAML..." });
        await generateDatasetYaml(hasTestSplit);
        setYamlUploadStatus({ state: "saved", message: "Dataset YAML generated for training." });
      }
      if (cancelRef.current) return;

      setUploadMessage("Upload complete!");
      setUploadProgress(100);
      await onUploadComplete();
      setTimeout(handleClose, 1000); // Close dialog after a short delay

    } catch (error) {
      if (cancelRef.current) return;
      console.error("Error during upload process:", error);
      setUploadMessage(`Error: ${error.message}. Please try again.`);
      // Don't close on error, let user see the message
    }
  };

  const handleSliderChange = useCallback((value, type) => {
    const newValue = value[0];
    if (type === 'training') {
      const newTraining = newValue;
      setTrainingRatio(newTraining);
      // If training increases, validation might need to decrease to keep sum <= 100
      if (newTraining + inferenceRatio > 100) {
        setInferenceRatio(100 - newTraining);
      }
    } else if (type === 'validation') {
      const newInference = newValue;
      // Max validation is 100 - current training ratio (as otherRatio is derived)
      const maxAllowedInference = 100 - trainingRatio;
      setInferenceRatio(Math.min(newInference, maxAllowedInference));
    }
  }, [trainingRatio, inferenceRatio]);

  const isTrainingOnlyUpload = uploadMode === 'training-only';

  const renderSelectStep = () => (
    <motion.div key="select" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}>
      <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-blue-50">
        <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-64 w-64 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="relative p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-amber-700 uppercase">Upload Studio</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Bring your dataset to life</h2>
              <p className="mt-2 text-sm text-slate-600">Drop images, optionally add labels, then split or send everything to Training.</p>
              <p className="mt-1 text-xs text-slate-500">Splits are set here; folders are just for organization.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-slate-900 text-white">Step 1 of 3</Badge>
              <Badge variant="outline" className="border-slate-200 bg-white/70 text-slate-700">{files.length} images</Badge>
              <Badge variant="outline" className="border-slate-200 bg-white/70 text-slate-700">{labelFiles.length} labels</Badge>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-amber-100/60 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Images</h3>
                  <p className="text-xs text-slate-500">PNG, JPG, WebP, BMP, GIF</p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 border-amber-200">Required</Badge>
              </div>

              <div
                className="mt-4 rounded-xl border-2 border-dashed border-amber-200 bg-gradient-to-br from-white via-amber-50 to-amber-100/60 p-6 text-center transition hover:border-amber-400 hover:shadow-sm"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <UploadCloud className="w-12 h-12 mx-auto text-amber-500" />
                <p className="mt-3 text-base font-semibold text-slate-800">Drop images or a zip to browse</p>
                <p className="text-sm text-slate-600">Auto-split next, or send everything straight to Training.</p>
                <Input
                  id="file-upload-input"
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/*,.zip"
                  onChange={(e) => {
                    handleFileSelect(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Selected images</h4>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{files.length} files</Badge>
                  </div>
                  {hiddenImageCount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Showing first {visibleImageFiles.length} of {files.length} images.
                    </p>
                  )}
                  <ScrollArea className="mt-3 h-52 rounded-xl border border-slate-200/70 bg-white/70 p-3">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {visibleImageFiles.map(fileWrapper => (
                        <div key={fileWrapper.id} className="group relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                          <img
                            src={getPreviewUrl(fileWrapper)}
                            alt="preview"
                            loading="lazy"
                            decoding="async"
                            className="h-20 w-full rounded-lg object-cover"
                          />
                          <p className="mt-2 truncate text-xs font-medium text-slate-700">{fileWrapper.file.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-2 h-6 w-6 p-0 text-slate-500 opacity-0 transition group-hover:opacity-100 hover:bg-rose-100 hover:text-rose-600"
                            onClick={() => removeFile(fileWrapper.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {hiddenImageCount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      +{hiddenImageCount} more images selected.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-blue-100/60 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Labels and Classes</h3>
                  <p className="text-xs text-slate-500">Optional but recommended for pre-labeled sets.</p>
                </div>
                <Badge className="border border-blue-200 bg-blue-50 text-blue-700">Optional</Badge>
              </div>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-800">
                Validation images must be annotated before training, or metrics will be meaningless.
              </div>

              <div
                className="mt-4 rounded-xl border border-dashed border-blue-200 bg-gradient-to-br from-white via-blue-50 to-blue-100/60 p-4 text-center transition hover:border-blue-400 hover:shadow-sm"
                onDrop={handleLabelDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onClick={() => document.getElementById('label-upload-input')?.click()}
              >
                <UploadCloud className="w-9 h-9 mx-auto text-blue-500" />
                <p className="mt-2 text-sm font-semibold text-slate-800">Add YOLO label files</p>
                <p className="text-xs text-slate-600">Match image names, .txt format.</p>
                <Input
                  id="label-upload-input"
                  type="file"
                  multiple
                  accept=".txt"
                  className="hidden"
                  onChange={(e) => handleLabelSelect(e.target.files)}
                />
              </div>

              <div
                className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white/80 p-4 text-center transition hover:border-slate-400"
                onDrop={handleClassDrop}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onClick={() => document.getElementById('class-upload-input')?.click()}
              >
                <FileIcon className="w-8 h-8 mx-auto text-slate-500" />
                <p className="mt-2 text-sm font-semibold text-slate-800">Upload classes file</p>
                <p className="text-xs text-slate-600">One class per line, or a YOLO YAML file.</p>
                <Input
                  id="class-upload-input"
                  type="file"
                  accept=".txt,.names,.yaml,.yml"
                  className="hidden"
                  onChange={(e) => {
                    handleClassSelect(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {(labelFiles.length > 0 || stepClasses.length > 0 || classFile) && (
                <div className="mt-4 space-y-2 rounded-xl border border-slate-200/70 bg-white/80 p-3 text-xs text-slate-600">
                  {labelFiles.length > 0 && (
                    <div>Matched labels: {labelStats.matched} of {labelStats.images || files.length} images</div>
                  )}
                  {classFile && (
                    <div>Class mapping: {classFile.file.name} ({classMapping.length || 0} classes)</div>
                  )}
                  {!classFile && stepClasses.length > 0 && (
                    <div>Class mapping: 0-{Math.max(0, stepClasses.length - 1)} maps to step classes</div>
                  )}
                  {labelFiles.length > 0 && stepClasses.length === 0 && !classFile && (
                    <div className="text-amber-600">No step classes found. Labels will import as &quot;Class N&quot;.</div>
                  )}
                </div>
              )}

              {labelFiles.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Label files</h4>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{labelFiles.length}</Badge>
                  </div>
                  {hiddenLabelCount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Showing first {visibleLabelFiles.length} of {labelFiles.length} label files.
                    </p>
                  )}
                  <ScrollArea className="mt-2 h-32 rounded-xl border border-slate-200/70 bg-white/70 p-2">
                    <div className="space-y-2">
                      {visibleLabelFiles.map(fileWrapper => (
                        <div key={fileWrapper.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                          <FileIcon className="h-4 w-4 text-slate-500" />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-xs font-medium text-slate-700">{fileWrapper.file.name}</p>
                            <p className="text-[11px] text-slate-500">{(fileWrapper.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-rose-100 hover:text-rose-600" onClick={() => removeLabelFile(fileWrapper.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {hiddenLabelCount > 0 && (
                    <p className="mt-2 text-xs text-slate-500">
                      +{hiddenLabelCount} more label files selected.
                    </p>
                  )}
                </div>
              )}

              {classFile && (
                <div className="mt-4 rounded-xl border border-slate-200/70 bg-white/80 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                      <FileIcon className="h-4 w-4 text-slate-500" />
                      {classFile.file.name}
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:bg-rose-100 hover:text-rose-600" onClick={removeClassFile}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{classMapping.length || 0} classes loaded</p>
                  {yamlUploadStatus.state !== "idle" && (
                    <p
                      className={`mt-2 text-[11px] ${
                        yamlUploadStatus.state === "saved"
                          ? "text-blue-700"
                          : yamlUploadStatus.state === "uploading"
                            ? "text-blue-600"
                            : yamlUploadStatus.state === "error"
                              ? "text-rose-600"
                              : "text-slate-600"
                      }`}
                    >
                      {yamlUploadStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                onClick={() => startUploadProcess({ mode: 'training-only' })}
                disabled={files.length === 0}
                className="border-blue-200 bg-white/80 text-blue-800 hover:bg-blue-50"
              >
                <Sprout className="w-4 h-4 mr-2" />
                Upload to Training
              </Button>
              <Button
                onClick={() => {
                  setUploadMode('guided');
                  setStep('split');
                }}
                disabled={files.length === 0}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                Next <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </DialogFooter>
        </div>
      </div>
    </motion.div>
  );

  const renderSplitStep = () => (
    <motion.div key="split" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="absolute -top-16 right-10 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="relative p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-blue-700 uppercase">Split Configuration</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Group your images</h2>
              <p className="mt-2 text-sm text-slate-600">Balance training and validation sets. Validation must be labeled to produce meaningful metrics.</p>
            </div>
            <Badge className="bg-slate-900 text-white">Step 2 of 3</Badge>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-blue-100/60 backdrop-blur">
              <h3 className="text-lg font-semibold text-slate-900">Split summary</h3>
              <p className="mt-1 text-xs text-slate-500">{files.length} images ready to assign.</p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-800">
                      <Sprout className="h-4 w-4" /> Training
                    </div>
                    <Badge className="border-blue-200 bg-white text-blue-700">{trainingRatio}%</Badge>
                  </div>
                  <p className="mt-2 text-xs text-blue-700/80">Primary dataset for model learning.</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <TestTube2 className="h-4 w-4 text-slate-600" /> Validation
                    </div>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">{inferenceRatio}%</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Metrics are computed here. Labels required.</p>
                </div>

                {otherRatio > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <Folder className="h-4 w-4" /> {otherGroupName || "Other"}
                      </div>
                      <Badge variant="outline" className="border-amber-200 text-amber-700">{otherRatio}%</Badge>
                    </div>
                    <p className="mt-2 text-xs text-amber-700/80">Optional holdout group.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-blue-100/60 backdrop-blur">
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  Validation must be labeled
                </div>
                <p className="mt-1 text-xs text-amber-800/80">
                  Training metrics are calculated only on the validation group. Unlabeled validation data makes results meaningless.
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/80 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Automatic split</p>
                  <p className="text-xs text-slate-500">80% training, 20% validation</p>
                </div>
                <Switch
                  id="split-type-switch"
                  checked={splitType === 'auto'}
                  onCheckedChange={(checked) => setSplitType(checked ? 'auto' : 'manual')}
                />
              </div>

              <AnimatePresence>
                {splitType === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 space-y-5 overflow-hidden"
                  >
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="mb-2 flex items-center gap-3">
                        <Sprout className="w-5 h-5 text-blue-600" />
                        <h4 className="font-medium text-blue-900">Training Group</h4>
                        <Badge variant="outline" className="ml-auto border-blue-200 text-blue-700">{trainingRatio}%</Badge>
                      </div>
                      <Slider
                        value={[trainingRatio]}
                        max={100}
                        step={1}
                        onValueChange={(value) => handleSliderChange(value, 'training')}
                      />
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white/70 p-4">
                      <div className="mb-2 flex items-center gap-3">
                        <TestTube2 className="w-5 h-5 text-slate-600" />
                        <h4 className="font-medium text-slate-800">Validation Group</h4>
                        <Badge variant="outline" className="ml-auto border-slate-200 text-slate-600">{inferenceRatio}%</Badge>
                      </div>
                      <Slider
                        value={[inferenceRatio]}
                        max={100}
                        step={1}
                        onValueChange={(value) => handleSliderChange(value, 'validation')}
                      />
                    </div>

                    {otherRatio > 0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                        <div className="mb-2 flex items-center gap-3">
                          <Folder className="w-5 h-5 text-amber-700" />
                          <Input
                            value={otherGroupName}
                            onChange={(e) => setOtherGroupName(e.target.value)}
                            placeholder="Test group name..."
                            className="h-8 flex-1 bg-white"
                          />
                          <Badge variant="outline" className="ml-auto border-amber-200 text-amber-700">{otherRatio}%</Badge>
                        </div>
                        <p className="text-xs text-amber-700/80">This group will contain the remaining {otherRatio}% of images.</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => setStep('select')}>
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>
            <Button onClick={startUploadProcess} className="bg-slate-900 text-white hover:bg-slate-800">
              Upload & Assign {files.length} Images
            </Button>
          </DialogFooter>
        </div>
      </div>
    </motion.div>
  );

  const renderUploadingStep = () => (
    <motion.div key="uploading" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-amber-50 text-slate-900">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-blue-200/60 blur-3xl" />
        <div className="relative p-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-blue-700 uppercase">Uploading</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {isTrainingOnlyUpload ? "Uploading training images" : "Shipping your dataset"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{uploadMessage}</p>
            </div>
            <Badge className="bg-slate-900 text-white">
              {isTrainingOnlyUpload ? "Step 2 of 2" : "Step 3 of 3"}
            </Badge>
          </div>

          <div className="mt-8 rounded-2xl border border-blue-100 bg-white/80 p-6 text-center shadow-lg shadow-blue-100/60">
            <Loader2 className="w-14 h-14 text-blue-500 animate-spin mx-auto mb-4" />
            <div className="w-full max-w-md mx-auto">
              <Progress value={uploadProgress} className="mb-3" />
              <p className="text-sm text-slate-600">{uploadProgress}% complete</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          onOpenChange(true);
          return;
        }
        if (isUploading) {
          cancelUpload();
          return;
        }
        handleClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl p-0 overflow-hidden max-h-[90vh]">
        <DialogTitle className="sr-only">Upload images and labels</DialogTitle>
        <DialogDescription className="sr-only">
          Upload images with optional labels and class mapping, then split them into training and validation groups or send them straight to training.
        </DialogDescription>
        <div className="max-h-[90vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 'select' && renderSelectStep()}
            {step === 'split' && renderSplitStep()}
            {step === 'uploading' && renderUploadingStep()}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
