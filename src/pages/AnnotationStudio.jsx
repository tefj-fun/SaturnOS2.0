
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getProjectById, listStepsByProject, listStepImages, updateProject, updateStep, updateStepImage } from "@/api/db";
import { BuildVariant, StepVariantConfig } from "@/api/entities";
import { createSignedImageUrl, getStoragePathFromUrl } from "@/api/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  PenTool,
  Bot,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Circle,
  Target,
  Cog,
  Image as ImageIcon,
  Layers3,
  List,
  BarChart3,
  Spline,
  Package,
  FileText,
  Download
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";

import { InvokeLLM } from "@/api/integrations";

import AnnotationCanvas from "../components/annotation/AnnotationCanvas";
import StepNavigation from "../components/annotation/StepNavigation";
import AnnotationChat from "../components/annotation/AnnotationChat";
import LogicBuilder from "../components/annotation/LogicBuilder";
import ImagePortal from "../components/annotation/ImagePortal";
import AnnotationInsights from "../components/annotation/AnnotationInsights";

export default function AnnotationStudioPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSopLoading, setIsSopLoading] = useState(false);
  const [sopSignedUrl, setSopSignedUrl] = useState(null);
  const [showCopilot, setShowCopilot] = useState(true);
  const [activeTab, setActiveTab] = useState('canvas');
  const [annotationMode, setAnnotationMode] = useState('draw');
  const [activeClass, setActiveClass] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [logicRules, setLogicRules] = useState([]);
  const [stepImages, setStepImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hasLoadedImages, setHasLoadedImages] = useState(false);
  const [isInitialImageReady, setIsInitialImageReady] = useState(false);
  const [showStepsPopup, setShowStepsPopup] = useState(false);
  const [brushSize, setBrushSize] = useState(10);
  const canvasRef = useRef(null);
  const initialStepAppliedRef = useRef(false);
  const initialImageAppliedRef = useRef(false);
  const classPromptedStepsRef = useRef(new Set());
  const [showClassImportPrompt, setShowClassImportPrompt] = useState(false);
  const [pendingClassNames, setPendingClassNames] = useState([]);

  const [selectedBuildVariant, setSelectedBuildVariant] = useState(null);
  const [buildVariants, setBuildVariants] = useState([]);
  const [currentStepConfig, setCurrentStepConfig] = useState(null);
  const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
  const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";
  const isCopilotAllowed = activeTab !== 'images' && activeTab !== 'insights';
  const sopFilename = useMemo(() => {
    if (!project?.sop_file_url) return "sop.pdf";
    const path = getStoragePathFromUrl(project.sop_file_url, "sops");
    if (path) {
      const parts = path.split("/");
      return parts[parts.length - 1] || "sop.pdf";
    }
    try {
      const parsed = new URL(project.sop_file_url);
      const parts = parsed.pathname.split("/");
      return decodeURIComponent(parts[parts.length - 1]) || "sop.pdf";
    } catch (error) {
      return "sop.pdf";
    }
  }, [project?.sop_file_url]);

  const isImageAnnotated = useCallback((image) => {
    if (image?.no_annotations_needed) return true;
    const imageAnnotations = Array.isArray(image?.annotations)
      ? image.annotations
      : (image?.annotations?.annotations || []);
    return imageAnnotations.length > 0;
  }, []);

  const inferClassesFromImages = useCallback((images) => {
    const seen = new Set();
    const inferred = [];
    images.forEach((image) => {
      const annotations = Array.isArray(image?.annotations)
        ? image.annotations
        : (image?.annotations?.annotations || []);
      annotations.forEach((annotation) => {
        if (!annotation || typeof annotation !== "object") return;
        const rawName = annotation.class || annotation.label || annotation.class_name || annotation.name;
        const name = typeof rawName === "string" ? rawName.trim() : "";
        if (!name || seen.has(name)) return;
        seen.add(name);
        inferred.push(name);
      });
    });
    return inferred;
  }, []);

  const imageProgress = useMemo(() => {
    if (!stepImages.length) return null;
    const groupStats = {};
    let completed = 0;
    stepImages.forEach((image) => {
      const groupName = image.image_group || "Untagged";
      if (!groupStats[groupName]) {
        groupStats[groupName] = { total: 0, completed: 0 };
      }
      groupStats[groupName].total += 1;
      if (isImageAnnotated(image)) {
        groupStats[groupName].completed += 1;
        completed += 1;
      }
    });
    const total = stepImages.length;
    const groupSummary = Object.entries(groupStats)
      .map(([groupName, stats]) => `${groupName}: ${stats.completed}/${stats.total}`)
      .join(" | ");
    return {
      total,
      completed,
      isComplete: total > 0 && completed === total,
      groupSummary,
    };
  }, [stepImages, isImageAnnotated]);

  // This effect will run when the component mounts and unmounts
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const currentStep = steps[currentStepIndex];

  // Get effective step configuration (with build variant overrides applied)
  const effectiveStepConfig = useMemo(() => {
    if (!currentStep) return null;
    
    const baseConfig = {
      ...currentStep,
      classes: currentStep.classes || [],
      status: currentStep.status || "Pass,Fail"
    };
    
    if (!currentStepConfig) return baseConfig;
    
    return {
      ...baseConfig,
      classes: currentStepConfig.active_classes?.length > 0 ? currentStepConfig.active_classes : baseConfig.classes,
      status: currentStepConfig.status_options || baseConfig.status
    };
  }, [currentStep, currentStepConfig]);


  const loadProjectData = useCallback(async (id, initialStepId = null) => {
    try {
      const [projectData, stepsData] = await Promise.all([
        getProjectById(id),
        listStepsByProject(id)
      ]);

      if (projectData) {
        setProject(projectData);
        setSteps(stepsData || []);

        if (
          (stepsData || []).length > 0 &&
          projectData.status !== "annotation_in_progress" &&
          projectData.status !== "completed"
        ) {
          try {
            await updateProject(id, { status: "annotation_in_progress" });
            setProject(prev => (prev ? { ...prev, status: "annotation_in_progress" } : prev));
          } catch (error) {
            console.error("Error updating project status:", error);
          }
        }

        if (!initialStepId) {
          const firstIncompleteIndex = (stepsData || []).findIndex(step => !step.is_annotated);
          if (firstIncompleteIndex !== -1) {
            setCurrentStepIndex(firstIncompleteIndex);
          }
        }
      }
    } catch (error) {
      console.error("Error loading project data:", error);
    }
    setIsLoading(false);
  }, []);

  const loadBuildVariants = useCallback(async () => {
    try {
      const variants = await BuildVariant.list();
      setBuildVariants(variants);
      setSelectedBuildVariant(prev => {
        if (!variants.length) return null;
        if (!prev) return variants[0];
        const match = variants.find(variant => variant.id === prev.id);
        return match || variants[0];
      });
    } catch (error) {
      console.error("Error loading build variants:", error);
      setBuildVariants([]);
      setSelectedBuildVariant(null);
    }
  }, []);

  const loadStepVariantConfig = useCallback(async () => {
    if (!currentStep || !selectedBuildVariant) {
      setCurrentStepConfig(null);
      return;
    }
    try {
      const configs = await StepVariantConfig.filter({
        build_variant_id: selectedBuildVariant.id,
        sop_step_id: currentStep.id,
      });
      setCurrentStepConfig(configs[0] || null);
    } catch (error) {
      console.error("Error loading step variant config:", error);
      setCurrentStepConfig(null);
    }
  }, [currentStep, selectedBuildVariant]);

  const loadLogicRules = useCallback(async () => {
    if (!currentStep) return;
    setLogicRules([]);
  }, [currentStep]);

  const loadStepImages = useCallback(async (options = {}) => {
    if (!currentStep) return;
    const { preserveIndex = false, resetLoading = true } = options;
    if (resetLoading) {
      setHasLoadedImages(false);
      setIsInitialImageReady(false);
    }
    try {
      const images = await listStepImages(currentStep.id);
      const signedImages = await Promise.all(
        images.map(async (image) => {
          const baseUrl = image.image_url || image.display_url || image.thumbnail_url;
          let bucket = STEP_IMAGES_BUCKET;
          let path = getStoragePathFromUrl(baseUrl, STEP_IMAGES_BUCKET);
          if (!path) {
            bucket = DATASET_BUCKET;
            path = getStoragePathFromUrl(baseUrl, DATASET_BUCKET);
          }
          if (!path) return image;

          const [thumbnailUrl, displayUrl, fullUrl] = await Promise.all([
            createSignedImageUrl(bucket, path, {
              expiresIn: 3600,
              transform: { width: 300, height: 300, resize: "cover" },
            }),
            createSignedImageUrl(bucket, path, {
              expiresIn: 3600,
              transform: { width: 1200, resize: "contain" },
            }),
            createSignedImageUrl(bucket, path, { expiresIn: 3600 }),
          ]);

          return {
            ...image,
            storage_path: path,
            thumbnail_url: thumbnailUrl || image.thumbnail_url,
            display_url: displayUrl || image.display_url,
            image_url: fullUrl || image.image_url,
          };
        })
      );

      setStepImages(signedImages);
      if (preserveIndex) {
        setCurrentImageIndex(prevIndex => {
          if (!signedImages.length) return 0;
          return Math.min(prevIndex, signedImages.length - 1);
        });
      } else {
        setCurrentImageIndex(0);
      }
      setHasLoadedImages(true);
      if (!signedImages.length) {
        setIsInitialImageReady(true);
      }
    } catch (error) {
      console.error("Error loading step images:", error);
      setStepImages([]);
      setHasLoadedImages(true);
      setIsInitialImageReady(true);
    }
  }, [currentStep]);

  useEffect(() => {
    const imageUrl = stepImages[currentImageIndex]?.image_url;
    if (!imageUrl) {
      if (stepImages.length > 0) {
        setIsInitialImageReady(true);
      }
      return;
    }
    let isActive = true;
    const image = new Image();
    image.onload = () => {
      if (isActive) setIsInitialImageReady(true);
    };
    image.onerror = () => {
      if (isActive) setIsInitialImageReady(true);
    };
    image.src = imageUrl;
    return () => {
      isActive = false;
    };
  }, [stepImages, currentImageIndex]);

  const initializeAIGuidance = useCallback(async () => {
    if (!effectiveStepConfig || !effectiveStepConfig.classes) return;

    setIsAIThinking(true);
    try {
      const guidancePrompt = `
        You are an annotation assistant. Your goal is to provide a clear, friendly, and direct starting instruction for the user.

        Here is the context for the current step:
        - Step Title: "${effectiveStepConfig.title}"
        - Description: "${effectiveStepConfig.description || "No description provided."}"
        - Classes to Annotate: "${(effectiveStepConfig.classes || []).join(', ')}"
        - Business Logic: "${effectiveStepConfig.business_logic || effectiveStepConfig.condition || "No specific business logic or condition provided."}"
        - First class to annotate: "${(effectiveStepConfig.classes && effectiveStepConfig.classes.length > 0) ? effectiveStepConfig.classes[0] : "a class"}"

        Generate a very short (1-2 sentences), friendly, and direct instruction to get the user started.
        For example: "Let's start by finding all the '${(effectiveStepConfig.classes && effectiveStepConfig.classes.length > 0) ? effectiveStepConfig.classes[0] : "class"}' elements. Please draw a box around each one."
        You can also add a small hint from the business logic if it's simple.
      `;

      const response = await InvokeLLM({
        prompt: guidancePrompt
      });

      const initialMessage = {
        id: Date.now(),
        type: 'ai',
        content: response,
        timestamp: new Date()
      };

      setChatMessages([initialMessage]);
    } catch (error) {
      console.error("Error generating AI guidance:", error);
      const fallbackMessage = {
        id: Date.now(),
        type: 'ai',
        content: `Hi! Let's get started. Please select a class to annotate from the list below, then draw boxes around the matching elements on the image.`,
        timestamp: new Date()
      };
      setChatMessages([fallbackMessage]);
    }
    setIsAIThinking(false);
  }, [effectiveStepConfig]);

  useEffect(() => {
    const id = searchParams.get('projectId');
    const stepIdParam = searchParams.get('stepId');
    if (id) {
      if (id === projectId) {
        return;
      }
      setProjectId(id);
      loadProjectData(id, stepIdParam);
    } else {
      if (!projectId) {
        navigate(createPageUrl('Projects'));
      }
    }
  }, [navigate, loadProjectData, projectId, searchParams]);

  useEffect(() => {
    initialStepAppliedRef.current = false;
  }, [projectId]);

  useEffect(() => {
    if (!steps.length || initialStepAppliedRef.current) {
      return;
    }
    const stepIdParam = searchParams.get('stepId');
    if (stepIdParam) {
      const stepIndex = steps.findIndex(step => step.id === stepIdParam);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }
    }
    initialStepAppliedRef.current = true;
  }, [steps, searchParams]);

  // New: Load build variants on mount
  useEffect(() => {
    loadBuildVariants();
  }, [loadBuildVariants]);

  useEffect(() => {
    if (!project?.sop_file_url) {
      setSopSignedUrl(null);
      return;
    }

    let isActive = true;
    const loadSopUrl = async () => {
      setIsSopLoading(true);
      try {
        const path = getStoragePathFromUrl(project.sop_file_url, "sops");
        if (!path) {
          if (isActive) setSopSignedUrl(project.sop_file_url);
          return;
        }
        const signedUrl = await createSignedImageUrl("sops", path, { expiresIn: 3600 });
        if (isActive) setSopSignedUrl(signedUrl || project.sop_file_url);
      } catch (error) {
        console.error("Error creating signed SOP URL:", error);
        if (isActive) setSopSignedUrl(project.sop_file_url);
      } finally {
        if (isActive) setIsSopLoading(false);
      }
    };

    loadSopUrl();
    return () => {
      isActive = false;
    };
  }, [project?.sop_file_url]);

  // Existing useEffect for currentStep changes to load base data (rules, images)
  useEffect(() => {
    if (currentStep) {
      loadLogicRules();
      loadStepImages();
    }
  }, [currentStep, loadLogicRules, loadStepImages]);

  useEffect(() => {
    initialImageAppliedRef.current = false;
  }, [currentStepIndex]);

  useEffect(() => {
    if (!stepImages.length || initialImageAppliedRef.current) {
      return;
    }
    const imageIdParam = searchParams.get('imageId');
    if (imageIdParam) {
      const imageIndex = stepImages.findIndex(image => image.id === imageIdParam);
      if (imageIndex !== -1) {
        setCurrentImageIndex(imageIndex);
      }
    }
    initialImageAppliedRef.current = true;
  }, [stepImages, searchParams]);

  useEffect(() => {
    if (!currentStep || !imageProgress) return;
    const shouldBeAnnotated = imageProgress.isComplete;
    if (Boolean(currentStep.is_annotated) === shouldBeAnnotated) return;

    const syncStepCompletion = async () => {
      try {
        await updateStep(currentStep.id, { is_annotated: shouldBeAnnotated });
        setSteps(prev =>
          prev.map(step =>
            step.id === currentStep.id ? { ...step, is_annotated: shouldBeAnnotated } : step
          )
        );
      } catch (error) {
        console.error("Error syncing step completion:", error);
      }
    };

    syncStepCompletion();
  }, [currentStep, imageProgress]);

  useEffect(() => {
    if (!currentStep || !stepImages.length) return;
    const stepId = currentStep.id;
    if (!stepId || classPromptedStepsRef.current.has(stepId)) return;
    const currentClasses = (currentStep.classes || []).filter(Boolean);
    if (currentClasses.length > 0) return;

    const inferred = inferClassesFromImages(stepImages);
    if (!inferred.length) return;
    classPromptedStepsRef.current.add(stepId);
    setPendingClassNames(inferred);
    setShowClassImportPrompt(true);
  }, [currentStep, stepImages, inferClassesFromImages]);

  useEffect(() => {
    if (!projectId) return;
    const stepId = steps[currentStepIndex]?.id;
    const imageId = stepImages[currentImageIndex]?.id;
    const currentProjectId = searchParams.get('projectId');
    const currentStepId = searchParams.get('stepId');
    const currentImageId = searchParams.get('imageId');
    if (
      currentProjectId === projectId &&
      currentStepId === (stepId || null) &&
      currentImageId === (imageId || null)
    ) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('projectId', projectId);
    if (stepId) {
      nextParams.set('stepId', stepId);
    } else {
      nextParams.delete('stepId');
    }
    if (imageId) {
      nextParams.set('imageId', imageId);
    } else {
      nextParams.delete('imageId');
    }
    setSearchParams(nextParams, { replace: true });
  }, [projectId, steps, currentStepIndex, stepImages, currentImageIndex, searchParams, setSearchParams]);

  // New: Load step variant config when currentStep or selectedBuildVariant changes
  useEffect(() => {
    // This effect now relies on `loadStepVariantConfig` which handles the `currentStepConfig(null)` logic internally.
    loadStepVariantConfig();
  }, [currentStep, selectedBuildVariant, loadStepVariantConfig]);

  // When effectiveStepConfig is computed (due to currentStep, selectedBuildVariant, or currentStepConfig changing)
  // then initialize AI guidance and set the active class.
  useEffect(() => {
    if (effectiveStepConfig) {
      initializeAIGuidance();
      if (effectiveStepConfig.classes && effectiveStepConfig.classes.length > 0) {
        setActiveClass(effectiveStepConfig.classes[0]);
      } else {
        setActiveClass(null);
      }
    }
  }, [effectiveStepConfig, initializeAIGuidance]);


  const handleChatMessage = async (message) => {
    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setIsAIThinking(true);

    try {
      // Use effectiveStepConfig instead of currentStep
      const contextPrompt = `
        You are a helpful and concise annotation assistant. Your goal is to answer the user's questions based on the full context of the current annotation step.

        Here is the step summary:
        - Step Title: "${effectiveStepConfig.title}"
        - Description: "${effectiveStepConfig.description || "No description provided."}"
        - Classes to Annotate: "${(effectiveStepConfig.classes || []).join(', ')}"
        - Active Class: "${activeClass || "None selected"}"
        - Condition / Business Logic: "${effectiveStepConfig.business_logic || effectiveStepConfig.condition || "No specific business logic or condition provided."}"
        - Expected Label/Status: "${effectiveStepConfig.status || "Not specified"}"

        Here is the user's question: "${message}"

        Based ONLY on the step summary provided above, provide a short, direct, and helpful tip. Maximum 3 sentences. If the user asks about something not in the summary, gently guide them back to the task or suggest consulting the full step details.
      `;

      const response = await InvokeLLM({
        prompt: contextPrompt
      });

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response,
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error generating AI response:", error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: "I'm having trouble responding right now. Try refreshing the page or continue with the annotation using the visual guides.",
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    }

    setIsAIThinking(false);
  };

  const handleLogicRulesUpdate = async (updatedRules) => {
    setLogicRules(updatedRules);
    await loadLogicRules();
  };

  const handleImagesUpdate = useCallback(async () => {
    await loadStepImages({ preserveIndex: true, resetLoading: false });
  }, [loadStepImages]);

  const handleImageSaved = useCallback((imageId, updates) => {
    setStepImages(prev =>
      prev.map(image => (image.id === imageId ? { ...image, ...updates } : image))
    );
  }, []);

  const handleInitialImageLoaded = useCallback(() => {
    setIsInitialImageReady(true);
  }, []);

  const handleImportClasses = useCallback(async () => {
    if (!currentStep || !pendingClassNames.length) {
      setShowClassImportPrompt(false);
      return;
    }
    try {
      await updateStep(currentStep.id, { classes: pendingClassNames });
      setSteps(prev =>
        prev.map(step =>
          step.id === currentStep.id ? { ...step, classes: pendingClassNames } : step
        )
      );
    } catch (error) {
      console.error("Error importing classes:", error);
    } finally {
      setShowClassImportPrompt(false);
    }
  }, [currentStep, pendingClassNames]);
  
  const saveAndRun = async (action) => {
    if (canvasRef.current?.saveCurrentAnnotations) {
      await canvasRef.current.saveCurrentAnnotations();
    }
    action();
  };

  const handleStepSelectInPopup = (index) => {
    saveAndRun(() => {
      setCurrentStepIndex(index);
      setShowStepsPopup(false);
    });
  };

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      saveAndRun(() => setCurrentStepIndex(currentStepIndex + 1));
    }
  };

  const goToPrevStep = () => {
    if (currentStepIndex > 0) {
      saveAndRun(() => setCurrentStepIndex(currentStepIndex - 1));
    }
  };
  
  const handleImageIndexChange = (index) => {
    saveAndRun(() => setCurrentImageIndex(index));
  };

  const handleViewSop = useCallback(() => {
    const url = sopSignedUrl || project?.sop_file_url;
    if (!url || isSopLoading) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [sopSignedUrl, project?.sop_file_url, isSopLoading]);

  const handleDownloadSop = useCallback(() => {
    const url = sopSignedUrl || project?.sop_file_url;
    if (!url || isSopLoading) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = sopFilename || "sop.pdf";
    link.rel = "noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [sopSignedUrl, project?.sop_file_url, isSopLoading, sopFilename]);


  const currentImage = stepImages[currentImageIndex];
  const shouldBlockInitialLoad =
    steps.length > 0 && (!hasLoadedImages || (!isInitialImageReady && stepImages.length > 0));
  const isInitialLoading = isLoading || shouldBlockInitialLoad;
  const loadingTitle = isLoading ? "Loading annotation studio..." : "Loading first image...";
  const loadingSubtitle = isLoading ? "Preparing project steps and images" : "Setting up the first canvas";

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Target className="w-8 h-8 animate-pulse text-blue-600" />
          </div>
          <p className="text-gray-700 font-medium">{loadingTitle}</p>
          <p className="text-sm text-gray-500 mt-1">{loadingSubtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <Tabs value={activeTab} onValueChange={setActiveTab} className="h-screen w-full flex flex-col bg-gray-50">
      {/* Full-width Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl('Projects'))}
              className="glass-effect border-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {project?.name} - Annotation Studio
              </h1>
              <div className="flex items-center gap-4 mt-1">
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPrevStep} disabled={currentStepIndex === 0}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowStepsPopup(true)}
                      className="p-1 h-auto text-sm text-gray-600 hover:text-blue-600 hover:bg-gray-100"
                    >
                      <List className="w-3 h-3 mr-1.5" />
                      Step {currentStepIndex + 1} of {steps.length}
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNextStep} disabled={currentStepIndex >= steps.length - 1}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                 </div>

                
                {/* Show active configuration info */}
                {currentStepConfig && (
                  <Badge className="bg-green-100 text-green-800 text-xs">
                    <Package className="w-3 h-3 mr-1" />
                    Variant Config Active
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
             <TabsList className="grid grid-cols-4 max-w-xl">
                <TabsTrigger value="canvas" className="flex items-center gap-2">
                  <PenTool className="w-4 h-4" />
                  Canvas
                </TabsTrigger>
                <TabsTrigger value="logic" className="flex items-center gap-2">
                  <Cog className="w-4 h-4" />
                  Logic
                </TabsTrigger>
                <TabsTrigger value="images" className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  Images
                </TabsTrigger>
                <TabsTrigger value="insights" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Insights
                </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-3">
              {project?.sop_file_url && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewSop}
                    disabled={isSopLoading}
                    className="text-xs"
                  >
                    <FileText className="w-3 h-3 mr-1.5" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSop}
                    disabled={isSopLoading}
                    className="text-xs"
                  >
                    <Download className="w-3 h-3 mr-1.5" />
                    Download
                  </Button>
                </>
              )}
              <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(createPageUrl(`StepManagement?projectId=${projectId}`))}
                  className="text-xs"
              >
                  <Layers3 className="w-3 h-3 mr-1.5" />
                  Manage Steps
              </Button>

              <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(createPageUrl(`TrainingConfiguration?projectId=${projectId}`))}
                  className="text-xs bg-green-600 hover:bg-green-700"
              >
                  <Spline className="w-3 h-3 mr-1.5" />
                  Train Model
              </Button>
              
              {isCopilotAllowed && (
                <Button
                  variant={showCopilot ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowCopilot(!showCopilot)}
                  className={showCopilot ? "bg-blue-600 hover:bg-blue-700" : ""}
                >
                  <Bot className="w-4 h-4 mr-2" />
                  AI Copilot
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Full-width Content Area */}
      <div className="flex-1 flex w-full" style={{ overflow: 'hidden' }}>
        {/* Main Content Area */}
        <main className="flex-1 flex" style={{ overflow: 'hidden' }}>
            <div className="flex-1 relative bg-white" style={{ overflow: 'hidden' }}>
                <TabsContent value="canvas" className="h-full m-0">
                    <AnnotationCanvas
                        ref={canvasRef}
                        currentStep={effectiveStepConfig} // Used effective config
                        currentImage={currentImage}
                        annotationMode={annotationMode}
                        activeClass={activeClass}
                        onActiveClassChange={setActiveClass}
                        projectId={projectId}
                        onNextImage={() => handleImageIndexChange(Math.min(currentImageIndex + 1, stepImages.length - 1))}
                        onPrevImage={() => handleImageIndexChange(Math.max(currentImageIndex - 1, 0))}
                        currentImageIndex={currentImageIndex}
                        totalImages={stepImages.length}
                        brushSize={brushSize}
                        stepImages={stepImages}
                        onImageIndexChange={handleImageIndexChange}
                        onImageSaved={handleImageSaved}
                        onImageLoaded={handleInitialImageLoaded}
                    />
                </TabsContent>
                <TabsContent value="logic" className="h-full m-0">
                    <LogicBuilder
                        currentStep={effectiveStepConfig} // Used effective config
                        logicRules={logicRules}
                        onRulesUpdate={handleLogicRulesUpdate}
                        buildVariantConfig={currentStepConfig} // Passed build variant config
                    />
                </TabsContent>
                <TabsContent value="images" className="h-full m-0">
                    <ImagePortal
                        projectId={projectId}
                        currentStep={effectiveStepConfig} // Used effective config
                        stepImages={stepImages}
                        currentImageIndex={currentImageIndex}
                        onImageIndexChange={handleImageIndexChange}
                        onImagesUpdate={handleImagesUpdate}
                    />
                </TabsContent>
                <TabsContent value="insights" className="h-full m-0">
                    <AnnotationInsights
                        project={project}
                        steps={steps}
                        logicRules={logicRules}
                        stepImages={stepImages}
                    />
                </TabsContent>
            </div>
          {/* Right Sidebar - AI Chat & Copilot */}
          <AnimatePresence>
            {showCopilot && isCopilotAllowed && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 400, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-96 border-l border-gray-200 bg-white overflow-hidden flex flex-col"
              >
                <AnnotationChat
                  messages={chatMessages}
                  onSendMessage={handleChatMessage}
                  isAIThinking={isAIThinking}
                  currentStep={effectiveStepConfig} // Used effective config
                  onAnnotationModeChange={setAnnotationMode}
                  annotationMode={annotationMode}
                  brushSize={brushSize}
                  onBrushSizeChange={setBrushSize}
                />
              </motion.aside>
            )}
          </AnimatePresence>
        </main>
      </div>
    </Tabs>

    <Dialog open={showStepsPopup} onOpenChange={setShowStepsPopup}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Annotation Steps</DialogTitle>
          <DialogDescription>
            Select a step to view its details and begin annotating.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 max-h-[60vh] overflow-y-auto">
          <StepNavigation
            steps={steps}
            currentStepIndex={currentStepIndex}
            onStepSelect={handleStepSelectInPopup}
          />
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showClassImportPrompt} onOpenChange={setShowClassImportPrompt}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Import classes from annotations?</AlertDialogTitle>
          <AlertDialogDescription>
            This step has no classes configured, but annotations contain the following classes:
            {pendingClassNames.length ? ` ${pendingClassNames.join(", ")}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not now</AlertDialogCancel>
          <AlertDialogAction onClick={handleImportClasses}>
            Add classes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
