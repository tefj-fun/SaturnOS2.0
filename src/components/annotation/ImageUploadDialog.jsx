
import React, { useState, useMemo, useCallback } from "react";
import { StepImage } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { UploadCloud, File, X, ChevronRight, ChevronLeft, Sprout, TestTube2, Folder, Loader2 } from "lucide-react";
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

export default function ImageUploadDialog({ open, onOpenChange, onUploadComplete, currentStepId }) {
  const [step, setStep] = useState('select'); // 'select', 'split', 'uploading'
  const [files, setFiles] = useState([]);
  
  // Split configuration state
  const [splitType, setSplitType] = useState('auto'); // 'auto', 'manual'
  const [trainingRatio, setTrainingRatio] = useState(80);
  const [inferenceRatio, setInferenceRatio] = useState(20);
  const [otherGroupName, setOtherGroupName] = useState("Validation");

  const otherRatio = useMemo(() => {
    const calculatedOther = 100 - trainingRatio - inferenceRatio;
    return Math.max(0, calculatedOther); // Ensure ratio is not negative
  }, [trainingRatio, inferenceRatio]);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("Preparing upload...");

  const handleFileSelect = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map(file => ({
      file,
      id: `${file.name}-${file.size}-${file.lastModified}`,
      preview: URL.createObjectURL(file),
    }));
    setFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      return [...prev, ...newFiles.filter(f => !existingIds.has(f.id))];
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleClose = () => {
    // Reset state when closing dialog
    setFiles([]);
    setStep('select');
    setSplitType('auto');
    setTrainingRatio(80);
    setInferenceRatio(20);
    setOtherGroupName("Validation");
    setIsUploading(false);
    setUploadProgress(0);
    setUploadMessage("Preparing upload...");
    onOpenChange(false);
  };

  const startUploadProcess = async () => {
    if (files.length === 0 || !currentStepId) return;

    setStep('uploading');
    setIsUploading(true);

    const shuffledFiles = shuffleArray([...files]);
    const totalFiles = shuffledFiles.length;

    let splits;
    if (splitType === 'auto') {
      splits = { Training: 0.8, Inference: 0.2 };
    } else {
      const otherRatioValue = otherRatio > 0 ? otherRatio : 0;
      splits = {
        Training: trainingRatio / 100,
        Inference: inferenceRatio / 100,
      };
      if (otherRatioValue > 0 && otherGroupName.trim()) {
        splits[otherGroupName.trim()] = otherRatioValue / 100;
      }
    }

    // Ensure Training and Inference always exist as groups, even if empty
    if (!splits.Training) splits.Training = 0;
    if (!splits.Inference) splits.Inference = 0;

    const assignments = {};
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

    try {
      let filesUploaded = 0;
      for (const [groupName, groupFiles] of Object.entries(assignments)) {
        if (!groupFiles || groupFiles.length === 0) continue;
        for (const fileWrapper of groupFiles) {
          filesUploaded++;
          setUploadMessage(`Uploading to "${groupName}": ${fileWrapper.file.name}`);
          setUploadProgress(Math.round((filesUploaded / totalFiles) * 100));

          const { file_url } = await UploadFile({ file: fileWrapper.file });

          await StepImage.create({
            step_id: currentStepId,
            image_url: file_url,
            thumbnail_url: `${file_url}?w=300&h=300&fit=crop`,
            display_url: `${file_url}?w=1200`,
            image_name: fileWrapper.file.name,
            file_size: fileWrapper.file.size,
            image_group: groupName, // Assign the calculated group name
            processing_status: 'completed'
          });
        }
      }

      setUploadMessage("Upload complete!");
      setUploadProgress(100);
      await onUploadComplete();
      setTimeout(handleClose, 1000); // Close dialog after a short delay

    } catch (error) {
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
      // If training increases, inference might need to decrease to keep sum <= 100
      if (newTraining + inferenceRatio > 100) {
        setInferenceRatio(100 - newTraining);
      }
    } else if (type === 'inference') {
      const newInference = newValue;
      // Max inference is 100 - current training ratio (as otherRatio is derived)
      const maxAllowedInference = 100 - trainingRatio;
      setInferenceRatio(Math.min(newInference, maxAllowedInference));
    }
  }, [trainingRatio, inferenceRatio]);


  const renderSelectStep = () => (
    <motion.div key="select" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }}>
      <DialogHeader>
        <DialogTitle>Step 1: Select Images</DialogTitle>
        <DialogDescription>Add images you want to upload. You can select multiple images at once.</DialogDescription>
      </DialogHeader>
      <div 
        className="mt-4 p-8 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={(e) => e.preventDefault()}
        onClick={() => document.getElementById('file-upload-input')?.click()}
      >
        <UploadCloud className="w-12 h-12 mx-auto text-gray-400" />
        <p className="mt-2 font-semibold text-gray-700">Drag & drop files here</p>
        <p className="text-sm text-gray-500">or click to browse</p>
        <Input 
          id="file-upload-input"
          type="file" 
          multiple 
          accept="image/*" 
          className="hidden" 
          onChange={(e) => handleFileSelect(e.target.files)} 
        />
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-800 mb-2">{files.length} files selected</h4>
          <ScrollArea className="h-48 border rounded-md p-2">
            <div className="space-y-2">
              {files.map(fileWrapper => (
                <div key={fileWrapper.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                  <img src={fileWrapper.preview} alt="preview" className="w-10 h-10 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{fileWrapper.file.name}</p>
                    <p className="text-xs text-gray-500">{(fileWrapper.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-100" onClick={() => removeFile(fileWrapper.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <DialogFooter className="mt-6">
        <Button variant="outline" onClick={handleClose}>Cancel</Button>
        <Button onClick={() => setStep('split')} disabled={files.length === 0}>
          Next <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogFooter>
    </motion.div>
  );

  const renderSplitStep = () => (
    <motion.div key="split" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <DialogHeader>
        <DialogTitle>Step 2: Configure Image Split</DialogTitle>
        <DialogDescription>
          Assign your {files.length} images into groups for training and inference. Images will be randomly shuffled before assignment.
        </DialogDescription>
      </DialogHeader>

      <div className="py-6 space-y-6">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <label htmlFor="split-type-switch" className="font-medium text-gray-800">
            Automatic Split (80/20)
          </label>
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
              className="space-y-6 overflow-hidden"
            >
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Sprout className="w-5 h-5 text-green-600" />
                  <h4 className="font-medium text-gray-800">Training Group</h4>
                  <Badge variant="outline" className="ml-auto">{trainingRatio}%</Badge>
                </div>
                <Slider
                  value={[trainingRatio]}
                  max={100}
                  step={1}
                  onValueChange={(value) => handleSliderChange(value, 'training')}
                />
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TestTube2 className="w-5 h-5 text-purple-600" />
                  <h4 className="font-medium text-gray-800">Inference Group</h4>
                  <Badge variant="outline" className="ml-auto">{inferenceRatio}%</Badge>
                </div>
                <Slider
                  value={[inferenceRatio]}
                  max={100}
                  step={1}
                  onValueChange={(value) => handleSliderChange(value, 'inference')}
                />
              </div>
              
              {otherRatio > 0 && (
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <Folder className="w-5 h-5 text-gray-600" />
                    <Input 
                      value={otherGroupName}
                      onChange={(e) => setOtherGroupName(e.target.value)}
                      placeholder="Other group name..."
                      className="h-8 flex-1"
                    />
                    <Badge variant="outline" className="ml-auto">{otherRatio}%</Badge>
                  </div>
                   <p className="text-xs text-gray-500 mt-1">This group will contain the remaining {otherRatio}% of images.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DialogFooter className="mt-6">
        <Button variant="outline" onClick={() => setStep('select')}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={startUploadProcess}>
          Upload & Assign {files.length} Images
        </Button>
      </DialogFooter>
    </motion.div>
  );

  const renderUploadingStep = () => (
    <motion.div key="uploading" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
      <DialogHeader>
        <DialogTitle>Uploading...</DialogTitle>
        <DialogDescription>{uploadMessage}</DialogDescription>
      </DialogHeader>
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <Loader2 className="w-16 h-16 text-teal-500 animate-spin mb-6" />
        <div className="w-full max-w-sm">
          <Progress value={uploadProgress} className="mb-2"/>
          <p className="text-sm text-gray-600">{uploadProgress}% complete</p>
        </div>
      </div>
    </motion.div>
  );

  return (
    <Dialog open={open} onOpenChange={!isUploading ? handleClose : () => {}}>
      <DialogContent className="sm:max-w-lg">
        <AnimatePresence mode="wait">
          {step === 'select' && renderSelectStep()}
          {step === 'split' && renderSplitStep()}
          {step === 'uploading' && renderUploadingStep()}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
