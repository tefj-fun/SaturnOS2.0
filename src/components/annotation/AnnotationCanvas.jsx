
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Save,
  ZoomIn,
  ZoomOut,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ImageIcon,
  MousePointer,
  Eye,
  EyeOff,
  Trash2,
  Target,
  Palette,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { updateStepImage } from "@/api/db";

const HANDLE_SIZE = 8; // Size of resize handles in pixels (in screen pixels, adjusted for zoom)
const UNLABELED_CLASS_KEY = "[Unlabeled]"; // Special key for annotations without a class
const POLYGON_CLOSE_THRESHOLD = 15; // In image pixels
const DRAG_THRESHOLD = 3; // Minimum pixels to move to register a drag vs a click

const MAX_VISIBLE_STATUSES = 3;
const HISTORY_LIMIT = 50;
const MAX_SAVE_RETRIES = 2;
const SAVE_RETRY_BASE_MS = 600;
const MIN_SAVING_MS = 600;

// Annotation Toolbar Component
const AnnotationToolbar = React.forwardRef(({ annotation, onStatusChange, onDelete, style, stepStatus }, ref) => {
  // Parse the step status - it could be comma-separated values like "Pass,Fail" or "Good,Bad,Defective"
  const statusOptions = stepStatus ? stepStatus.split(',').map(s => s.trim()) : ['pass', 'fail'];
  const visibleStatusOptions = statusOptions.slice(0, MAX_VISIBLE_STATUSES);
  const overflowStatusOptions = statusOptions.slice(MAX_VISIBLE_STATUSES);

  return (
    <div
      ref={ref}
      style={style}
      className="absolute z-30 flex items-center gap-1 p-1 bg-white rounded-lg shadow-lg border border-gray-200"
      // Prevent clicks on the toolbar from deselecting the annotation
      onMouseDown={(e) => e.stopPropagation()}
    >
      {visibleStatusOptions.map((statusOption) => {
        const isActive = annotation.status === statusOption.toLowerCase();
        const colorClasses = getStatusColorClasses(statusOption, isActive);
        
        return (
          <Button
            key={statusOption}
            size="sm"
            variant={isActive ? 'default' : 'ghost'}
            onClick={() => onStatusChange(statusOption.toLowerCase())}
            className={`h-7 px-2 ${colorClasses}`}
          >
            {getStatusIcon(statusOption)}
            {statusOption}
          </Button>
        );
      })}
      {overflowStatusOptions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-blue-600 hover:bg-blue-50"
            >
              More
              <ChevronDown className="w-3 h-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            {overflowStatusOptions.map((statusOption) => {
              const isActive = annotation.status === statusOption.toLowerCase();
              return (
                <DropdownMenuItem
                  key={statusOption}
                  onSelect={() => onStatusChange(statusOption.toLowerCase())}
                  className={isActive ? "bg-blue-50 text-blue-700 focus:bg-blue-50 focus:text-blue-700" : ""}
                >
                  <span className="mr-2">{getStatusIcon(statusOption)}</span>
                  {statusOption}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 p-0 text-gray-500 hover:text-red-500"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
});

AnnotationToolbar.displayName = "AnnotationToolbar";

// Helper function to get appropriate icon for status
const getStatusIcon = (status) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('pass') || statusLower.includes('good') || statusLower.includes('ok')) {
    return <CheckCircle className="w-4 h-4 mr-1" />;
  } else if (statusLower.includes('fail') || statusLower.includes('bad') || statusLower.includes('error') || statusLower.includes('defective')) {
    return <XCircle className="w-4 h-4 mr-1" />;
  } else {
    return <AlertTriangle className="w-4 h-4 mr-1" />;
  }
};

// Helper function to get appropriate colors for status
const getStatusColorClasses = (status, isActive) => {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('pass') || statusLower.includes('good') || statusLower.includes('ok')) {
    return isActive ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-green-600 hover:bg-green-50';
  } else if (statusLower.includes('fail') || statusLower.includes('bad') || statusLower.includes('error') || statusLower.includes('defective')) {
    return isActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-red-600 hover:bg-red-50';
  } else {
    return isActive ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-blue-600 hover:bg-blue-50';
  }
};

