import React, { useRef, useState } from "react";
import { StepImage } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  Star,
  StarOff,
  Trash2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  X,
  Plus,
  Eye
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function ImagePortal({ 
  currentStep, 
  stepImages, 
  currentImageIndex, 
  onImageIndexChange, 
  onImagesUpdate 
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  const handleFileUpload = async (files) => {
    if (!currentStep || !files.length) return;

    setIsUploading(true);
    
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress(Math.round(((i + 0.5) / files.length) * 100));
        
        const { file_url } = await UploadFile({ file });
        
        await StepImage.create({
          step_id: currentStep.id,
          image_url: file_url,
          image_name: file.name,
          is_primary: stepImages.length === 0 && i === 0,
          description: ""
        });
        
        setUploadProgress(Math.round(((i + 1) / files.length) * 100));
      }
      
      onImagesUpdate();
    } catch (error) {
      console.error("Error uploading images:", error);
    }
    
    setIsUploading(false);
    setUploadProgress(0);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      handleFileUpload(imageFiles);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const setPrimaryImage = async (imageId) => {
    try {
      // Remove primary status from all images
      for (const img of stepImages) {
        if (img.is_primary) {
          await StepImage.update(img.id, { is_primary: false });
        }
      }
      
      // Set new primary image
      await StepImage.update(imageId, { is_primary: true });
      onImagesUpdate();
    } catch (error) {
      console.error("Error setting primary image:", error);
    }
  };

  const deleteImage = async (imageId) => {
    try {
      await StepImage.delete(imageId);
      onImagesUpdate();
      
      // Adjust current index if needed
      if (currentImageIndex >= stepImages.length - 1) {
        onImageIndexChange(Math.max(0, stepImages.length - 2));
      }
    } catch (error) {
      console.error("Error deleting image:", error);
    }
  };

  const openPreview = (image) => {
    setPreviewImage(image);
    setShowPreview(true);
  };

  const currentImage = stepImages[currentImageIndex];

  if (!currentStep) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a step to manage images</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Image Portal</h2>
            <p className="text-gray-600 mt-1">
              Manage images for "{currentStep.class}" annotation
            </p>
          </div>
          <Button
            onClick={() => fileInputRef.current?.click()}
            className="bg-teal-600 hover:bg-teal-700"
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Images
          </Button>
        </div>

        {isUploading && (
          <div className="mt-4">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-gray-600 mt-1">
              Uploading images... {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex-1 flex">
        {/* Image Viewer */}
        <div className="flex-1 p-6">
          {stepImages.length === 0 ? (
            <div
              className="h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Images Uploaded
                </h3>
                <p className="text-gray-600 mb-6">
                  Upload images to annotate for this step
                </p>
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Image
                </Button>
                <p className="text-sm text-gray-500 mt-4">
                  or drag and drop images here
                </p>
              </div>
            </div>
          ) : (
            <Card className="h-full glass-effect border-0 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {currentImageIndex + 1} of {stepImages.length}
                    </Badge>
                    {currentImage?.is_primary && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                        <Star className="w-3 h-3 mr-1" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onImageIndexChange(Math.max(0, currentImageIndex - 1))}
                      disabled={currentImageIndex === 0}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onImageIndexChange(Math.min(stepImages.length - 1, currentImageIndex + 1))}
                      disabled={currentImageIndex === stepImages.length - 1}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPreview(currentImage)}
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 p-4">
                {currentImage && (
                  <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={currentImage.image_url}
                      alt={currentImage.image_name}
                      className="max-w-full max-h-full object-contain"
                      style={{ transform: `scale(${zoom / 100})` }}
                    />
                  </div>
                )}
                
                {/* Zoom Controls */}
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </Button>
                  <span className="text-sm text-gray-600 min-w-[60px] text-center">
                    {zoom}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(100)}
                  >
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Image List Sidebar */}
        {stepImages.length > 0 && (
          <div className="w-80 bg-white border-l border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-4">
              All Images ({stepImages.length})
            </h3>
            
            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
              <AnimatePresence>
                {stepImages.map((image, index) => (
                  <motion.div
                    key={image.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className={`cursor-pointer transition-all duration-200 ${
                      index === currentImageIndex 
                        ? "ring-2 ring-teal-500 shadow-md" 
                        : "hover:shadow-sm"
                    }`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0"
                            onClick={() => onImageIndexChange(index)}
                          >
                            <img
                              src={image.image_url}
                              alt={image.image_name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {image.image_name}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {image.is_primary && (
                                <Badge className="bg-amber-100 text-amber-800 text-xs">
                                  Primary
                                </Badge>
                              )}
                              <span className="text-xs text-gray-500">
                                #{index + 1}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setPrimaryImage(image.id)}
                              className="h-6 w-6 p-0"
                            >
                              {image.is_primary ? (
                                <Star className="w-3 h-3 text-amber-500" />
                              ) : (
                                <StarOff className="w-3 h-3" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteImage(image.id)}
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
            onClick={() => setShowPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-4xl max-h-4xl p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="absolute top-4 right-4 z-10 bg-white"
                >
                  <X className="w-4 h-4" />
                </Button>
                <img
                  src={previewImage.image_url}
                  alt={previewImage.image_name}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}