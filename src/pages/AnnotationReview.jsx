import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { PredictedAnnotation } from '@/api/entities';
import { StepImage } from '@/api/entities';
import { LogicRule } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { createSignedImageUrl, getStoragePathFromUrl } from '@/api/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  PenTool, 
  Wand2, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Target,
  BarChart3,
  Image as ImageIcon
} from 'lucide-react';
import { createPageUrl } from '@/utils';

const BACKGROUND_CLASS = "Background";
const IOU_THRESHOLD = 0.5;
const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";

const toAnnotationArray = (value) => {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return toAnnotationArray(parsed);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.annotations)) return value.annotations;
  if (Array.isArray(value.data)) return value.data;
  return [];
};

const resolveClassName = (annotation, stepClasses) => {
  if (!annotation) return "Unlabeled";
  const direct =
    annotation.class ??
    annotation.label ??
    annotation.predicted_class ??
    annotation.class_name ??
    annotation.name;
  if (direct !== undefined && direct !== null && direct !== "") {
    return String(direct);
  }
  const rawId =
    annotation.class_id ??
    annotation.classId ??
    annotation.classIndex ??
    annotation.category_id ??
    annotation.categoryId;
  const numericId = Number(rawId);
  if (Number.isFinite(numericId) && Array.isArray(stepClasses)) {
    return stepClasses[numericId] ?? `Class ${numericId}`;
  }
  if (rawId !== undefined && rawId !== null && rawId !== "") {
    return `Class ${rawId}`;
  }
  return "Unlabeled";
};

const normalizeBoundingBox = (annotation) => {
  if (!annotation) return null;
  const bbox = annotation.bounding_box ?? annotation.bbox;
  if (bbox) {
    if (Array.isArray(bbox) && bbox.length >= 4) {
      return { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] };
    }
    if (typeof bbox === "object") {
      const x = bbox.x ?? bbox.left;
      const y = bbox.y ?? bbox.top;
      const width = bbox.width ?? bbox.w;
      const height = bbox.height ?? bbox.h;
      if ([x, y, width, height].every((value) => Number.isFinite(Number(value)))) {
        return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
      }
    }
  }
  const hasBoxValues = ["x", "y", "width", "height"].every((key) => annotation[key] !== undefined);
  if (hasBoxValues) {
    return {
      x: Number(annotation.x),
      y: Number(annotation.y),
      width: Number(annotation.width),
      height: Number(annotation.height),
    };
  }
  const points = annotation.points ?? annotation.polygon ?? annotation.segmentation;
  if (Array.isArray(points) && points.length > 0) {
    const coords = points.flatMap((point) => {
      if (Array.isArray(point)) return [{ x: point[0], y: point[1] }];
      if (point && typeof point === "object") return [point];
      return [];
    });
    if (coords.length) {
      const xs = coords.map((point) => Number(point.x)).filter(Number.isFinite);
      const ys = coords.map((point) => Number(point.y)).filter(Number.isFinite);
      if (xs.length && ys.length) {
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      }
    }
  }
  return null;
};

const normalizePrediction = (annotation, index, stepClasses, prefix) => {
  const className = resolveClassName(annotation, stepClasses);
  const confidence =
    annotation.confidence ?? annotation.confidence_score ?? annotation.score ?? annotation.probability;
  const numericConfidence = Number.isFinite(Number(confidence)) ? Number(confidence) : null;
  const boundingBox = normalizeBoundingBox(annotation);
  if (!boundingBox) return null;
  return {
    id: annotation.id ?? `${prefix}-pred-${index}`,
    bounding_box: boundingBox,
    predicted_class: className,
    confidence_score: numericConfidence ?? 0,
  };
};

const normalizeGroundTruth = (annotation, index, stepClasses, prefix) => {
  const className = resolveClassName(annotation, stepClasses);
  const boundingBox = normalizeBoundingBox(annotation);
  if (!boundingBox) return null;
  return {
    id: annotation.id ?? `${prefix}-gt-${index}`,
    bounding_box: boundingBox,
    class: className,
  };
};