// New: Annotation Labeling Component
const AnnotationLabler = ({ x, y, classes, suggestedClass, onSelect, onCancel }) => {
  const [filterText, setFilterText] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const filteredClasses = useMemo(() => {
    if (!filterText) return classes || [];
    return (classes || []).filter(c => c.toLowerCase().includes(filterText.toLowerCase()));
  }, [filterText, classes]);

  useEffect(() => {
    // Suggest the active class if available and no filter is typed
    if (suggestedClass && !filterText) {
      const idx = filteredClasses.indexOf(suggestedClass);
      if (idx !== -1) {
        setSelectedIndex(idx);
      }
    } else {
      setSelectedIndex(0);
    }
  }, [filteredClasses, suggestedClass, filterText]);
  
  useEffect(() => {
    inputRef.current?.focus();
  }, [updateStepImage]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredClasses.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredClasses[selectedIndex]) {
        onSelect(filteredClasses[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      style={{ left: x, top: y, position: 'absolute' }}
      className="z-50"
      // Stop clicks inside from propagating to the canvas and cancelling the operation
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Card className="w-56 shadow-2xl border-blue-200">
        <div className="p-2">
          <Input
            ref={inputRef}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to filter classes..."
            className="h-8 text-sm"
            autoFocus
          />
        </div>
        <ScrollArea className="h-40">
          <div className="p-2 pt-0">
          {filteredClasses.length > 0 ? filteredClasses.map((cls, index) => (
            <Button
              key={cls}
              variant={selectedIndex === index ? 'default' : 'ghost'}
              className={`w-full justify-start h-8 text-sm mb-1 ${selectedIndex === index ? 'bg-blue-600' : ''}`}
              onClick={() => onSelect(cls)}
            >
              {cls}
            </Button>
          )) : (
            <div className="text-center text-xs text-gray-500 py-2">No matching classes</div>
          )}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
};


export default forwardRef(function AnnotationCanvas({
  currentStep,
  currentImage,
  annotationMode,
  activeClass,
  projectId,
  onNextImage,
  onPrevImage,
  currentImageIndex,
  totalImages,
  brushSize = 10, // Default brush size in image pixels
  stepImages = [], // New prop: array of all images in the step
  onImageIndexChange, // New prop: function to change the current image by its overall index
  onImageSaved,
}, ref) {
  const canvasContainerRef = useRef(null); // The div that holds the transform-wrapper
  const imageRef = useRef(null); // The actual <img> element
  const imageContainerRef = useRef(null); // The div that contains the image and annotations, which will have its own mouse handlers
  const canvasRef = useRef(null); // Adding ref for the inner canvas div
  const colorInputRefs = useRef({}); // Refs for color inputs in the list
  const toolbarRef = useRef(null);

  const [annotations, setAnnotations] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const skipAutosaveRef = useRef(false);

  // New state for view transformations
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan in screen pixels for the image content
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 }); // Size of the canvasContainerRef

  const [showAnnotations, setShowAnnotations] = useState(true);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState([]);
  const [interaction, setInteraction] = useState(null); // {type: 'move'|'resize'|'move-vertex'|'potential-move', handle: string, startX, startY, originalAnnotation}
  const [cursor, setCursor] = useState('crosshair');

  // New state for labeling UI
  const [labelingState, setLabelingState] = useState({
    isVisible: false,
    x: 0,
    y: 0,
    annotationId: null
  });
  
  // New state for middle-mouse panning
  const [isMiddleMousePanning, setIsMiddleMousePanning] = useState(false);
  const [panStart, setPanStart] = useState(null);

  // New: Enhanced annotation management state
  const [classFilters, setClassFilters] = useState(new Set()); // Which classes to show
  const [showLabels, setShowLabels] = useState(true); // Show/hide annotation labels
  const [annotationOpacity, setAnnotationOpacity] = useState(0.7); // Opacity control
  const [groupByClass, setGroupByClass] = useState(true); // Group annotations by class
  const [searchTerm, setSearchTerm] = useState(''); // Search annotations
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(true); // Panel visibility
  const [classColors, setClassColors] = useState({}); // New state for class-specific colors
  const [showGroupNavigation, setShowGroupNavigation] = useState(false); // New state for group navigation dropdown
  const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
  const saveStatusTimeoutRef = useRef(null);
  const saveStatusStartRef = useRef(null);
  const [toolbarSize, setToolbarSize] = useState({ width: 0, height: 0 });
  const [effectiveImageProps, setEffectiveImageProps] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
  });
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const lastSnapshotRef = useRef(null);
  const lastSnapshotKeyRef = useRef("");
  const historyTimerRef = useRef(null);
  const skipHistoryRef = useRef(false);
  const historyActionRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(null);
  const lastSavedSnapshotRef = useRef(new Map());
  const saveWaitersRef = useRef([]);

  const fitZoom = useMemo(() => {
    const { naturalWidth, naturalHeight } = effectiveImageProps;
    const { width: containerWidth, height: containerHeight } = containerSize;
    if (!naturalWidth || !containerWidth) {
      return null;
    }

    const scaleX = containerWidth / naturalWidth;
    const scaleY = containerHeight / naturalHeight;
    return Math.min(scaleX, scaleY) * 0.95;
  }, [containerSize, effectiveImageProps]);

  const zoomLabel = useMemo(() => {
    if (Math.abs(zoom - 1) < 0.005) {
      return "100%";
    }
    if (fitZoom && Math.abs(zoom - fitZoom) < 0.005) {
      return "Fit";
    }
    return `${Math.round(zoom * 100)}%`;
  }, [fitZoom, zoom]);

  // NEW: Memo to calculate annotation stats for the entire step
  const stepWideAnnotationStats = useMemo(() => {
    if (!stepImages || stepImages.length === 0) {
      return {};
    }
    const stats = {};
    stepImages.forEach(image => {
      const imageAnnotations = image.annotations?.annotations || [];
      imageAnnotations.forEach(ann => {
        const className = ann.class || UNLABELED_CLASS_KEY;
        if (!stats[className]) {
          stats[className] = { count: 0 };
        }
        stats[className].count++;
      });
    });
    return stats;
  }, [stepImages]);

  const attemptSave = useCallback(async (payload) => {
    for (let attempt = 0; attempt <= MAX_SAVE_RETRIES; attempt += 1) {
      try {
        await updateStepImage(payload.imageId, payload.updates);
        return true;
      } catch (error) {
        if (attempt === MAX_SAVE_RETRIES) {
          console.error("Failed to save annotations for image:", payload.imageId, {
            message: error?.message,
            details: error?.details,
            hint: error?.hint,
            code: error?.code,
            status: error?.status,
          });
          return false;
        }
        await new Promise((resolve) =>
          setTimeout(resolve, SAVE_RETRY_BASE_MS * (attempt + 1))
        );
      }
    }
    return false;
  }, []);

  const flushPendingSave = useCallback(async () => {
    if (saveInFlightRef.current) {
      return new Promise((resolve) => {
        saveWaitersRef.current.push(resolve);
      });
    }
    saveInFlightRef.current = true;
    const resolveWaiters = () => {
      const waiters = saveWaitersRef.current;
      saveWaitersRef.current = [];
      waiters.forEach((resolve) => resolve());
    };

    while (pendingSaveRef.current) {
      const payload = pendingSaveRef.current;
      pendingSaveRef.current = null;

      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
      }

      saveStatusStartRef.current = Date.now();
      setSaveStatus("saving");
      const ok = await attemptSave(payload);

      if (!ok) {
        pendingSaveRef.current = payload;
        saveInFlightRef.current = false;
        setSaveStatus("error");
        resolveWaiters();
        return;
      }

      if (payload.serialized) {
        lastSavedSnapshotRef.current.set(payload.imageId, payload.serialized);
      }
      onImageSaved?.(payload.imageId, payload.updates);

      if (!pendingSaveRef.current) {
        const startedAt = saveStatusStartRef.current || Date.now();
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(MIN_SAVING_MS - elapsed, 0);
        if (remaining > 0) {
          saveStatusTimeoutRef.current = setTimeout(() => {
            setSaveStatus("saved");
            saveStatusTimeoutRef.current = null;
          }, remaining);
        } else {
          setSaveStatus("saved");
        }
      }
    }

    saveInFlightRef.current = false;
    resolveWaiters();
  }, [attemptSave]);


  const persistAnnotations = useCallback(async () => {
    if (!currentImage || !currentImage.id) {
      return; // Nothing to save if there's no image
    }

    const normalizedPayload = {
      annotations: annotations.map(({ id, stepId, index, ...rest }) => {
        if ((rest.type === 'polygon' || rest.type === 'brush') && rest.points && rest.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          rest.points.forEach(p => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
          rest.x = minX;
          rest.y = minY;
          rest.width = maxX - minX;
          rest.height = maxY - minY;
        }
        delete rest.previewPoint;
        return rest;
      }),
      classColors: classColors,
    };
    const serializedPayload = JSON.stringify(normalizedPayload);
    const lastSavedPayload = lastSavedSnapshotRef.current.get(currentImage.id);
    if (serializedPayload === lastSavedPayload && saveStatus !== "error") {
      return;
    }

    const annotationData = {
      ...normalizedPayload,
      image_natural_size: {
        width: effectiveImageProps.naturalWidth,
        height: effectiveImageProps.naturalHeight
      },
      timestamp: new Date().toISOString()
    };

    pendingSaveRef.current = {
      imageId: currentImage.id,
      updates: { annotations: annotationData, no_annotations_needed: false },
      serialized: serializedPayload,
    };
    return flushPendingSave();
  }, [annotations, classColors, currentImage, effectiveImageProps.naturalHeight, effectiveImageProps.naturalWidth, flushPendingSave, saveStatus]);

  // EXPOSED METHOD VIA REF: To save annotations before navigating away
  useImperativeHandle(ref, () => ({
    saveCurrentAnnotations: persistAnnotations
  }));

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!toolbarRef.current) return;
    const rect = toolbarRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    setToolbarSize(prev => {
      if (prev.width === rect.width && prev.height === rect.height) {
        return prev;
      }
      return { width: rect.width, height: rect.height };
    });
  }, [selectedAnnotationId, currentStep?.status, annotations.length, zoom, containerSize.width, containerSize.height]);

  // Get available image groups for navigation
  const imageGroups = useMemo(() => {
    if (!stepImages || stepImages.length === 0) return {};
    
    const groups = {};
    stepImages.forEach((image, index) => {
      const group = image.image_group || 'Untagged';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push({ image, index });
    });
    return groups;
  }, [stepImages]);

  const currentImageGroup = currentImage?.image_group || 'Untagged';

  // Group navigation functions
  const jumpToGroup = (groupName) => {
    const groupImages = imageGroups[groupName];
    if (groupImages && groupImages.length > 0) {
      onImageIndexChange(groupImages[0].index);
    }
    setShowGroupNavigation(false); // Close dropdown after selection
  };

  const getNextGroupImage = (direction = 1) => {
    const currentGroupImages = imageGroups[currentImageGroup];
    if (!currentGroupImages || currentGroupImages.length === 0) return;
    
    const currentIndexInGroup = currentGroupImages.findIndex(item => item.index === currentImageIndex);
    if (currentIndexInGroup === -1) return; // Current image not found in group

    const nextIndexInGroup = currentIndexInGroup + direction;
    
    if (nextIndexInGroup >= 0 && nextIndexInGroup < currentGroupImages.length) {
      onImageIndexChange(currentGroupImages[nextIndexInGroup].index);
    }
  };

  // Safe calculation for group index and total - moved to top level
  const currentIndexInGroup = useMemo(() => {
    const groupImages = imageGroups[currentImageGroup];
    if (!groupImages) return -1;
    return groupImages.findIndex(item => item.index === currentImageIndex);
  }, [imageGroups, currentImageGroup, currentImageIndex]);

  const totalInGroup = imageGroups[currentImageGroup]?.length || 0;

  // MODIFIED EFFECT: Load annotations FROM currentImage's data
  useEffect(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    skipHistoryRef.current = true;
    historyActionRef.current = false;
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastSnapshotRef.current = null;
    lastSnapshotKeyRef.current = "";

    if (currentImage) {
      const imageData = currentImage.annotations || {}; // Get annotations from currentImage
      const loadedAnnotations = (imageData.annotations || []).map((ann, idx) => ({
        ...ann,
        class: ann.class || null, // Ensure class is null if not present
        id: ann.id || Date.now() + idx,
        index: idx + 1,
        status: ann.status || 'neutral',
        type: ann.type || 'bbox' // Default to bbox if type is missing
      }));
      skipAutosaveRef.current = true;
      setAnnotations(loadedAnnotations);
      setClassColors(imageData.classColors || {}); // Load class colors
      lastSavedSnapshotRef.current.set(
        currentImage.id,
        JSON.stringify({
          annotations: imageData.annotations || [],
          classColors: imageData.classColors || {},
        })
      );
    } else {
      skipAutosaveRef.current = true;
      setAnnotations([]);
      setClassColors({}); // Reset on no image
    }
    setSaveStatus("idle");
    // Also reset selection and other states when image changes
    applySelection([], null);
    setLabelingState({ isVisible: false, x: 0, y: 0, annotationId: null });
  }, [currentImage]);

  useEffect(() => {
    if (!currentImage?.id) return;
    if (isDrawing || labelingState.isVisible) return;
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      persistAnnotations();
    }, 800);

    return () => clearTimeout(timeout);
  }, [annotations, classColors, currentImage, isDrawing, labelingState.isVisible, persistAnnotations]);

  // Set up ResizeObserver to track container size for responsive fitting
  useLayoutEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setContainerSize({ width, height });
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Update image natural dimensions when image source changes
  const handleImageLoad = () => {
    if (imageRef.current) {
      setEffectiveImageProps({
        naturalWidth: imageRef.current.naturalWidth,
        naturalHeight: imageRef.current.naturalHeight,
      });
    }
  };

  // Effect to "fit" the image to the container when it loads or container resizes
  useEffect(() => {
    if (containerSize.width && effectiveImageProps.naturalWidth) {
      fitImageToContainer();
    }
  }, [containerSize, effectiveImageProps.naturalWidth, effectiveImageProps.naturalHeight, currentImage]);

  const fitImageToContainer = () => {
    const { naturalWidth, naturalHeight } = effectiveImageProps;
    const { width: containerWidth, height: containerHeight } = containerSize;

    if (!naturalWidth || !containerWidth) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    const scaleX = containerWidth / naturalWidth;
    const scaleY = containerHeight / naturalHeight;
    const newZoom = Math.min(scaleX, scaleY) * 0.95; // Fit with a little padding (5% less than perfect fit)

    // Calculate pan to center the image
    const scaledImageWidth = naturalWidth * newZoom;
    const scaledImageHeight = naturalHeight * newZoom;
    
    const newPanX = (containerWidth - scaledImageWidth) / 2;
    const newPanY = (containerHeight - scaledImageHeight) / 2;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // This `useEffect` adds a direct, low-level event listener to intercept wheel events.
  // This is the most reliable way to prevent the browser's default page zoom.
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Unconditionally prevent the browser's default action for the wheel event.
      // This stops both scrolling and the browser's own zoom.
      e.preventDefault();
      e.stopPropagation();

      // Priority: Ctrl+Scroll = Zoom, Shift+Scroll = Horizontal Pan, Regular Scroll = Vertical Pan
      if (e.ctrlKey) {
        // Zooming logic - takes priority over all other operations
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Use functional updates to get the latest state values for calculations
        setZoom(prevZoom => {
          // Calculate new zoom first
          const zoomIncrement = 0.015;
          let newZoom = e.deltaY < 0
            ? prevZoom * (1 + zoomIncrement)
            : prevZoom * (1 - zoomIncrement);
          
          // Clamp zoom levels
          if (newZoom < 0.05) newZoom = 0.05;
          if (newZoom > 20) newZoom = 20;

          // Now calculate new pan based on the *latest* prevPan and the *newly calculated* newZoom
          setPan(prevPan => {
            const newPanX = mouseX - (mouseX - prevPan.x) * (newZoom / prevZoom); // Use prevZoom from the parent scope
            const newPanY = mouseY - (mouseY - prevPan.y) * (newZoom / prevZoom);
            return { x: newPanX, y: newPanY };
          });

          return newZoom; // Return the new zoom value to update the zoom state
        });
      } else if (e.shiftKey) {
        // Horizontal Panning
        const scrollAmount = e.deltaX !== 0 ? e.deltaX : e.deltaY; // Some mice report horizontal on deltaY
        setPan(prevPan => ({ ...prevPan, x: prevPan.x - scrollAmount }));
      } else {
        // Vertical Panning
        setPan(prevPan => ({ ...prevPan, y: prevPan.y - e.deltaY }));
      }
    };

    // Add the listener with `passive: false` to signal that we intend to call `preventDefault`.
    // This is crucial for overriding the default browser behavior.
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Cleanup: Remove the listener when the component unmounts.
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty dependency array ensures this runs only once.

  const isAnnotationSelected = useCallback(
    (id) => selectedAnnotationIds.includes(id),
    [selectedAnnotationIds]
  );

  const applySelection = useCallback((nextIds, primaryId) => {
    setSelectedAnnotationIds(nextIds);
    setSelectedAnnotationId(primaryId ?? nextIds[nextIds.length - 1] ?? null);
  }, []);

  const selectSingleAnnotation = useCallback(
    (annotationId) => {
      if (!annotationId) {
        applySelection([], null);
        return;
      }
      applySelection([annotationId], annotationId);
    },
    [applySelection]
  );

  const toggleAnnotationSelection = useCallback(
    (annotationId) => {
      if (!annotationId) return;
      const exists = selectedAnnotationIds.includes(annotationId);
      const nextIds = exists
        ? selectedAnnotationIds.filter((id) => id !== annotationId)
        : [...selectedAnnotationIds, annotationId];
      const nextPrimary = exists
        ? (annotationId === selectedAnnotationId ? nextIds[nextIds.length - 1] || null : selectedAnnotationId)
        : annotationId;
      applySelection(nextIds, nextPrimary);
    },
    [applySelection, selectedAnnotationIds, selectedAnnotationId]
  );

  const cloneSnapshot = useCallback((snapshot) => {
    if (typeof structuredClone === "function") {
      return structuredClone(snapshot);
    }
    return JSON.parse(JSON.stringify(snapshot));
  }, []);

  const recordHistorySnapshot = useCallback(
    (snapshot, snapshotKey) => {
      if (!lastSnapshotRef.current) {
        lastSnapshotRef.current = cloneSnapshot(snapshot);
        lastSnapshotKeyRef.current = snapshotKey;
        return;
      }
      undoStackRef.current.push(cloneSnapshot(lastSnapshotRef.current));
      if (undoStackRef.current.length > HISTORY_LIMIT) {
        undoStackRef.current.shift();
      }
      redoStackRef.current = [];
      lastSnapshotRef.current = cloneSnapshot(snapshot);
      lastSnapshotKeyRef.current = snapshotKey;
    },
    [cloneSnapshot]
  );

  const scheduleHistoryCommit = useCallback(
    (snapshot, snapshotKey) => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
      }
      historyTimerRef.current = setTimeout(() => {
        recordHistorySnapshot(snapshot, snapshotKey);
        historyTimerRef.current = null;
      }, 250);
    },
    [recordHistorySnapshot]
  );

  const undoAnnotations = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const previousSnapshot = undoStackRef.current.pop();
    if (!previousSnapshot) return false;
    redoStackRef.current.push(
      cloneSnapshot({ annotations, classColors })
    );
    historyActionRef.current = true;
    setAnnotations(previousSnapshot.annotations || []);
    setClassColors(previousSnapshot.classColors || {});
    applySelection([], null);
    return true;
  }, [annotations, classColors, applySelection, cloneSnapshot]);

  const redoAnnotations = useCallback(() => {
    if (historyTimerRef.current) {
      clearTimeout(historyTimerRef.current);
      historyTimerRef.current = null;
    }
    const nextSnapshot = redoStackRef.current.pop();
    if (!nextSnapshot) return false;
    undoStackRef.current.push(
      cloneSnapshot({ annotations, classColors })
    );
    if (undoStackRef.current.length > HISTORY_LIMIT) {
      undoStackRef.current.shift();
    }
    historyActionRef.current = true;
    setAnnotations(nextSnapshot.annotations || []);
    setClassColors(nextSnapshot.classColors || {});
    applySelection([], null);
    return true;
  }, [annotations, classColors, applySelection, cloneSnapshot]);

  useEffect(() => {
    const snapshot = { annotations, classColors };
    const snapshotKey = JSON.stringify(snapshot);

    if (skipHistoryRef.current) {
      skipHistoryRef.current = false;
      lastSnapshotRef.current = cloneSnapshot(snapshot);
      lastSnapshotKeyRef.current = snapshotKey;
      return;
    }
    if (historyActionRef.current) {
      historyActionRef.current = false;
      lastSnapshotRef.current = cloneSnapshot(snapshot);
      lastSnapshotKeyRef.current = snapshotKey;
      return;
    }
    if (snapshotKey === lastSnapshotKeyRef.current) {
      return;
    }

    scheduleHistoryCommit(snapshot, snapshotKey);
  }, [annotations, classColors, cloneSnapshot, scheduleHistoryCommit]);

  useEffect(() => {
    return () => {
      if (historyTimerRef.current) {
        clearTimeout(historyTimerRef.current);
      }
    };
  }, []);

  const deleteSelectedAnnotations = useCallback(() => {
    const idsToDelete = selectedAnnotationIds.length
      ? selectedAnnotationIds
      : selectedAnnotationId
        ? [selectedAnnotationId]
        : [];

    if (idsToDelete.length === 0) {
      return false;
    }

    setAnnotations(prev => {
      const remaining = prev.filter(ann => !idsToDelete.includes(ann.id));
      return remaining.map((ann, index) => ({ ...ann, index: index + 1 }));
    });
    applySelection([], null);
    return true;
  }, [applySelection, selectedAnnotationIds, selectedAnnotationId]);

  // Add keyboard event listener for ESC key deselection and Ctrl key state
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      const tagName = target?.tagName;
      const isEditable =
        target?.isContentEditable ||
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        tagName === 'SELECT';

      if (!isEditable && (e.ctrlKey || e.metaKey)) {
        const key = e.key.toLowerCase();
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redoAnnotations();
          } else {
            undoAnnotations();
          }
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          redoAnnotations();
          return;
        }
      }

      if (e.key === 'Delete') {
        if (!isEditable && deleteSelectedAnnotations()) {
          e.preventDefault();
        }
      }

      // ESC key deselects everything
      if (e.key === 'Escape') {
        e.preventDefault();
        applySelection([], null);
        
        // Also cancel any ongoing drawing operations
        if (isDrawing) {
          setIsDrawing(false);
          setCurrentAnnotation(null);
        }
        
        // Cancel labeling state if open
        if (labelingState.isVisible) {
          handleLabelCancel(labelingState.annotationId);
        }

        // Close group navigation dropdown
        setShowGroupNavigation(false);
      }
      
      // When Ctrl is pressed, disable middle-mouse panning to avoid conflicts
      if (e.key === 'Control' && isMiddleMousePanning) {
        setIsMiddleMousePanning(false);
        setPanStart(null);
        setCursor('default');
      }
    };

    const handleKeyUp = (e) => {
      // No specific action needed on key up for now
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    applySelection,
    deleteSelectedAnnotations,
    redoAnnotations,
    undoAnnotations,
    isDrawing,
    labelingState.isVisible,
    isMiddleMousePanning,
    labelingState.annotationId,
  ]); // Dependencies ensure current state is captured

  const getPointInImageSpace = (e) => {
    const container = canvasContainerRef.current; // The outer container that is NOT transformed
    if (!container) return { x: 0, y: 0 };

    // Mouse coordinates relative to the canvasContainerRef
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Inverse transform the mouse coordinates to find where they are on the natural image
    // mouseX = pan.x + imageX * zoom
    // imageX = (mouseX - pan.x) / zoom
    const imageX = (mouseX - pan.x) / zoom;
    const imageY = (mouseY - pan.y) / zoom;

    return { x: imageX, y: imageY };
  };

  const getAnnotationAtPoint = useCallback((point) => {
    // Iterate backwards so we hit the top-most annotation first
    const visibleAnnotations = annotations.filter(ann => shouldShowAnnotation(ann));
    for (let i = visibleAnnotations.length - 1; i >= 0; i--) {
      const ann = visibleAnnotations[i];
      if (ann.type === 'bbox') {
        if (
          point.x >= ann.x &&
          point.x <= ann.x + ann.width &&
          point.y >= ann.y &&
          point.y <= ann.y + ann.height
        ) {
          return ann;
        }
      } else if ((ann.type === 'polygon' || ann.type === 'brush') && ann.points && ann.points.length > 2) {
        // Point-in-polygon check (ray casting algorithm)
        // Adapted from: https://stackoverflow.com/questions/217578/how-can-i-determine-if-a-point-is-inside-a-polygon-in-javascript
        let isInside = false;
        for (let j = 0, k = ann.points.length - 1; j < ann.points.length; k = j++) {
          const xi = ann.points[j].x, yi = ann.points[j].y;
          const xj = ann.points[k].x, yj = ann.points[k].y;

          const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
          if (intersect) isInside = !isInside;
        }
        if (isInside) {
          return ann;
        }
      }
    }
    return null;
  }, [annotations, classFilters, searchTerm, showAnnotations]);

  const getHandleAtPoint = useCallback((point) => {
    // Check only the selected annotation for handles
    const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
    if (!selectedAnn || selectedAnn.type !== 'bbox') return null; // Only show resize handles for bboxes

    const handles = getResizeHandles(selectedAnn); // These handles are relative to the bbox top-left
    const handleSize = HANDLE_SIZE / zoom; // Use a similar screen-space size for hit detection

    // Translate handle coordinates to image space absolute coordinates
    for (const handle of handles) {
      const absoluteHandleX = selectedAnn.x + handle.x;
      const absoluteHandleY = selectedAnn.y + handle.y;
      
      if (
        point.x >= absoluteHandleX &&
        point.x <= absoluteHandleX + handleSize &&
        point.y >= absoluteHandleY &&
        point.y <= absoluteHandleY + handleSize
      ) {
        return handle.position;
      }
    }
    return null;
  }, [annotations, selectedAnnotationId, zoom]);

  const getPolygonVertexAtPoint = useCallback((point, annotation) => {
    if (!annotation || annotation.type !== 'polygon') return null;
    const handleSize = HANDLE_SIZE / zoom; // Use a similar screen-space size for hit detection
    if (!annotation.points) return null;
    for (let i = 0; i < annotation.points.length; i++) {
      const vertex = annotation.points[i];
      const distance = Math.sqrt(Math.pow(point.x - vertex.x, 2) + Math.pow(point.y - vertex.y, 2));
      if (distance < handleSize / 2) {
        return i; // Return the index of the vertex
      }
    }
    return null;
  }, [zoom]);

  const handleMouseDown = (e) => {
    // Don't allow middle-mouse panning if Ctrl is held (prioritize zoom preparation from wheel event)
    if (e.button === 1 && !e.ctrlKey) { 
      e.preventDefault();
      e.stopPropagation();
      setIsMiddleMousePanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, initialPan: { ...pan } });
      setCursor('grabbing');
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();

    // If labeling UI is visible, a click outside cancels it
    if (labelingState.isVisible) {
      handleLabelCancel(labelingState.annotationId);
      return;
    }

    // If group navigation dropdown is visible, a click outside closes it
    if (showGroupNavigation) {
      setShowGroupNavigation(false);
    }

    if (!imageRef.current) return;
    if (!effectiveImageProps.naturalWidth) return;

    const point = getPointInImageSpace(e);

    switch (annotationMode) {
      case 'draw': // Bounding box drawing
        setIsDrawing(true);
        setCurrentAnnotation({
          type: 'bbox',
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          class: null, // Start with no class, will be labeled later
          status: 'neutral',
        });
        applySelection([], null); // Deselect any existing annotation when starting to draw
        break;
      
      case 'polygon': // Polygon drawing
        if (!isDrawing) { // Start new polygon
          setIsDrawing(true);
          setCurrentAnnotation({
            type: 'polygon',
            points: [point],
            class: null,
            status: 'neutral',
          });
          applySelection([], null);
        } else { // Continue drawing polygon
          const firstPoint = currentAnnotation.points[0];
          // Check if close to starting point to close the polygon
          const distToStart = Math.sqrt(Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.y - firstPoint.y, 2));

          if (currentAnnotation.points.length > 2 && distToStart < POLYGON_CLOSE_THRESHOLD / zoom) { // Adjust threshold for zoom
            // Finish polygon
            const newAnnotation = {
              ...currentAnnotation,
              points: [...currentAnnotation.points], // Do not add the closing point, it will be closed by renderer
              id: Date.now(),
              index: annotations.length + 1,
            };
            setAnnotations(prev => [...prev, newAnnotation]);
            setIsDrawing(false);
            setCurrentAnnotation(null);
            selectSingleAnnotation(newAnnotation.id);
            // Trigger labeling UI
            const lablerX = point.x * zoom + pan.x;
            const lablerY = point.y * zoom + pan.y;
            setLabelingState({ isVisible: true, x: lablerX + 5, y: lablerY, annotationId: newAnnotation.id });
          } else {
            // Add point to current polygon
            setCurrentAnnotation(prev => ({
              ...prev,
              points: [...prev.points, point],
              previewPoint: point, // Update preview point for rubber-banding line
            }));
          }
        }
        break;

      case 'brush': // Brush drawing
        setIsDrawing(true);
        setCurrentAnnotation({
          type: 'brush',
          points: [point],
          brushSize: brushSize,
          class: null,
          status: 'neutral',
        });
        applySelection([], null);
        break;

      case 'select': {
        // Select mode: just select/deselect annotations
        const clickedAnnotation = getAnnotationAtPoint(point);
        if (clickedAnnotation) {
          if (e.shiftKey) {
            toggleAnnotationSelection(clickedAnnotation.id);
          } else {
            selectSingleAnnotation(clickedAnnotation.id);
          }
        } else if (!e.shiftKey) {
          applySelection([], null);
        }
        return;
      }

      case 'move': {
        // In move mode, a mousedown could be the start of many things.
        // Let's determine what was clicked.
        if (e.shiftKey) {
          const clickedAnnotation = getAnnotationAtPoint(point);
          if (clickedAnnotation) {
            toggleAnnotationSelection(clickedAnnotation.id);
          }
          return;
        }
        const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);

        // Priority 1: Check for handle interaction on an already selected annotation.
        if (selectedAnn) {
          if (selectedAnn.type === 'bbox') {
            const handle = getHandleAtPoint(point);
            if (handle) {
              setInteraction({ type: 'resize', handle, startX: point.x, startY: point.y, originalAnnotation: { ...selectedAnn } });
              return; // Interaction started, exit.
            }
          }
          if (selectedAnn.type === 'polygon') {
            const vertexIndex = getPolygonVertexAtPoint(point, selectedAnn);
            if (vertexIndex !== null) {
              setInteraction({ type: 'move-vertex', vertexIndex, startX: point.x, startY: point.y, originalAnnotation: { ...selectedAnn } });
              return; // Interaction started, exit.
            }
          }
        }
        
        // Priority 2: Check for a click on any annotation body or empty space.
        const clickedAnnotation = getAnnotationAtPoint(point);
        if (clickedAnnotation) {
          // Click was on a shape.
          // Select it.
          selectSingleAnnotation(clickedAnnotation.id);
          // Set up a "potential" interaction. We'll upgrade it to a real 'move' in handleMouseMove if the user actually drags.
          setInteraction({
            type: 'potential-move',
            startX: point.x,
            startY: point.y,
            originalAnnotation: { ...clickedAnnotation },
          });
        } else {
          // Click was on empty space. Deselect everything.
          applySelection([], null);
        }
        break;
      }
      default:
        break;
    }
  };

  const handleMouseMove = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // If Ctrl is held down while middle-mouse panning is active, stop panning
    if (isMiddleMousePanning && e.ctrlKey) {
      setIsMiddleMousePanning(false);
      setPanStart(null);
      setCursor('default'); // Reset cursor immediately
      return; // Do not proceed with panning
    }

    // Handle middle-mouse panning
    if (isMiddleMousePanning) {
      if (!panStart) return;
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({
        x: panStart.initialPan.x + dx,
        y: panStart.initialPan.y + dy,
      });
      return;
    }
    
    if (!imageRef.current) return;

    const point = getPointInImageSpace(e);

    // Update cursor style based on hover when no interaction is active
    if (!interaction && !isDrawing) { // Added !isDrawing to prevent cursor change while actively drawing
      updateCursor(point);
    }

    // NEW: Upgrade a "potential-move" to a real "move" if drag threshold is met.
    if (interaction && interaction.type === 'potential-move') {
      const dx = Math.abs(point.x - interaction.startX);
      const dy = Math.abs(point.y - interaction.startY);
      if (Math.sqrt(dx*dx + dy*dy) > DRAG_THRESHOLD / zoom) {
        setInteraction(prev => ({ ...prev, type: 'move' }));
      }
    }

    if (isDrawing) {
      if (!currentAnnotation) return;
      
      switch(annotationMode) {
        case 'draw': // Bbox drawing: update width/height
          setCurrentAnnotation(prev => ({
            ...prev,
            width: point.x - prev.x,
            height: point.y - prev.y,
          }));
          break;
        case 'polygon': // Polygon drawing: update preview line
          setCurrentAnnotation(prev => ({ ...prev, previewPoint: point }));
          break;
        case 'brush': // Brush drawing: add points to the path
          setCurrentAnnotation(prev => ({
            ...prev,
            points: [...prev.points, point],
          }));
          break;
      }
      return;
    }

    if (!interaction) return;

    // IMPORTANT: Only apply annotation changes for active interactions (move, resize, move-vertex)
    if (interaction.type === 'move') {
      const dx = point.x - interaction.startX;
      const dy = point.y - interaction.startY;
      setAnnotations(prevAnns => prevAnns.map(ann => {
        if (ann.id !== interaction.originalAnnotation.id) return ann;
        const original = interaction.originalAnnotation;
        let newAnn = { ...ann };
        if (newAnn.type === 'bbox') {
          newAnn.x = original.x + dx;
          newAnn.y = original.y + dy;
        } else if (newAnn.type === 'polygon' || newAnn.type === 'brush') {
          // Move all points by the delta
          newAnn.points = original.points.map(p => ({ x: p.x + dx, y: p.y + dy }));
        }
        return newAnn;
      }));
    } else if (interaction.type === 'resize' && interaction.originalAnnotation.type === 'bbox') { // Only resize for bbox
      const dx = point.x - interaction.startX;
      const dy = point.y - interaction.startY;
      setAnnotations(prevAnns => prevAnns.map(ann => {
        if (ann.id !== interaction.originalAnnotation.id) return ann;
        const original = interaction.originalAnnotation;
        let newAnn = { ...ann };
        // Handle resizing logic for bbox
        switch (interaction.handle) {
          case 'top-left':
            newAnn.x = original.x + dx;
            newAnn.y = original.y + dy;
            newAnn.width = original.width - dx;
            newAnn.height = original.height - dy;
            break;
          case 'top-right':
            newAnn.y = original.y + dy;
            newAnn.width = original.width + dx;
            newAnn.height = original.height - dy;
            break;
          case 'bottom-left':
            newAnn.x = original.x + dx;
            newAnn.width = original.width - dx;
            newAnn.height = original.height + dy;
            break;
          case 'bottom-right':
            newAnn.width = original.width + dx;
            newAnn.height = original.height + dy;
            break;
          default:
            console.warn("Unknown resize handle:", interaction.handle);
        }
        return newAnn;
      }));
    } else if (interaction.type === 'move-vertex' && interaction.originalAnnotation.type === 'polygon') {
      setAnnotations(prevAnns => prevAnns.map(ann => {
        if (ann.id !== interaction.originalAnnotation.id) return ann;
        let newAnn = { ...ann };
        const updatedPoints = [...newAnn.points]; // a copy of the current points
        // Simplified logic: directly update the vertex to the new mouse position
        updatedPoints[interaction.vertexIndex] = {
            x: point.x,
            y: point.y,
        };
        newAnn.points = updatedPoints;
        return newAnn;
      }));
    }
  };

  const handleMouseUp = (e) => {
    // Stop middle-mouse panning on mouse up
    if (isMiddleMousePanning) {
      e.preventDefault();
      e.stopPropagation();
      setIsMiddleMousePanning(false);
      setPanStart(null);
    }
    
    e.preventDefault();
    e.stopPropagation();

    if (isDrawing) {
      if (annotationMode === 'draw') {
        let finalX = currentAnnotation.x;
        let finalY = currentAnnotation.y;
        let finalWidth = currentAnnotation.width;
        let finalHeight = currentAnnotation.height;

        // Normalize rectangle coordinates (x, y should be top-left, width/height positive)
        if (finalWidth < 0) {
          finalX += finalWidth;
          finalWidth = Math.abs(finalWidth);
        }
        if (finalHeight < 0) {
          finalY += finalHeight;
          finalHeight = Math.abs(finalHeight);
        }

        // Only save if bounding box has a reasonable size (at least 10x10 pixels in natural image space)
        if (finalWidth > 10 && finalHeight > 10) {
          const newAnnotation = {
            ...currentAnnotation,
            type: 'bbox', // Ensure type is bbox
            x: finalX,
            y: finalY,
            width: finalWidth,
            height: finalHeight,
            id: Date.now(), // Unique ID for each annotation
            index: annotations.length + 1, // Add index for display
            status: 'neutral', // Default status for new annotations
            class: null // Class will be set via the labler
          };
          setAnnotations(prev => [...prev, newAnnotation]);
          selectSingleAnnotation(newAnnotation.id); // Select the new annotation immediately

          // Show the labeling UI
          // Convert image space coordinates to screen space for positioning the labler
          const lablerX = (newAnnotation.x + newAnnotation.width) * zoom + pan.x;
          const lablerY = (newAnnotation.y + newAnnotation.height) * zoom + pan.y;

          setLabelingState({
            isVisible: true,
            x: lablerX + 5, // Position slightly offset from box corner
            y: lablerY,
            annotationId: newAnnotation.id
          });
        }
        setIsDrawing(false);
        setCurrentAnnotation(null);
      } else if (annotationMode === 'brush') {
        setIsDrawing(false);
        // Only save if it's a meaningful stroke
        if (currentAnnotation.points.length > 5) {
          const newAnnotation = {
            ...currentAnnotation,
            type: 'brush', // Ensure type is brush
            id: Date.now(),
            index: annotations.length + 1,
          };
          setAnnotations(prev => [...prev, newAnnotation]);
          selectSingleAnnotation(newAnnotation.id);
          // Trigger labeling UI
          const lastPoint = currentAnnotation.points[currentAnnotation.points.length - 1];
          const lablerX = lastPoint.x * zoom + pan.x;
          const lablerY = lastPoint.y * zoom + pan.y;
          setLabelingState({ isVisible: true, x: lablerX + 5, y: lablerY, annotationId: newAnnotation.id });
        }
        // If the stroke is too short, it's discarded.
        setCurrentAnnotation(null);
      }
      // For polygon, mouse up does not finish drawing, only mouse down (click) or right-click does
    }

    // Finalize annotation state after a move/resize/vertex-move interaction
    if (interaction && (interaction.type === 'move' || interaction.type === 'resize' || interaction.type === 'move-vertex')) {
        setAnnotations(prevAnns => prevAnns.map(ann => {
            if (ann.id !== interaction.originalAnnotation.id) return ann;
            // Ensure width/height are not negative after resize for bbox
            let finalAnn = {...ann};
            if (finalAnn.type === 'bbox') {
              if (finalAnn.width < 0) {
                  finalAnn.x = finalAnn.x + finalAnn.width;
                  finalAnn.width = Math.abs(finalAnn.width);
              }
              if (finalAnn.height < 0) {
                  finalAnn.y = finalAnn.y + finalAnn.height;
                  finalAnn.height = Math.abs(finalAnn.height);
              }
              // Ensure annotations don't go outside image bounds
              finalAnn.x = Math.max(0, finalAnn.x);
              finalAnn.y = Math.max(0, finalAnn.y);
              finalAnn.width = Math.min(effectiveImageProps.naturalWidth - finalAnn.x, finalAnn.width);
              finalAnn.height = Math.min(effectiveImageProps.naturalHeight - finalAnn.y, finalAnn.height);


              // Minimum size check after normalization
              if (finalAnn.width < 10 || finalAnn.height < 10) {
                return null; // Mark for deletion if too small after resize
              }
            } else if (finalAnn.type === 'polygon' || finalAnn.type === 'brush') {
                // For polygon/brush, ensure points are within bounds.
                finalAnn.points = finalAnn.points.map(p => ({
                    x: Math.max(0, Math.min(effectiveImageProps.naturalWidth, p.x)),
                    y: Math.max(0, Math.min(effectiveImageProps.naturalHeight, p.y)),
                }));
            }

            return finalAnn;
        }).filter(Boolean)); // Remove nulls (deleted annotations)
    }

    // Always clear the interaction on mouse up. A "potential-move" that wasn't upgraded is just a click, so we clear it.
    setInteraction(null);
  };
  
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDrawing && currentAnnotation) {
      // Finish Polygon with Right-Click
      if (currentAnnotation.type === 'polygon' && currentAnnotation.points.length > 2) {
        const newAnnotation = {
          ...currentAnnotation,
          id: Date.now(),
          index: annotations.length + 1,
        };
        setAnnotations(prev => [...prev, newAnnotation]);
        setIsDrawing(false);
        setCurrentAnnotation(null);
        selectSingleAnnotation(newAnnotation.id);

        const lastPoint = currentAnnotation.points[currentAnnotation.points.length - 1];
        const lablerX = lastPoint.x * zoom + pan.x;
        const lablerY = lastPoint.y * zoom + pan.y;
        setLabelingState({ isVisible: true, x: lablerX + 5, y: lablerY, annotationId: newAnnotation.id });
      }
      // Finish Brush with Right-Click
      else if (currentAnnotation.type === 'brush' && currentAnnotation.points.length > 5) {
        setIsDrawing(false);
        const newAnnotation = { ...currentAnnotation, id: Date.now(), index: annotations.length + 1 };
        setAnnotations(prev => [...prev, newAnnotation]);
        selectSingleAnnotation(newAnnotation.id);
        
        const lastPoint = currentAnnotation.points[currentAnnotation.points.length - 1];
        const lablerX = lastPoint.x * zoom + pan.x;
        const lablerY = lastPoint.y * zoom + pan.y;
        setLabelingState({ isVisible: true, x: lablerX + 5, y: lablerY, annotationId: newAnnotation.id });
        setCurrentAnnotation(null);
      }
    }
  };

  const handleLabelSelect = (annotationId, className) => {
    setAnnotations(prevAnns => prevAnns.map(ann =>
      ann.id === annotationId ? { ...ann, class: className } : ann
    ));
    setLabelingState({ isVisible: false, x: 0, y: 0, annotationId: null });
    selectSingleAnnotation(annotationId); // Keep it selected after labeling
  };

  const handleLabelCancel = (annotationId) => {
    // If the annotation was a polygon or brush, and we cancel labeling, we should reset isDrawing.
    const canceledAnnotation = annotations.find(ann => ann.id === annotationId);
    if (canceledAnnotation && (canceledAnnotation.type === 'polygon' || canceledAnnotation.type === 'brush')) {
      setIsDrawing(false);
      setCurrentAnnotation(null);
    }
    // Remove the annotation that was just drawn and was awaiting a label
    setAnnotations(prevAnns => prevAnns.filter(ann => ann.id !== annotationId));
    setLabelingState({ isVisible: false, x: 0, y: 0, annotationId: null });
    applySelection([], null); // Deselect if the canceled annotation was selected
  };

  const updateCursor = useCallback((point) => {
    if (!imageContainerRef.current) {
        setCursor('default');
        return;
    }

    if (annotationMode === 'draw' || annotationMode === 'polygon' || annotationMode === 'brush') {
        setCursor('crosshair'); // Always crosshair for drawing mode, class selected later
        return;
    }

    if (annotationMode === 'move') {
        if (selectedAnnotationId) {
            const selectedAnn = annotations.find(ann => ann.id === selectedAnnotationId);
            if (selectedAnn && selectedAnn.type === 'bbox') { // Only show resize handles for bboxes
                const handle = getHandleAtPoint(point); // Pass point only
                if (handle) {
                    if (handle.includes('left') && handle.includes('top') || handle.includes('right') && handle.includes('bottom')) setCursor('nwse-resize');
                    else if (handle.includes('right') && handle.includes('top') || handle.includes('left') && handle.includes('bottom')) setCursor('nesw-resize');
                    else setCursor('pointer'); // Should not happen for handles, but fallback
                    return;
                }
            }
            if (selectedAnn && selectedAnn.type === 'polygon') {
                const vertexIndex = getPolygonVertexAtPoint(point, selectedAnn);
                if (vertexIndex !== null) {
                    setCursor('grab');
                    return;
                }
            }
        }
        // If no handle or no selected annotation, check if hovering over an annotation
        const annotationUnderMouse = getAnnotationAtPoint(point);
        if (annotationUnderMouse) {
            setCursor('move');
            return;
        }
    }

    if (annotationMode === 'select') {
        const annotationUnderMouse = getAnnotationAtPoint(point);
        if (annotationUnderMouse) {
            setCursor('pointer');
            return;
        }
    }

    setCursor('default'); // Default cursor for the canvas area
  }, [annotations, selectedAnnotationId, annotationMode, getAnnotationAtPoint, getHandleAtPoint, getPolygonVertexAtPoint, zoom]);

  const handleGlobalMouseMove = useCallback((e) => {
    // Only update cursor globally if no interaction is active (drawing, moving, resizing, panning)
    if (!isDrawing && !interaction && !isMiddleMousePanning) {
      if (canvasContainerRef.current && canvasContainerRef.current.contains(e.target)) {
        const point = getPointInImageSpace(e);
        updateCursor(point);
      } else {
        // If mouse leaves the canvas area, reset cursor to default
        setCursor('default');
      }
    }
  }, [isDrawing, interaction, updateCursor, isMiddleMousePanning]);

  const handleZoomAction = (factor) => {
    const container = canvasContainerRef.current;
    if (!container) return;

    // Center of the visible container viewport
    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;

    const prevZoom = zoom;
    const newZoom = prevZoom * factor; // Apply factor (e.g., 1.2 for zoom in, 0.8 for zoom out)

    // Clamp zoom levels
    if (newZoom < 0.05 || newZoom > 20) return;

    // Adjust pan to keep the center of the viewport stationary relative to content
    const newPanX = centerX - (centerX - pan.x) * (newZoom / prevZoom);
    const newPanY = centerY - (centerY - pan.y) * (newZoom / prevZoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleZoomIn = () => handleZoomAction(1.2); // Zoom in by 20%
  const handleZoomOut = () => handleZoomAction(0.8); // Zoom out by 20%

  const handleResetZoom = () => {
    fitImageToContainer();
  };

  const handleAnnotationStatusChange = (annotationId, newStatus) => {
    setAnnotations(prevAnns => prevAnns.map(ann =>
      ann.id === annotationId ? { ...ann, status: ann.status === newStatus ? 'neutral' : newStatus } : ann
    ));
  };

  const handleClassColorChange = (className, color) => {
    setClassColors(prev => ({ ...prev, [className]: color }));
  };

  const deleteAnnotation = (annotationId) => {
    setAnnotations(prev => {
      const filtered = prev.filter(ann => ann.id !== annotationId);
      // Re-index remaining annotations for display purposes
      return filtered.map((ann, index) => ({ ...ann, index: index + 1 }));
    });
    if (selectedAnnotationIds.includes(annotationId)) {
      const nextIds = selectedAnnotationIds.filter(id => id !== annotationId);
      const nextPrimary =
        selectedAnnotationId === annotationId
          ? nextIds[nextIds.length - 1] || null
          : selectedAnnotationId;
      applySelection(nextIds, nextPrimary);
    }
  };

  const highlightAnnotation = (annotationId, event) => {
    if (!annotationId) return;
    if (event?.shiftKey) {
      toggleAnnotationSelection(annotationId);
      return;
    }
    selectSingleAnnotation(annotationId);
  };

  // Get annotation statistics by class for the CURRENT image
  const getAnnotationStats = () => {
    const stats = {};
    annotations.forEach(ann => {
      const className = ann.class || UNLABELED_CLASS_KEY;
      if (!stats[className]) {
        stats[className] = { count: 0, visible: 0 };
      }
      stats[className].count++;
      if (shouldShowAnnotation(ann, { ignoreShowAnnotations: true })) { // Check visibility excluding global showAnnotations toggle
        stats[className].visible++;
      }
    });
    return stats;
  };

  // Check if annotation should be shown based on filters
  const shouldShowAnnotation = (annotation, options = {}) => {
    const { ignoreShowAnnotations = false } = options;

    if (!ignoreShowAnnotations && !showAnnotations) return false;

    const actualClass = annotation.class || UNLABELED_CLASS_KEY;

    if (classFilters.size > 0 && !classFilters.has(actualClass)) return false;
    
    if (searchTerm) {
      if (!annotation.class && UNLABELED_CLASS_KEY.toLowerCase().includes(searchTerm.toLowerCase())) return true; // Match unlabeled if search term matches UNLABELED_CLASS_KEY
      if (annotation.class && !annotation.class.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    }
    
    return true;
  };

  // Toggle class filter
  const toggleClassFilter = (className) => {
    setClassFilters(prev => {
      const newFilters = new Set(prev);
      if (newFilters.has(className)) {
        newFilters.delete(className);
      } else {
        newFilters.add(className);
      }
      return newFilters;
    });
  };

  // Clear all filters
  const clearAllFilters = () => {
    setClassFilters(new Set());
    setSearchTerm('');
    applySelection([], null); // Clear selection when clearing filters
  };

  // Get class colors for consistent styling
  const getClassColor = (className, index) => {
    // A palette with blue as the primary accent, followed by other distinct colors
    const colors = [
      '#1d4ed8', // blue-700, new primary
      '#3b82f6', // blue-500
      '#8b5cf6', // violet-500
      '#ef4444', // red-500
      '#f59e0b', // amber-500
      '#10b981', // emerald-500
      '#f97316', // orange-500
      '#06b6d4', // cyan-500
      '#84cc16', // lime-500
      '#ec4899', // pink-500
      '#a855f7', // purple-500
      '#6b7280', // gray-500
      '#60a5fa', // blue-400, replacement for teal-500
      '#f43f5e', // rose-500
      '#a3e635'  // lime-300
    ];

    if (className === UNLABELED_CLASS_KEY) {
      return '#9ca3af'; // Gray for unlabeled
    }
    const classIdx = currentStep?.classes?.indexOf(className);
    if (Number.isInteger(classIdx) && classIdx >= 0) {
      return colors[classIdx % colors.length];
    }
    if (Number.isInteger(index) && index >= 0) {
      return colors[index % colors.length];
    }
    const seed = String(className || '').split('').reduce((acc, char) => {
      return (acc * 31 + char.charCodeAt(0)) >>> 0;
    }, 7);
    return colors[seed % colors.length];
  };

  // Update getStatusColor function to handle dynamic status values
  const getStatusColor = (status) => {
    if (!status || status === 'neutral') return '#6b7280'; // gray-500
    
    const statusLower = status.toLowerCase();
    if (statusLower.includes('pass') || statusLower.includes('good') || statusLower.includes('ok')) {
      return '#10b981'; // green-500
    } else if (statusLower.includes('fail') || statusLower.includes('bad') || statusLower.includes('error') || statusLower.includes('defective')) {
      return '#ef4444'; // red-500
    } else {
      return '#3b82f6'; // blue-500 for other custom statuses
    }
  };

  const getResolvedClassColor = (className) => {
    const stepIndex = currentStep?.classes?.indexOf(className);
    return classColors[className] || getClassColor(className, stepIndex);
  };

  const hexToRgba = (hexColor, alpha) => {
    if (!hexColor) return `rgba(0, 0, 0, ${alpha})`;
    const normalized = hexColor.replace('#', '');
    if (normalized.length === 3) {
      const r = parseInt(normalized[0] + normalized[0], 16);
      const g = parseInt(normalized[1] + normalized[1], 16);
      const b = parseInt(normalized[2] + normalized[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    const value = normalized.slice(0, 6);
    const r = parseInt(value.slice(0, 2), 16);
    const g = parseInt(value.slice(2, 4), 16);
    const b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const getResizeHandles = (annotation) => {
    // Only return handles for bounding boxes
    if (annotation.type !== 'bbox') return [];
    
    // Handle size should be constant in screen pixels, so scale by inverse of zoom for logical size
    const handleSize = HANDLE_SIZE / zoom;
    const halfHandleSize = handleSize / 2;

    // Return coordinates relative to the annotation box itself
    return [
        { position: 'top-left', x: -halfHandleSize, y: -halfHandleSize, size: handleSize },
        { position: 'top-right', x: annotation.width - halfHandleSize, y: -halfHandleSize, size: handleSize },
        { position: 'bottom-left', x: -halfHandleSize, y: annotation.height - halfHandleSize, size: handleSize },
        { position: 'bottom-right', x: annotation.width - halfHandleSize, y: annotation.height - halfHandleSize, size: handleSize },
    ];
  };

  const renderAnnotation = (annotation, key) => { // key is annotation.id or -1 for currentAnnotation
    const isPrimarySelected = selectedAnnotationId === annotation.id;
    const isSelected = isAnnotationSelected(annotation.id);
    let isVisible = true;
    if (key !== -1) { // -1 is for currentAnnotation which should always be visible regardless of filters
      isVisible = shouldShowAnnotation(annotation);
    }
    
    const isUnlabeled = annotation.class === null;
    const annotationClassName = isUnlabeled ? UNLABELED_CLASS_KEY : annotation.class;

    // Only return if visible or specifically selected (for pulse effect)
    if (!isVisible && !isSelected && key !== -1) return null; // Only render current drawing annotation if not visible/selected

    // Use classColors as primary source, fallback to default getClassColor
    const baseColor = getResolvedClassColor(annotationClassName);
    const statusColor = getStatusColor(annotation.status);
    
    const borderColor = statusColor || (isSelected ? '#f59e0b' : baseColor);

    const fillOpacity = isUnlabeled ? 0.4 : annotationOpacity;

    if (annotation.type === 'bbox') {
      const normalized = (() => {
        let { x, y, width, height } = annotation;
        if (width < 0) {
          x += width;
          width = Math.abs(width);
        }
        if (height < 0) {
          y += height;
          height = Math.abs(height);
        }
        return { x, y, width, height };
      })();
      const style = {
        position: 'absolute',
        left: normalized.x,
        top: normalized.y,
        width: normalized.width,
        height: normalized.height,
        border: `2px ${isUnlabeled ? 'dashed' : 'solid'} ${borderColor}`,
        backgroundColor: hexToRgba(baseColor, fillOpacity), // Less opaque for unlabeled
        zIndex: isPrimarySelected ? 20 : isSelected ? 15 : 10,
        opacity: (isVisible || isDrawing) ? 1 : 0.3 // Dim non-selected/non-drawing if annotations hidden
      };
      return (
        <div
          key={key}
          style={style}
          className={`pointer-events-auto transition-colors duration-200 ${isSelected ? 'shadow-lg' : ''}`}
          // REMOVED onClick handler that was causing the conflict
        >
          <div className="flex items-center justify-between w-full h-full p-1">
            {showLabels && (
              <Badge
                className="text-white text-xs self-start"
                style={{
                  transform: `scale(${1 / zoom})`,
                  transformOrigin: 'top left',
                  backgroundColor: borderColor
                }}
              >
                {isUnlabeled ? UNLABELED_CLASS_KEY : `#${annotation.index} ${annotation.class}`}
              </Badge>
            )}
            {annotation.status !== 'neutral' && (
              <Badge
                className="text-white text-xs self-end"
                style={{
                  transform: `scale(${1 / zoom})`,
                  transformOrigin: 'bottom right',
                  backgroundColor: statusColor
                }}
              >
                {annotation.status}
              </Badge>
            )}
          </div>

          {isSelected && annotationMode === 'move' && getResizeHandles({ ...annotation, ...normalized }).map(handle => (
              <div
                key={handle.position}
                style={{
                    position: 'absolute',
                    left: handle.x,
                    top: handle.y,
                    width: handle.size,
                    height: handle.size,
                    backgroundColor: 'white',
                    border: `1px solid ${baseColor}`, // Use base color for handles
                    borderRadius: '50%',
                    cursor: (handle.position === 'top-left' || handle.position === 'bottom-right') ? 'nwse-resize' : 'nesw-resize',
                    zIndex: 30,
                }}
              />
          ))}
        </div>
      );
    } else if (annotation.type === 'polygon' || annotation.type === 'brush') {
      if (!annotation.points || annotation.points.length === 0) return null;

      // Calculate bounding box for positioning the SVG container and badges
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      annotation.points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });
      // Also account for preview point in bounding box calculation for polygon drawing
      if (annotation.previewPoint) {
          minX = Math.min(minX, annotation.previewPoint.x);
          minY = Math.min(minY, annotation.previewPoint.y);
          maxX = Math.max(maxX, annotation.previewPoint.x);
          maxY = Math.max(maxY, annotation.previewPoint.y);
      }


      // SVG path points are relative to its own viewBox (0,0)
      const pointsString = annotation.points.map(p => `${p.x - minX},${p.y - minY}`).join(' ');
      
      let previewLine = null;
      // For polygon in drawing mode, render a line from last point to current cursor (previewPoint)
      if (annotation.type === 'polygon' && isDrawing && annotation.previewPoint && annotation.points.length > 0) {
        const lastPoint = annotation.points[annotation.points.length - 1];
        previewLine = <line 
          x1={lastPoint.x - minX} y1={lastPoint.y - minY} 
          x2={annotation.previewPoint.x - minX} y2={annotation.previewPoint.y - minY} 
          stroke={borderColor} strokeWidth={2 / zoom} strokeDasharray={`${6/zoom} ${4/zoom}`}
        />;
      }
      
      const isBrushCompleted = annotation.type === 'brush' && !isDrawing && annotation.points.length > 5;

      return (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: minX,
            top: minY,
            width: maxX - minX,
            height: maxY - minY,
            zIndex: isSelected ? 20 : 10,
            opacity: (isVisible || isDrawing) ? 1 : 0.3,
            pointerEvents: 'none', // The containing div does not intercept pointer events
          }}
          // REMOVED onClick handler that was causing the conflict
        >
          {showLabels && !isDrawing && (
            <Badge
              className="text-white text-xs"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `scale(${1 / zoom})`, // Scale badge inversely to zoom
                transformOrigin: 'top left',
                backgroundColor: borderColor,
                pointerEvents: 'auto', // Badge should be interactive
              }}
            >
              {isUnlabeled ? UNLABELED_CLASS_KEY : `#${annotation.index} ${annotation.class}`}
            </Badge>
          )}
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${maxX - minX} ${maxY - minY}`}
            className="overflow-visible"
            style={{ pointerEvents: 'auto' }} // SVG content is interactive
          >
            {annotation.type === 'polygon' ? (
              <polygon
                points={pointsString}
                fill={isDrawing ? 'none' : baseColor}
                fillOpacity={isDrawing ? undefined : fillOpacity}
                stroke={borderColor}
                strokeWidth={2 / zoom}
                strokeDasharray={isUnlabeled ? `${4/zoom} ${4/zoom}` : 'none'}
              />
            ) : ( // Brush
              <path
                d={`M ${annotation.points.map(p => `${p.x - minX} ${p.y - minY}`).join(' L ')} ${isBrushCompleted ? ' Z' : ''}`}
                fill={isBrushCompleted ? baseColor : 'none'}
                fillOpacity={isBrushCompleted ? fillOpacity : undefined}
                stroke={borderColor}
                strokeWidth={annotation.brushSize / zoom} // Use brushSize prop, scaled by zoom
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {previewLine}
            
            {/* Render vertices for polygon drawing */}
            {isDrawing && annotation.type === 'polygon' && annotation.points.map((p, index) => (
              <circle
                key={index}
                cx={p.x - minX}
                cy={p.y - minY}
                r={5 / zoom}
                fill={index === 0 ? 'rgba(74, 222, 128, 0.9)' : 'rgba(251, 146, 60, 0.9)'} // Green for first, orange for others
                stroke="white"
                strokeWidth={1.5 / zoom}
              />
            ))}

            {/* NEW: Render vertices for polygon adjustment */}
            {isSelected && !isDrawing && annotationMode === 'move' && annotation.type === 'polygon' && annotation.points.map((p, index) => (
              <circle
                key={`vertex-handle-${index}`}
                cx={p.x - minX}
                cy={p.y - minY}
                r={5 / zoom}
                fill={'#f59e0b'} // amber-500
                stroke="white"
                strokeWidth={1.5 / zoom}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
              />
            ))}
          </svg>
          {annotation.status !== 'neutral' && !isDrawing && (
            <Badge
              className="text-white text-xs"
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                transform: `scale(${1 / zoom})`,
                transformOrigin: 'bottom right',
                backgroundColor: statusColor,
                pointerEvents: 'auto',
              }}
            >
              {annotation.status}
            </Badge>
          )}
        </div>
      );
    }
  };

  // Enhanced annotations list with filtering and grouping
  const renderAnnotationsList = () => {
    // Only show panel if there are annotations or if currentStep.classes exist for filter buttons
    if (annotations.length === 0 && (!currentStep?.classes || currentStep.classes.length === 0) && stepImages.every(img => !(img.annotations?.annotations?.length > 0))) return (
        <div className="h-full flex flex-col border-r border-gray-200 bg-white">
            <div className="p-4 border-b border-gray-200">
                 <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">
                        Annotations (0)
                    </span>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center text-center p-4">
                <p className="text-sm text-gray-500">No annotations yet. Start by drawing a box on the image.</p>
            </div>
        </div>
    );

    const currentImageStats = getAnnotationStats();
    // Use currentStep.classes and step-wide stats to get all possible classes
    const availableClasses = Array.from(new Set([
      ...(currentStep?.classes || []),
      ...Object.keys(stepWideAnnotationStats),
      ...(annotations.some(ann => ann.class === null) && !Array.from(new Set([...Object.keys(stepWideAnnotationStats), ...(currentStep?.classes || [])])).includes(UNLABELED_CLASS_KEY) ? [UNLABELED_CLASS_KEY] : []) // Add Unlabeled if exists on current image and not already covered by stepWide or stepClasses
    ])).sort();

    // Group annotations by class if enabled
    const filteredAnnotations = annotations.filter(ann => shouldShowAnnotation(ann));

    const groupedAnnotations = groupByClass
      ? availableClasses.reduce((groups, className) => {
          const classAnns = filteredAnnotations.filter(ann => (ann.class || UNLABELED_CLASS_KEY) === className);
          if (classAnns.length > 0) { // Only add group if it has annotations after filtering
            groups[className] = classAnns;
          }
          return groups;
        }, {})
      : { 'All': filteredAnnotations }; // If not grouped, all filtered annotations go into 'All'

    return (
      <div className="h-full flex flex-col border-r border-gray-200 bg-white">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-900">
                Annotations ({annotations.length})
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAnnotations(!showAnnotations)}
                className="h-6 w-6 p-0"
                title={showAnnotations ? "Hide all annotations on image" : "Show all annotations on image"}
              >
                {showAnnotations ? (
                  <Eye className="w-3 h-3 text-blue-600" />
                ) : (
                  <EyeOff className="w-3 h-3 text-gray-400" />
                )}
              </Button>
            </div>
          </div>

          {/* Search */}
          <Input
            placeholder="Search annotations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs h-7 mb-2"
          />

          {/* Class filters */}
          <div className="flex flex-wrap gap-1 mb-2">
            {availableClasses.map((className, index) => {
              const currentImageCount = currentImageStats[className]?.count || 0;
              const totalStepCount = stepWideAnnotationStats[className]?.count || 0;

              // Do not show button if there are no annotations at all for this class AND it's not a class explicitly defined for the current step
              if (totalStepCount === 0 && !(currentStep?.classes || []).includes(className) && className !== UNLABELED_CLASS_KEY) return null;

              return (
                <Button
                  key={className}
                  variant={classFilters.has(className) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleClassFilter(className)}
                  className="text-xs h-6 px-2"
                  style={{
                    backgroundColor: classFilters.has(className) ? getResolvedClassColor(className) : 'transparent',
                    borderColor: getResolvedClassColor(className),
                    color: classFilters.has(className) ? 'white' : getResolvedClassColor(className)
                  }}
                >
                  {className} ({currentImageCount}/{totalStepCount})
                </Button>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowLabels(!showLabels)}
              className="h-6 text-xs"
            >
              Labels: {showLabels ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGroupByClass(!groupByClass)}
              className="h-6 text-xs"
            >
              Group: {groupByClass ? 'ON' : 'OFF'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-6 text-xs text-red-600"
            >
              Clear All
            </Button>
          </div>

          {/* Opacity slider */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-600">Opacity:</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={annotationOpacity}
              onChange={(e) => setAnnotationOpacity(parseFloat(e.target.value))}
              className="flex-1 h-1"
            />
            <span className="text-xs text-gray-600">{Math.round(annotationOpacity * 100)}%</span>
          </div>
        </div>

        {/* Annotations list */}
        <ScrollArea className="flex-1">
          <div className="p-2">
          {Object.keys(groupedAnnotations).length > 0 ? (
            Object.entries(groupedAnnotations).map(([groupName, groupAnnotations]) => (
              <div key={groupName} className="mb-3">
                {groupByClass && availableClasses.length > 1 && (
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getResolvedClassColor(groupName) }}
                    />
                    <span className="text-xs font-medium text-gray-700 flex-1">
                      {groupName} ({groupAnnotations.length})
                    </span>
                    <input
                      ref={el => (colorInputRefs.current[groupName] = el)}
                      type="color"
                      value={getResolvedClassColor(groupName)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleClassColorChange(groupName, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-0 h-0 p-0 border-0 absolute opacity-0"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        colorInputRefs.current[groupName]?.click();
                      }}
                      className="h-6 w-6 p-0 hover:bg-gray-200"
                      title={`Change color for all '${groupName}' annotations`}
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-1">
                  {groupAnnotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer transition-colors ${
                        isAnnotationSelected(annotation.id)
                          ? 'bg-blue-100 border border-blue-300'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={(event) => highlightAnnotation(annotation.id, event)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-blue-700">#{annotation.index}</span>
                        <span className="text-gray-700 truncate">{annotation.class || UNLABELED_CLASS_KEY}</span>
                        <Badge className="bg-gray-200 text-gray-700 text-xs" style={{ backgroundColor: getStatusColor(annotation.status) || undefined, color: getStatusColor(annotation.status) ? 'white' : undefined }}>
                          {annotation.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAnnotation(annotation.id);
                          }}
                          className="h-6 w-6 p-0 text-red-500 hover:bg-red-100"
                          title="Delete annotation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 text-xs">
              No annotations match current filters
            </div>
          )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderCanvasContent = () => {
    const selectedAnnotation = annotations.find(ann => ann.id === selectedAnnotationId);

    // This div is sized to the natural dimensions of the image.
    return (
      <div
        ref={imageContainerRef}
        style={{
          position: 'relative',
          width: effectiveImageProps.naturalWidth,
          height: effectiveImageProps.naturalHeight,
          cursor: cursor, // Apply dynamic cursor state to the whole interactive layer
          userSelect: 'none',
          pointerEvents: 'auto', // This div itself is interactive
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu} // Prevent right-click menu
      >
        <img
          ref={imageRef}
          src={currentImage.image_url}
          alt={currentImage.image_name}
          className="absolute top-0 left-0 select-none"
          onLoad={handleImageLoad}
          onDragStart={(e) => e.preventDefault()} // Prevent image dragging
          style={{
            pointerEvents: 'none', // Image itself doesn't intercept mouse events
            width: effectiveImageProps.naturalWidth,
            height: effectiveImageProps.naturalHeight,
          }}
        />
        {/* Annotations layer */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {annotations.map((annotation) => renderAnnotation(annotation, annotation.id))}
            {currentAnnotation && isDrawing && renderAnnotation(currentAnnotation, -1)}

            {/* Dynamic Annotation Toolbar */}
            {selectedAnnotation && !labelingState.isVisible && (() => {
              let toolbarX, toolbarY;
              // Calculate bounding box for polygon/brush to position toolbar
              if (selectedAnnotation.type === 'bbox') {
                toolbarX = selectedAnnotation.x;
                toolbarY = selectedAnnotation.y;
              } else if (selectedAnnotation.points && selectedAnnotation.points.length > 0) {
                let minX = Infinity, minY = Infinity;
                selectedAnnotation.points.forEach(p => {
                  minX = Math.min(minX, p.x);
                  minY = Math.min(minY, p.y);
                });
                toolbarX = minX;
                toolbarY = minY;
              } else {
                return null; // Should not happen for a valid selectedAnnotation
              }

              const baseTop = toolbarY - (40 / zoom);
              let clampedLeft = toolbarX;
              let clampedTop = baseTop;

              if (toolbarSize.width > 0 && toolbarSize.height > 0 && containerSize.width > 0 && containerSize.height > 0) {
                const padding = 8;
                const baseScreenX = pan.x + toolbarX * zoom;
                const baseScreenY = pan.y + baseTop * zoom;
                const rightOverflow = baseScreenX + toolbarSize.width + padding - containerSize.width;
                const leftOverflow = padding - baseScreenX;
                const bottomOverflow = baseScreenY + toolbarSize.height + padding - containerSize.height;
                const topOverflow = padding - baseScreenY;

                let offsetScreenX = 0;
                let offsetScreenY = 0;

                if (rightOverflow > 0) {
                  offsetScreenX = -rightOverflow;
                } else if (leftOverflow > 0) {
                  offsetScreenX = leftOverflow;
                }

                if (bottomOverflow > 0) {
                  offsetScreenY = -bottomOverflow;
                } else if (topOverflow > 0) {
                  offsetScreenY = topOverflow;
                }

                clampedLeft = toolbarX + offsetScreenX / zoom;
                clampedTop = baseTop + offsetScreenY / zoom;
              }

              return (
                <AnnotationToolbar
                  ref={toolbarRef}
                  annotation={selectedAnnotation}
                  onStatusChange={(status) => handleAnnotationStatusChange(selectedAnnotation.id, status)}
                  onDelete={() => deleteAnnotation(selectedAnnotation.id)}
                  stepStatus={currentStep?.status} // Pass the step status to make toolbar dynamic
                  style={{
                    left: clampedLeft,
                    top: clampedTop, // Position above the top-left of the bounding box
                    transform: `scale(${1 / zoom})`, // Scale toolbar inversely to zoom for constant screen size
                    transformOrigin: 'bottom left',
                    pointerEvents: 'auto', // Toolbar itself should be interactive
                  }}
                />
              );
            })()}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Enhanced Toolbar with Image Context */}
      <div className="p-4 bg-white border-b border-gray-200 z-10">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAnnotationPanel(!showAnnotationPanel)}
              title={showAnnotationPanel ? "Hide Annotations Panel" : "Show Annotations Panel"}
              className="h-7 w-7 p-0"
            >
              {showAnnotationPanel ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
            {!showAnnotationPanel && annotations.length > 0 && (
              <Badge className="bg-blue-50 text-blue-700 border-blue-100 text-xs">
                {annotations.length} annotations
              </Badge>
            )}
            <div className="w-24">
              <div
                className={`flex items-center gap-1 text-[11px] transition-opacity ${
                  saveStatus === "idle" ? "opacity-0" : "opacity-100"
                }`}
                role="status"
                aria-live="polite"
              >
                {saveStatus === "saving" && <Save className="w-3 h-3 text-blue-600 animate-pulse" />}
                {saveStatus === "saved" && <CheckCircle className="w-3 h-3 text-green-600" />}
              {saveStatus === "error" && <AlertTriangle className="w-3 h-3 text-red-600" />}
              <span
                className={
                  saveStatus === "saving"
                    ? "text-blue-600"
                    : saveStatus === "saved"
                      ? "text-green-600"
                      : "text-red-600"
                }
              >
                {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : "Save failed"}
              </span>
              {saveStatus === "error" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={persistAnnotations}
                  className="h-5 px-2 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>

          {/* Enhanced Image Context Display with Group Navigation */}
          <div className="flex items-center gap-4 ml-auto">
            {currentImage && (
              <div className="flex items-center gap-3 px-3 py-0.5 bg-white rounded-lg border border-gray-200 h-7 w-[320px]">
                <div className="flex items-center gap-2 w-[140px] min-w-0">
                  <ImageIcon className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <span className="text-xs font-medium text-gray-900 truncate" title={currentImage.image_name}>
                    {currentImage.image_name}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4 flex-shrink-0" />
                <div className="flex items-center gap-2 relative w-[150px] min-w-0">
                  <FolderOpen className="w-4 h-4 text-gray-600 flex-shrink-0" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowGroupNavigation(!showGroupNavigation)}
                    className="h-6 px-2 py-0 text-xs text-gray-700 flex-1 min-w-0 justify-between"
                  >
                    <span className="text-xs truncate">
                      {currentImageGroup} ({imageGroups[currentImageGroup]?.length || 0})
                    </span>
                    <ChevronDown className="w-3 h-3 ml-1 text-gray-500 flex-shrink-0" />
                  </Button>
                  
                  {/* Group Navigation Dropdown */}
                  {showGroupNavigation && (
                    <div
                      className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48"
                      onBlur={() => setShowGroupNavigation(false)}
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()} // Prevent this click from propagating to canvas
                    >
                      <div className="p-2 border-b border-gray-100">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Jump to Group</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {Object.entries(imageGroups).map(([groupName, groupImages]) => (
                          <Button
                            key={groupName}
                            variant="ghost"
                            size="sm"
                            onClick={() => jumpToGroup(groupName)}
                            className={`w-full justify-start text-left h-8 px-3 ${
                              groupName === currentImageGroup ? 'bg-blue-50 text-blue-700' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm">{groupName}</span>
                              <Badge variant="outline" className="text-xs">
                                {groupImages.length}
                              </Badge>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Group Navigation */}
            {currentImage && totalImages > 0 && (
              <div className="flex items-center gap-2 px-3 py-0.5 bg-gray-50 rounded-lg border border-gray-200 w-52">
                  <div className="flex items-center gap-1 w-10 justify-start">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => getNextGroupImage(-1)} 
                      disabled={currentIndexInGroup <= 0 || currentIndexInGroup === -1}
                      title="Previous in Group" 
                      className="h-7 w-7 p-0 flex-shrink-0"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col items-center justify-center text-center flex-1">
                    <div className="text-xs font-medium text-gray-800 bg-white px-2 py-0.5 rounded-md border whitespace-nowrap">
                      {currentIndexInGroup !== -1 ? `${currentIndexInGroup + 1} of ${totalInGroup}` : 'No Group'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 w-10 justify-end">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => getNextGroupImage(1)} 
                      disabled={currentIndexInGroup === -1 || currentIndexInGroup >= totalInGroup - 1}
                      title="Next in Group" 
                      className="h-7 w-7 p-0 flex-shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
            )}

            {currentStep?.needs_clarification && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Needs clarification
              </Badge>
            )}
            {(currentImage || currentStep?.needs_clarification) && (
              <Separator orientation="vertical" className="h-6" />
            )}

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  title="Zoom out (Ctrl+Scroll)"
                  className="h-6 w-6 p-0"
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetZoom}
                  className="h-6 w-12 px-0 text-xs font-medium tabular-nums justify-center"
                  title="Fit image to screen"
                >
                  {zoomLabel}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  title="Zoom in (Ctrl+Scroll)"
                  className="h-6 w-6 p-0"
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area with flex layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Annotations Panel */}
        <AnimatePresence>
          {showAnnotationPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 384, opacity: 1 }} // w-96
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              {renderAnnotationsList()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area - The outer container that is NOT transformed, and handles wheel events */}
        <div
          className="flex-1 bg-gray-100 relative flex items-center justify-center"
          ref={canvasContainerRef}
          onMouseMove={handleGlobalMouseMove} // Keep this for cursor updates
          style={{
            overflow: 'hidden' // Completely disable scrollbars
          }}
        >
          {labelingState.isVisible && (
            <AnnotationLabler
              x={labelingState.x}
              y={labelingState.y}
              classes={currentStep?.classes}
              suggestedClass={activeClass}
              onSelect={(className) => handleLabelSelect(labelingState.annotationId, className)}
              onCancel={() => handleLabelCancel(labelingState.annotationId)}
            />
          )}

          {currentImage ? (
            <div
              className="transform-wrapper"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              {renderCanvasContent()}
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <div className="p-8 bg-white rounded-lg shadow-md">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>No image selected for annotation</p>
                <p className="text-sm">Upload images in the Images tab</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
