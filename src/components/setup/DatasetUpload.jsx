import { useState, useEffect, useRef, useCallback } from "react";
import { SOPStep } from "@/api/entities";
import { uploadToSupabaseStorage } from "@/api/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload,
  CheckCircle,
  X,
  ArrowRight,
  AlertCircle,
  Folder
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DatasetUpload({ projectId, onComplete }) {
  const [uploadingSteps, setUploadingSteps] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [completedSteps, setCompletedSteps] = useState(new Set());
  const [error, setError] = useState(null);
  const [stepsData, setStepsData] = useState([]);
  const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";

  const isYamlFile = (file) => /\.(ya?ml)$/i.test(file?.name || "");
  const toSafeSegment = (value) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

  const buildDatasetYaml = (classes = []) => {
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

  const uploadGeneratedYaml = async (stepId, classes) => {
    const yamlContent = buildDatasetYaml(classes);
    const blob = new Blob([yamlContent], { type: "text/plain" });
    const storagePath = `${projectId}/${stepId}/data.yaml`;
    return uploadToSupabaseStorage(blob, storagePath, {
      bucket: DATASET_BUCKET,
      contentType: "text/plain",
    });
  };

  const loadStepsData = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await SOPStep.filter({ project_id: projectId }, 'step_number');
      setStepsData(data);
      
      const completed = new Set();
      data.forEach(step => {
        if (step.has_dataset) {
          completed.add(step.id);
        }
      });
      setCompletedSteps(completed);
    } catch (error) {
      console.error("Error loading steps data:", error);
    }
  }, [projectId]);

  useEffect(() => {
    loadStepsData();
  }, [loadStepsData]);

  const handleFileUpload = async (stepId, file) => {
    setUploadingSteps(prev => ({ ...prev, [stepId]: true }));
    setUploadProgress(prev => ({ ...prev, [stepId]: 0 }));
    setError(null);

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [stepId]: Math.min(95, (prev[stepId] || 0) + 10)
        }));
      }, 200);

      const safeName = toSafeSegment(file.name || "dataset");
      const storagePath = `${projectId}/${stepId}/${Date.now()}-${safeName}`;
      const { path, publicUrl } = await uploadToSupabaseStorage(file, storagePath, {
        bucket: DATASET_BUCKET,
      });
      clearInterval(progressInterval);
      
      setUploadProgress(prev => ({ ...prev, [stepId]: 100 }));

      // Update step with dataset info
      const updates = {
        dataset_url: publicUrl,
        dataset_filename: file.name,
        has_dataset: true,
      };
      if (isYamlFile(file)) {
        updates.dataset_yaml_path = `storage:${DATASET_BUCKET}/${path}`;
        updates.dataset_yaml_url = publicUrl;
        updates.dataset_yaml_name = file.name;
      } else {
        const stepRecord = stepsData.find((step) => step.id === stepId);
        const hasYaml = stepRecord?.dataset_yaml_url || stepRecord?.dataset_yaml_path;
        if (!hasYaml) {
          const generated = await uploadGeneratedYaml(stepId, stepRecord?.classes || []);
          updates.dataset_yaml_path = `storage:${DATASET_BUCKET}/${generated.path}`;
          updates.dataset_yaml_url = generated.publicUrl;
          updates.dataset_yaml_name = "data.yaml";
        }
      }
      await SOPStep.update(stepId, updates);

      setCompletedSteps(prev => new Set([...prev, stepId]));
      
      // Clean up progress after success
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[stepId];
          return newProgress;
        });
      }, 2000);

    } catch (error) {
      console.error("Error uploading dataset:", error);
      setError(`Failed to upload dataset for this step. Please try again.`);
    }

    setUploadingSteps(prev => ({ ...prev, [stepId]: false }));
  };

  const removeDataset = async (stepId) => {
    try {
      await SOPStep.update(stepId, {
        dataset_url: null,
        dataset_filename: null,
        has_dataset: false
      });

      setCompletedSteps(prev => {
        const newSet = new Set(prev);
        newSet.delete(stepId);
        return newSet;
      });
    } catch (error) {
      console.error("Error removing dataset:", error);
      setError("Failed to remove dataset. Please try again.");
    }
  };

  const getCompletionPercentage = () => {
    if (stepsData.length === 0) return 0;
    return Math.round((completedSteps.size / stepsData.length) * 100);
  };

  const canProceed = completedSteps.size === stepsData.length && stepsData.length > 0;

  return (
    <div>
      {/* Progress Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Dataset Upload Progress
          </h3>
          <Badge className={`${
            canProceed ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"
          } border-0`}>
            {completedSteps.size} of {stepsData.length} completed
          </Badge>
        </div>
        <Progress value={getCompletionPercentage()} className="h-3" />
        <p className="text-sm text-gray-600 mt-2">
          Upload training datasets for each step to proceed to annotation
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Steps List */}
      <div className="space-y-4 mb-8">
        <AnimatePresence>
          {stepsData.map((step, index) => (
            <DatasetUploadCard
              key={step.id}
              step={step}
              index={index}
              isUploading={uploadingSteps[step.id]}
              uploadProgress={uploadProgress[step.id] || 0}
              isCompleted={completedSteps.has(step.id)}
              onFileUpload={(file) => handleFileUpload(step.id, file)}
              onRemoveDataset={() => removeDataset(step.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Action Footer */}
      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-600">
            {canProceed 
              ? "All datasets uploaded! Ready to start annotation."
              : `${stepsData.length - completedSteps.size} steps need datasets`
            }
          </p>
        </div>
        <Button 
          onClick={onComplete}
          disabled={!canProceed}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg"
          size="lg"
        >
          Start Annotation
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function DatasetUploadCard({ 
  step, 
  index, 
  isUploading, 
  uploadProgress, 
  isCompleted, 
  onFileUpload, 
  onRemoveDataset 
}) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.1 }}
    >
      <Card className={`glass-effect border-0 shadow-sm ${
        isCompleted ? "ring-2 ring-blue-200" : ""
      }`}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              isCompleted 
                ? "bg-blue-100" 
                : isUploading 
                  ? "bg-blue-100" 
                  : "bg-gray-100"
            }`}>
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-blue-600" />
              ) : isUploading ? (
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="text-gray-600 font-semibold text-sm">{index + 1}</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{step.title}</h4>
                  <p className="text-sm text-gray-600">{step.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">
                    {step.product}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {step.class}
                  </Badge>
                </div>
              </div>

              {/* Upload Area */}
              {!isCompleted && !isUploading && (
                <div className="mt-4 p-4 border-2 border-dashed border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.json,.xlsx,.zip,.png,.jpg,.jpeg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="text-center">
                    <Folder className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Upload training dataset for this step
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openFileDialog}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                    <p className="text-xs text-gray-500 mt-2">
                      Supports CSV, JSON, images, or ZIP archives
                    </p>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium text-blue-700">
                      Uploading dataset...
                    </span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-blue-600 mt-1">{uploadProgress}% complete</p>
                </div>
              )}

              {/* Completed State */}
              {isCompleted && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-700">
                        Dataset uploaded: {step.dataset_filename}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onRemoveDataset}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