const computeIoU = (boxA, boxB) => {
  if (!boxA || !boxB) return 0;
  const xA = Math.max(boxA.x, boxB.x);
  const yA = Math.max(boxA.y, boxB.y);
  const xB = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const yB = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);
  const interWidth = Math.max(0, xB - xA);
  const interHeight = Math.max(0, yB - yA);
  const interArea = interWidth * interHeight;
  const boxAArea = Math.max(0, boxA.width) * Math.max(0, boxA.height);
  const boxBArea = Math.max(0, boxB.width) * Math.max(0, boxB.height);
  const union = boxAArea + boxBArea - interArea;
  if (union <= 0) return 0;
  return interArea / union;
};

const evaluateImage = (predictions, groundTruths) => {
  const preds = predictions.map((pred) => ({ ...pred }));
  const gts = groundTruths.map((gt) => ({ ...gt }));
  const matchedGroundTruths = new Set();

  preds.forEach((pred) => {
    let bestMatchIndex = -1;
    let bestIoU = 0;
    gts.forEach((gt, idx) => {
      if (matchedGroundTruths.has(idx)) return;
      const iou = computeIoU(pred.bounding_box, gt.bounding_box);
      if (iou > bestIoU) {
        bestIoU = iou;
        bestMatchIndex = idx;
      }
    });

    if (bestMatchIndex >= 0 && bestIoU >= IOU_THRESHOLD) {
      const matchedGt = gts[bestMatchIndex];
      matchedGroundTruths.add(bestMatchIndex);
      pred.matched_ground_truth = matchedGt;
      pred.match =
        pred.predicted_class === matchedGt.class ? "true_positive" : "false_positive";
      matchedGt.matched_prediction = pred;
      matchedGt.match =
        pred.predicted_class === matchedGt.class ? "true_positive" : "false_negative";
    } else {
      pred.match = "false_positive";
    }
  });

  gts.forEach((gt) => {
    if (!gt.match) {
      gt.match = "false_negative";
    }
  });

  return { predictions: preds, groundTruths: gts };
};

const resolveImageUrl = async (image) => {
  if (!image) return null;
  const fallbackUrl = image.display_url || image.image_url || image.thumbnail_url || "";
  if (!fallbackUrl) return null;

  const trySignedUrl = async (bucket) => {
    const path = getStoragePathFromUrl(fallbackUrl, bucket);
    if (!path) return null;
    try {
      const signed = await createSignedImageUrl(bucket, path, { expiresIn: 3600 });
      return signed || fallbackUrl;
    } catch {
      return fallbackUrl;
    }
  };

  const stepImageUrl = await trySignedUrl(STEP_IMAGES_BUCKET);
  if (stepImageUrl) return stepImageUrl;
  const datasetUrl = await trySignedUrl(DATASET_BUCKET);
  return datasetUrl || fallbackUrl;
};

const BoundingBox = ({ box, color, label, scaleX = 1, scaleY = 1 }) => {
  const scaled = {
    x: box.x * scaleX,
    y: box.y * scaleY,
    width: box.width * scaleX,
    height: box.height * scaleY,
  };
  return (
    <div
      className={`absolute border-2 ${color}`}
      style={{
        left: `${scaled.x}px`,
        top: `${scaled.y}px`,
        width: `${scaled.width}px`,
        height: `${scaled.height}px`,
      }}
    >
      <div className={`absolute -top-6 left-0 text-xs px-1 rounded-sm ${color.replace('border-', 'bg-').replace('text-white', '')} text-white`}>
        {label}
      </div>
    </div>
  );
};

