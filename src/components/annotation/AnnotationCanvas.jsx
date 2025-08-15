import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  CheckCircle,
  Lightbulb,
  X,
  AlertTriangle,
  ImageIcon,
  MousePointer // Added for the prompt
} from "lucide-react";

export default function AnnotationCanvas({
  currentStep,
  currentImage,
  annotationMode,
  activeClass,
  onStepComplete,
  projectId
}) {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [showHints, setShowHints] = useState(true);

  const [effectiveImageProps, setEffectiveImageProps] = useState({
    effectiveImageWidth: 0,
    effectiveImageHeight: 0,
    imageOffsetX: 0,
    imageOffsetY: 0,
    naturalWidth: 0,
    naturalHeight: 0,
  });

  useEffect(() => {
    if (currentStep?.annotation_data) {
      const loadedAnnotations = (currentStep.annotation_data.annotations || []).map(ann => ({
        ...ann,
        class: ann.class || ann.label
      }));
      setAnnotations(loadedAnnotations);
    } else {
      setAnnotations([]);
    }
  }, [currentStep]);

  useEffect(() => {
    const img = imageRef.current;
    if (currentImage && img && img.complete) {
      setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });
    } else if (!currentImage) {
      setCanvasSize({ width: 800, height: 600 });
    }
  }, [currentImage]);

  useEffect(() => {
    const img = imageRef.current;
    if (!img || !currentImage || !canvasSize.width || !canvasSize.height) {
      setEffectiveImageProps({
        effectiveImageWidth: 0, effectiveImageHeight: 0,
        imageOffsetX: 0, imageOffsetY: 0,
        naturalWidth: 0, naturalHeight: 0
      });
      return;
    }

    const logicalCanvasWidth = canvasSize.width;
    const logicalCanvasHeight = canvasSize.height;

    const imgNaturalWidth = img.naturalWidth;
    const imgNaturalHeight = img.naturalHeight;

    let effectiveWidth, effectiveHeight;
    let offsetX = 0;
    let offsetY = 0;

    const aspectRatioImage = imgNaturalWidth / imgNaturalHeight;
    const aspectRatioCanvas = logicalCanvasWidth / logicalCanvasHeight;

    if (aspectRatioCanvas > aspectRatioImage) {
      effectiveHeight = logicalCanvasHeight;
      effectiveWidth = effectiveHeight * aspectRatioImage;
      offsetX = (logicalCanvasWidth - effectiveWidth) / 2;
    } else {
      effectiveWidth = logicalCanvasWidth;
      effectiveHeight = effectiveWidth / aspectRatioImage;
      offsetY = (logicalCanvasHeight - effectiveHeight) / 2;
    }

    setEffectiveImageProps({
      effectiveImageWidth: effectiveWidth,
      effectiveImageHeight: effectiveHeight,
      imageOffsetX: offsetX,
      imageOffsetY: offsetY,
      naturalWidth: imgNaturalWidth,
      naturalHeight: imgNaturalHeight,
    });
  }, [currentImage, zoom, canvasSize]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      setCanvasSize({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight });
    }
  };

  const handleMouseDown = (e) => {
    if (annotationMode !== 'draw' || !currentImage || !canvasRef.current || !effectiveImageProps.naturalWidth || !activeClass) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const xLogicalCanvas = (clientX - rect.left) / zoom;
    const yLogicalCanvas = (clientY - rect.top) / zoom;

    const { effectiveImageWidth, effectiveImageHeight, imageOffsetX, imageOffsetY, naturalWidth } = effectiveImageProps;

    const xOnEffectiveImage = xLogicalCanvas - imageOffsetX;
    const yOnEffectiveImage = yLogicalCanvas - imageOffsetY;

    if (xOnEffectiveImage < 0 || xOnEffectiveImage > effectiveImageWidth ||
        yOnEffectiveImage < 0 || yOnEffectiveImage > effectiveImageHeight) {
      setIsDrawing(false);
      setCurrentAnnotation(null);
      return;
    }

    const scaleFactorToNatural = naturalWidth / effectiveImageWidth;
    const xNaturalImage = xOnEffectiveImage * scaleFactorToNatural;
    const yNaturalImage = yOnEffectiveImage * scaleFactorToNatural;

    setIsDrawing(true);
    setCurrentAnnotation({
      x: xNaturalImage,
      y: yNaturalImage,
      width: 0,
      height: 0,
      class: activeClass,
      status: currentStep?.status || 'neutral'
    });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing || !currentAnnotation || !currentImage || !canvasRef.current || !effectiveImageProps.naturalWidth) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const xLogicalCanvas = (clientX - rect.left) / zoom;
    const yLogicalCanvas = (clientY - rect.top) / zoom;

    const { effectiveImageWidth, imageOffsetX, naturalWidth } = effectiveImageProps;

    const xOnEffectiveImage = xLogicalCanvas - imageOffsetX;
    const yOnEffectiveImage = yLogicalCanvas - imageOffsetY;

    const scaleFactorToNatural = naturalWidth / effectiveImageWidth;
    const xNaturalImage = xOnEffectiveImage * scaleFactorToNatural;
    const yNaturalImage = yOnEffectiveImage * scaleFactorToNatural;

    setCurrentAnnotation(prev => ({
      ...prev,
      width: xNaturalImage - prev.x,
      height: yNaturalImage - prev.y
    }));
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentAnnotation) return;

    let finalX = currentAnnotation.x;
    let finalY = currentAnnotation.y;
    let finalWidth = currentAnnotation.width;
    let finalHeight = currentAnnotation.height;

    if (finalWidth < 0) {
      finalX += finalWidth;
      finalWidth = Math.abs(finalWidth);
    }
    if (finalHeight < 0) {
      finalY += finalHeight;
      finalHeight = Math.abs(finalHeight);
    }

    if (finalWidth > 5 && finalHeight > 5) {
      setAnnotations(prev => [...prev, {
        ...currentAnnotation,
        x: finalX,
        y: finalY,
        width: finalWidth,
        height: finalHeight,
        id: Date.now(),
        stepId: currentStep?.id
      }]);
    }

    setIsDrawing(false);
    setCurrentAnnotation(null);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setAnnotations([]);
    setCurrentAnnotation(null);
    setZoom(1);
    if (currentImage && imageRef.current) {
      setCanvasSize({ width: imageRef.current.naturalWidth, height: imageRef.current.naturalHeight });
    } else {
      setCanvasSize({ width: 800, height: 600 });
    }
  };

  const handleSaveAnnotations = async () => {
    if (!currentStep) return;

    const annotationData = {
      annotations: annotations,
      canvas_size: canvasSize,
      timestamp: new Date().toISOString()
    };

    await onStepComplete(currentStep.id, annotationData);
  };

  const renderAnnotation = (annotation, index) => {
    const { effectiveImageWidth, imageOffsetX, imageOffsetY, naturalWidth } = effectiveImageProps;

    if (!naturalWidth || effectiveImageWidth === 0) {
      return null;
    }

    const scaleFactorFromNatural = effectiveImageWidth / naturalWidth;

    const style = {
      position: 'absolute',
      left: (annotation.x * scaleFactorFromNatural) + imageOffsetX,
      top: (annotation.y * scaleFactorFromNatural) + imageOffsetY,
      width: (annotation.width * scaleFactorFromNatural),
      height: (annotation.height * scaleFactorFromNatural),
      border: '2px solid #0d9488',
      backgroundColor: 'rgba(13, 148, 136, 0.1)',
      zIndex: 10
    };

    return (
      <div key={annotation.id || index} style={style} className="pointer-events-none">
        <Badge className="absolute -top-6 left-0 bg-teal-600 text-white text-xs">
          {annotation.class} ({annotation.status})
        </Badge>
      </div>
    );
  };

  const renderHints = () => {
    if (!showHints || !currentStep) return null;

    return (
      <div className="absolute top-4 right-4 bg-white border border-teal-200 rounded-lg p-3 shadow-lg max-w-xs z-20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-teal-600" />
            <span className="text-sm font-medium text-gray-900">Annotation Hint</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHints(false)}
            className="h-6 w-6 p-0"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
        <p className="text-xs text-gray-700">
          Look for <strong>{(currentStep.classes || []).join(', ')}</strong> elements and annotate them with the <strong>{currentStep.status}</strong> label.
        </p>
        {currentStep.needs_clarification && (
          <p className="text-xs text-amber-700 mt-2 flex items-center">
            <AlertTriangle className="w-3 h-3 mr-1" /> This step may need clarification. Check the AI chat for guidance.
          </p>
        )}
      </div>
    );
  };

  const renderCanvasContent = () => {
    if (!currentImage) {
      return (
        <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
          <div className="text-center text-gray-500">
            <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No image selected for annotation</p>
            <p className="text-sm">Upload images in the Images tab</p>
          </div>
        </div>
      );
    }
    
    // Prompt to select a class if none is active
    if (!activeClass) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-100 rounded-lg">
                <div className="text-center text-gray-600 bg-white p-8 rounded-lg shadow-md">
                    <MousePointer className="w-12 h-12 mx-auto mb-4 text-teal-600" />
                    <h3 className="font-semibold text-lg mb-2">Select a Class to Begin</h3>
                    <p className="text-sm">Please choose a class from the AI Copilot panel on the right to start annotating.</p>
                </div>
            </div>
        );
    }

    return (
      <div className="relative h-full w-full">
        <img
          ref={imageRef}
          src={currentImage.image_url}
          alt={currentImage.image_name}
          className="w-full h-full object-contain"
          onLoad={handleImageLoad}
        />
        {annotations.map((annotation, index) => renderAnnotation(annotation, index))}
        {currentAnnotation && renderAnnotation(currentAnnotation, -1)}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm">
              Mode: {annotationMode}
            </Badge>
            <Badge variant="outline" className="text-sm">
              Zoom: {Math.round(zoom * 100)}%
            </Badge>
            {annotations.length > 0 && (
              <Badge className="bg-teal-100 text-teal-800 border-teal-200">
                {annotations.length} annotations
              </Badge>
            )}
            {activeClass && (
              <Badge variant="outline" className="text-sm border-teal-500 text-teal-600">
                Class: {activeClass}
              </Badge>
            )}
            {currentImage && (
              <Badge variant="outline" className="text-sm">
                Image: {currentImage.image_name}
              </Badge>
            )}
            {currentStep?.needs_clarification && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs clarification
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHints(true)}
            >
              <Lightbulb className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSaveAnnotations}
              disabled={annotations.length === 0}
              className="bg-teal-600 hover:bg-teal-700"
              size="sm"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Step
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-auto bg-gray-100 p-8 relative">
        {renderHints()}

        <Card className="mx-auto relative shadow-lg" style={{
          width: canvasSize.width * zoom,
          height: canvasSize.height * zoom,
          minWidth: '800px',
          minHeight: '600px'
        }}>
          <div
            ref={canvasRef}
            className={`w-full h-full bg-white relative ${!activeClass || annotationMode !== 'draw' ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
            style={{
              transform: `scale(1)`,
              transformOrigin: 'top left',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          >
            {renderCanvasContent()}
          </div>
        </Card>
      </div>
    </div>
  );
}