const InteractiveConfusionMatrix = ({ data, classes, onCellClick }) => {
  if (!classes.length) {
    return <p className="text-sm text-gray-500 text-center">No classification data available yet.</p>;
  }
  const maxCount = Math.max(1, ...data.map(d => d.count));
  const gridTemplateColumns = `minmax(140px, auto) repeat(${classes.length}, minmax(0, 1fr))`;
  const getCellStyle = (cell, isCorrect) => {
    if (!cell || cell.count === 0) {
      return {
        backgroundColor: "#f9fafb",
        color: "#9ca3af",
      };
    }
    const intensity = Math.min(1, cell.count / maxCount);
    const baseColor = isCorrect ? { r: 34, g: 197, b: 94 } : { r: 239, g: 68, b: 68 };
    const alpha = 0.2 + intensity * 0.6;
    return {
      backgroundColor: `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, ${alpha})`,
      color: isCorrect ? "#14532d" : "#7f1d1d",
    };
  };

  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-600">Click on any cell to see example images</p>
      </div>
      <div className="grid gap-1 text-xs" style={{ gridTemplateColumns }}>
        <div className="text-center font-semibold text-gray-700 p-2 leading-tight">
          <div>Actual</div>
          <div className="text-xs font-normal text-gray-500">Predicted</div>
        </div>
        {classes.map((cls) => (
          <div key={cls} className="text-center font-medium text-gray-600 p-2 rotate-45 origin-center">
            {cls}
          </div>
        ))}
        {classes.map((predictedClass) => (
          <React.Fragment key={predictedClass}>
            <div className="text-right font-medium text-gray-600 p-2 flex items-center justify-end">
              {predictedClass}
            </div>
            {classes.map((actualClass) => {
              const cell = data.find(d => d.actual === actualClass && d.predicted === predictedClass);
              const isCorrect = actualClass === predictedClass;
              const cellStyle = getCellStyle(cell, isCorrect);
              return (
                <button
                  key={`${actualClass}-${predictedClass}`}
                  type="button"
                  onClick={() => onCellClick(cell)}
                  className="aspect-square flex items-center justify-center text-xs font-medium rounded border border-gray-200 transition-transform hover:scale-105 hover:shadow-sm cursor-pointer"
                  style={cellStyle}
                  title={`${actualClass} -> ${predictedClass}: ${cell ? cell.count : 0} cases${!isCorrect && cell && cell.count > 0 ? ' (Click to see examples)' : ''}`}
                >
                  {cell ? cell.count : 0}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ImageErrorDialog = ({ cell, open, onClose }) => {
  if (!cell || !cell.incorrectImages || cell.incorrectImages.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Classification Errors: {cell.actual} -&gt; {cell.predicted}
          </DialogTitle>
          <DialogDescription>
            The model incorrectly predicted &quot;{cell.predicted}&quot; when the actual class was &quot;{cell.actual}&quot; in these {cell.count} cases.
            Here are some example images:
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {cell.incorrectImages.map((image, index) => (
            <Card key={index} className="border-red-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{image.name}</span>
                  <Badge variant="destructive" className="text-xs">
                    Confidence: {Math.round(image.confidence * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <img 
                  src={image.url} 
                  alt={image.name}
                  className="w-full h-32 object-cover rounded border"
                />
                <div className="mt-2 text-xs text-gray-600">
                  <p><span className="font-medium">Ground Truth:</span> {cell.actual}</p>
                  <p><span className="font-medium">Predicted:</span> {cell.predicted}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Alert className="mt-4 border-blue-200 bg-blue-50">
          <Wand2 className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Recommendation:</strong> Review these images in the annotation studio. 
            Consider adding more similar examples or refining the class definitions to improve model performance.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
};

const LogicRuleCard = ({ rule, imageLookup, totalImages }) => {
  const passRateValue = Number.isFinite(Number(rule.pass_rate))
    ? Number(rule.pass_rate)
    : null;
  const passRate = passRateValue === null ? null : Math.round(passRateValue * 100);
  const isGoodPerformance = passRate !== null && passRate >= 80;
  const isOkPerformance = passRate !== null && passRate >= 60;
  const failedImages = Array.isArray(rule.failed_images) ? rule.failed_images : [];
  const totalCount = Number.isFinite(Number(totalImages)) ? Number(totalImages) : 0;
  const summaryLabel = passRate === null ? "Not evaluated" : `${passRate}% Pass Rate`;
  const ruleDetails =
    rule.details ||
    rule.description ||
    rule.condition ||
    rule.operator ||
    rule.rule_type ||
    "No evaluation data available yet.";
  
  return (
    <Card className={`border-l-4 ${
      isGoodPerformance ? 'border-l-blue-500 bg-blue-50' : 
      isOkPerformance ? 'border-l-yellow-500 bg-yellow-50' : 
      passRate === null ? 'border-l-slate-400 bg-slate-50' : 'border-l-red-500 bg-red-50'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{rule.rule_name}</CardTitle>
          <div className="flex items-center gap-2">
            {passRate === null ? (
              <AlertTriangle className="w-5 h-5 text-slate-500" />
            ) : isGoodPerformance ? (
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <Badge variant={isGoodPerformance ? "default" : "destructive"} className="bg-white">
              {summaryLabel}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Performance</span>
            <span className={`font-medium ${isGoodPerformance ? 'text-blue-700' : isOkPerformance ? 'text-yellow-700' : passRate === null ? 'text-slate-600' : 'text-red-700'}`}>
              {passRate === null ? "Not evaluated" : `${failedImages.length}/${totalCount} images failed`}
            </span>
          </div>
          {passRate !== null && (
            <Progress 
              value={passRate} 
              className={`h-2 ${
                isGoodPerformance ? '[&>div]:bg-blue-600' : 
                isOkPerformance ? '[&>div]:bg-yellow-600' : 
                '[&>div]:bg-red-600'
              }`} 
            />
          )}
          <p className="text-sm text-gray-600">{ruleDetails}</p>
          
          {failedImages.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Failed on images:</p>
              <div className="flex flex-wrap gap-1">
                {failedImages.slice(0, 3).map(imageId => {
                  const image = imageLookup[imageId];
                  return image ? (
                    <Badge key={imageId} variant="outline" className="text-xs">
                      {image.name}
                    </Badge>
                  ) : null;
                })}
                {failedImages.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{failedImages.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function AnnotationReviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [trainingRun, setTrainingRun] = useState(null);
  const [validationImages, setValidationImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [predictions, setPredictions] = useState({});
  const [groundTruths, setGroundTruths] = useState({});
  const [logicResults, setLogicResults] = useState([]);
  const [confusionMatrix, setConfusionMatrix] = useState([]);
  const [confusionClasses, setConfusionClasses] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showGroundTruth, setShowGroundTruth] = useState(true);
  const [showPredictions, setShowPredictions] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [imageError, setImageError] = useState("");
  const imageRef = useRef(null);
  const [imageScale, setImageScale] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    displayWidth: 0,
    displayHeight: 0,
  });

  const runId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('runId');
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    const loadReviewData = async () => {
      if (!runId) {
        setLoadError("Missing training run id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const runs = await TrainingRun.filter({ id: runId });
        if (!runs.length) {
          throw new Error("Training run not found.");
        }
        const run = runs[0];
        const [steps, stepImages, predictedRows, logicRules] = await Promise.all([
          SOPStep.filter({ id: run.step_id }),
          StepImage.filter({ step_id: run.step_id }),
          PredictedAnnotation.filter({ run_id: runId }),
          LogicRule.filter({ step_id: run.step_id }),
        ]);

        const stepRecord = steps[0] || null;
        const stepClasses = Array.isArray(stepRecord?.classes) ? stepRecord.classes : [];

        const sortedImages = [...(stepImages || [])].sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return aTime - bTime;
        });

        const isValidationGroup = (group) => {
          const normalized = String(group || "").toLowerCase();
          if (!normalized) return false;
          return ["validation", "val", "inference", "test", "testing"].includes(normalized);
        };

        let validationSet = sortedImages.filter((image) => isValidationGroup(image.image_group));
        if (!validationSet.length) {
          validationSet = sortedImages;
        }
        const validationSetWithUrls = await Promise.all(
          validationSet.map(async (image) => {
            const resolved_url = await resolveImageUrl(image);
            return {
              ...image,
              resolved_url,
            };
          })
        );

        const predictionsByImage = {};
        (predictedRows || []).forEach((row) => {
          if (!row?.step_image_id) return;
          const rawList = toAnnotationArray(row.annotations);
          const normalized = rawList
            .map((annotation, index) => normalizePrediction(annotation, index, stepClasses, row.id))
            .filter(Boolean);
          if (!predictionsByImage[row.step_image_id]) {
            predictionsByImage[row.step_image_id] = [];
          }
          predictionsByImage[row.step_image_id].push(...normalized);
        });

        const groundTruthByImage = {};
        validationSetWithUrls.forEach((image) => {
          const rawList = toAnnotationArray(image.annotations);
          groundTruthByImage[image.id] = rawList
            .map((annotation, index) => normalizeGroundTruth(annotation, index, stepClasses, image.id))
            .filter(Boolean);
        });

        const evaluatedPredictions = {};
        const evaluatedGroundTruths = {};
        const classSet = new Set();
        const confusionCounts = new Map();
        let hasBackground = false;

        const addConfusionEntry = (actual, predicted, image, confidence) => {
          const key = `${actual}||${predicted}`;
          const entry = confusionCounts.get(key) || {
            actual,
            predicted,
            count: 0,
            incorrectImages: [],
          };
          entry.count += 1;
          if (actual !== predicted && image && entry.incorrectImages.length < 3) {
              entry.incorrectImages.push({
                id: image.id,
                url: image.resolved_url || image.display_url || image.image_url || image.thumbnail_url,
                name: image.image_name || image.name || image.image_url?.split("/").pop(),
                confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : 0,
              });
            }
          confusionCounts.set(key, entry);
        };

        validationSetWithUrls.forEach((image) => {
          const preds = predictionsByImage[image.id] || [];
          const gts = groundTruthByImage[image.id] || [];
          const { predictions: matchedPreds, groundTruths: matchedGts } = evaluateImage(preds, gts);

          evaluatedPredictions[image.id] = matchedPreds;
          evaluatedGroundTruths[image.id] = matchedGts;

          matchedPreds.forEach((pred) => {
            const actual = pred.matched_ground_truth ? pred.matched_ground_truth.class : BACKGROUND_CLASS;
            const predicted = pred.predicted_class;
            if (!pred.matched_ground_truth) {
              hasBackground = true;
            }
            if (!predicted) return;
            classSet.add(predicted);
            if (actual) classSet.add(actual);
            addConfusionEntry(actual, predicted, image, pred.confidence_score);
          });

          matchedGts.forEach((gt) => {
            if (gt.match === "false_negative") {
              hasBackground = true;
              classSet.add(gt.class);
              addConfusionEntry(gt.class, BACKGROUND_CLASS, image, 0);
            }
          });
        });

        if (hasBackground) {
          classSet.add(BACKGROUND_CLASS);
        }

        const classes = Array.from(classSet).filter(Boolean);
        if (classes.includes(BACKGROUND_CLASS)) {
          classes.sort((a, b) => (a === BACKGROUND_CLASS ? 1 : b === BACKGROUND_CLASS ? -1 : a.localeCompare(b)));
        } else {
          classes.sort((a, b) => a.localeCompare(b));
        }

        const confusionData = [];
        classes.forEach((actual) => {
          classes.forEach((predicted) => {
            const entry = confusionCounts.get(`${actual}||${predicted}`);
            confusionData.push({
              actual,
              predicted,
              count: entry ? entry.count : 0,
              isCorrect: actual === predicted,
              incorrectImages: entry ? entry.incorrectImages : [],
            });
          });
        });

        const normalizedLogicRules = (logicRules || []).map((rule) => ({
          ...rule,
          pass_rate: Number.isFinite(Number(rule.pass_rate)) ? Number(rule.pass_rate) : null,
          failed_images: Array.isArray(rule.failed_images) ? rule.failed_images : [],
        }));

        if (cancelled) return;
        setTrainingRun(run);
        setValidationImages(validationSetWithUrls);
        setPredictions(evaluatedPredictions);
        setGroundTruths(evaluatedGroundTruths);
        setLogicResults(normalizedLogicRules);
        setConfusionMatrix(confusionData);
        setConfusionClasses(classes);
        setCurrentImageIndex(0);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load validation data:", error);
          setLoadError("Unable to load validation data.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadReviewData();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  const currentImage = validationImages[currentImageIndex];
  const currentImageId = currentImage?.id;
  const currentPredictions = useMemo(
    () => (currentImageId ? predictions[currentImageId] || [] : []),
    [currentImageId, predictions]
  );
  const currentGroundTruths = useMemo(
    () => (currentImageId ? groundTruths[currentImageId] || [] : []),
    [currentImageId, groundTruths]
  );
  const imageLookup = useMemo(() => (
    validationImages.reduce((acc, image) => {
      acc[image.id] = {
        id: image.id,
        name: image.image_name || image.name || image.image_url?.split("/").pop() || image.id,
      };
      return acc;
    }, {})
  ), [validationImages]);
  const imageStats = useMemo(() => {
    const truePositives = currentPredictions.filter(p => p.match === 'true_positive').length;
    const falsePositives = currentPredictions.filter(p => p.match === 'false_positive').length;
    const falseNegatives = currentGroundTruths.filter(gt => gt.match === 'false_negative').length;
    const totalGroundTruth = currentGroundTruths.length;
    const totalPredictions = currentPredictions.length;
    const precision = (truePositives + falsePositives) > 0
      ? (truePositives / (truePositives + falsePositives)) * 100
      : null;
    const recall = totalGroundTruth > 0 ? (truePositives / totalGroundTruth) * 100 : null;
    return {
      truePositives,
      falsePositives,
      falseNegatives,
      totalGroundTruth,
      totalPredictions,
      precision,
      recall,
    };
  }, [currentPredictions, currentGroundTruths]);

  const goToNextImage = () => setCurrentImageIndex(prev => Math.min(prev + 1, validationImages.length - 1));
  const goToPrevImage = () => setCurrentImageIndex(prev => Math.max(prev - 1, 0));

  const handleConfusionCellClick = (cell) => {
    if (cell && !cell.isCorrect && cell.count > 0) {
      setSelectedCell(cell);
      setShowErrorDialog(true);
    }
  };

  const evaluatedLogicRules = logicResults.filter((rule) =>
    Number.isFinite(Number(rule.pass_rate))
  );
  const overallLogicPassRate = evaluatedLogicRules.length > 0
    ? Math.round(
        (evaluatedLogicRules.reduce((sum, rule) => sum + Number(rule.pass_rate), 0) / evaluatedLogicRules.length) *
          100
      )
    : null;

  const currentImageUrl = currentImage
    ? (currentImage.resolved_url || currentImage.display_url || currentImage.image_url || currentImage.thumbnail_url)
    : "";
  const scaleX = imageScale.naturalWidth ? imageScale.displayWidth / imageScale.naturalWidth : 1;
  const scaleY = imageScale.naturalHeight ? imageScale.displayHeight / imageScale.naturalHeight : 1;
  const updateImageScale = useCallback(() => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    setImageScale((prev) => ({
      ...prev,
      displayWidth: rect.width,
      displayHeight: rect.height,
    }));
  }, []);
  const handleImageLoad = useCallback((event) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    const rect = event.currentTarget.getBoundingClientRect();
    setImageScale({
      naturalWidth,
      naturalHeight,
      displayWidth: rect.width,
      displayHeight: rect.height,
    });
    setIsImageLoading(false);
    setImageError("");
  }, []);
  const handleImageError = useCallback(() => {
    setIsImageLoading(false);
    setImageError("Failed to load this image.");
  }, []);

  useEffect(() => {
    updateImageScale();
  }, [currentImageUrl, updateImageScale]);

  useEffect(() => {
    setIsImageLoading(true);
    setImageError("");
    setImageScale({
      naturalWidth: 0,
      naturalHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
    });
  }, [currentImageUrl]);

  useEffect(() => {
    const handleResize = () => updateImageScale();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateImageScale]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <BarChart3 className="w-8 h-8 animate-pulse text-blue-600" />
          </div>
          <p className="text-gray-700 font-medium">Loading validation results...</p>
          <p className="text-sm text-gray-500 mt-1">Preparing images, metrics, and logic checks</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">{loadError}</p>
          <Button onClick={() => navigate(createPageUrl('TrainingConfiguration'))}>
            Back to Training
          </Button>
        </div>
      </div>
    );
  }

  if (!trainingRun) {
    return <div className="flex items-center justify-center h-screen">Training run not found.</div>;
  }

  if (!currentImage) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <p className="text-sm text-gray-600">No validation images available for this run.</p>
          <Button onClick={() => navigate(createPageUrl(`TrainingStatus?runId=${trainingRun.id}`))}>
            Back to Training Status
          </Button>
        </div>
      </div>
    );
  }

  const classes = confusionClasses.length ? confusionClasses : [BACKGROUND_CLASS];

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 w-full">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl(`TrainingStatus?runId=${trainingRun.id}`))}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Model Validation Review</h1>
              <p className="text-xs sm:text-sm text-gray-600">Reviewing predictions for model: <span className="font-semibold">{trainingRun.run_name}</span></p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <Badge className={`${
              overallLogicPassRate === null
                ? 'bg-slate-100 text-slate-700'
                : overallLogicPassRate >= 80
                  ? 'bg-blue-100 text-blue-800'
                  : overallLogicPassRate >= 60
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
            }`}>
              Logic Compliance: {overallLogicPassRate === null ? 'N/A' : `${overallLogicPassRate}%`}
            </Badge>
            <Button
              size="sm"
              onClick={() => navigate(createPageUrl(`AnnotationStudio?projectId=${trainingRun.project_id}`))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Re-annotate This Project
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Tabs defaultValue="logic-results" className="flex-1 flex flex-col">
          <div className="bg-white border-b px-6 py-2">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3">
              <TabsTrigger value="logic-results" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Logic Rule Results
              </TabsTrigger>
              <TabsTrigger value="confusion-matrix" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Confusion Matrix
              </TabsTrigger>
              <TabsTrigger value="image-viewer" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Image Viewer
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="logic-results" className="flex-1 p-6 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Business Logic Validation</h2>
                <p className="text-gray-600">
                  Results of running your trained model against the business rules you defined. 
                  Rules with low pass rates indicate areas where the model needs improvement.
                </p>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {logicResults.map((rule) => (
                    <LogicRuleCard
                      key={rule.id}
                      rule={rule}
                      imageLookup={imageLookup}
                      totalImages={validationImages.length}
                    />
                  ))}
                  
                  {logicResults.length === 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <Target className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        No logic rules found for this step. Go to the Logic Builder to define business rules for validation.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
          
          <TabsContent value="confusion-matrix" className="flex-1 p-6 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Confusion Matrix</h2>
                <p className="text-gray-600 mb-4">
                  Click on any cell to see which specific images caused classification errors.
                </p>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-sm border p-6 max-w-2xl w-full">
                  <InteractiveConfusionMatrix 
                    data={confusionMatrix}
                    classes={classes}
                    onCellClick={handleConfusionCellClick}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="image-viewer" className="flex-1 overflow-hidden">
            {/* Image Viewer Content - keeping existing implementation */}
            <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* Image Viewer */}
              <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center bg-gray-900 p-4 relative">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8 bg-white/90" onClick={goToPrevImage} disabled={currentImageIndex === 0}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium text-white bg-black/60 px-2 py-1 rounded">
                    Image {currentImageIndex + 1} of {validationImages.length}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8 bg-white/90" onClick={goToNextImage} disabled={currentImageIndex === validationImages.length - 1}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="relative inline-block">
                  {currentImageUrl ? (
                    <img
                      ref={imageRef}
                      src={currentImageUrl}
                      alt="Validation"
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      className="max-h-[85vh] max-w-[70vw] object-contain rounded shadow-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-8 text-white/80">
                      <ImageIcon className="h-6 w-6" />
                      <p className="text-sm">No image available for this entry.</p>
                    </div>
                  )}

                  {isImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-sm font-medium text-white">
                      Loading image...
                    </div>
                  )}

                  {imageError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded bg-black/60 px-6 text-center text-sm text-white">
                      <p>{imageError}</p>
                      {currentImageUrl && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => window.open(currentImageUrl, "_blank", "noopener,noreferrer")}
                        >
                          Open original
                        </Button>
                      )}
                    </div>
                  )}

                  {!isImageLoading && !imageError && showGroundTruth && currentGroundTruths.map(gt => (
                    <BoundingBox
                      key={gt.id}
                      box={gt.bounding_box}
                      color="border-blue-500"
                      label={`GT: ${gt.class}`}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    />
                  ))}

                  {!isImageLoading && !imageError && showPredictions && currentPredictions.map(p => (
                    <BoundingBox
                      key={p.id}
                      box={p.bounding_box}
                      color={p.match === 'true_positive' ? 'border-blue-500' : 'border-red-500'}
                      label={`Pred: ${p.predicted_class} (${(p.confidence_score * 100).toFixed(0)}%)`}
                      scaleX={scaleX}
                      scaleY={scaleY}
                    />
                  ))}
                </div>
              </div>

              {/* Side Panel */}
              <aside className="w-full lg:w-80 bg-white border-l border-gray-200 p-6 flex flex-col gap-4 overflow-y-auto">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Image Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Precision</span>
                        <span>{imageStats.precision === null ? "N/A" : `${imageStats.precision.toFixed(1)}%`}</span>
                      </div>
                      <Progress value={imageStats.precision ?? 0} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Recall</span>
                        <span>{imageStats.recall === null ? "N/A" : `${imageStats.recall.toFixed(1)}%`}</span>
                      </div>
                      <Progress value={imageStats.recall ?? 0} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Predictions</span>
                      <span>{imageStats.totalPredictions}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>Ground truth</span>
                      <span>{imageStats.totalGroundTruth}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Overlay Controls</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Ground truth boxes</span>
                      <Switch checked={showGroundTruth} onCheckedChange={setShowGroundTruth} />
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Prediction boxes</span>
                      <Switch checked={showPredictions} onCheckedChange={setShowPredictions} />
                    </div>
                  </CardContent>
                </Card>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <span className="font-medium text-blue-800">Correct Detections</span>
                    <Badge variant="secondary">{imageStats.truePositives}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <span className="font-medium text-red-800">False Detections</span>
                    <Badge variant="destructive">{imageStats.falsePositives}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                    <span className="font-medium text-yellow-800">Missed Detections</span>
                    <Badge className="bg-yellow-200 text-yellow-900">{imageStats.falseNegatives}</Badge>
                  </div>
                </div>
                
                <Alert className="border-blue-300 bg-blue-50">
                  <Wand2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    Low recall? Add more examples of missed objects. High false detections? Add more negative examples.
                  </AlertDescription>
                </Alert>
              </aside>
            </main>
          </TabsContent>
        </Tabs>
      </div>

      {/* Error Dialog */}
      <ImageErrorDialog 
        cell={selectedCell} 
        open={showErrorDialog} 
        onClose={() => setShowErrorDialog(false)} 
      />
    </div>
  );
}
