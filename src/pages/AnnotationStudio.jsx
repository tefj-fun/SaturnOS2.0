
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Project } from "@/api/entities";
import { SOPStep } from "@/api/entities";
import { LogicRule } from "@/api/entities";
import { StepImage } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layers3
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import { InvokeLLM } from "@/api/integrations"; 

import AnnotationCanvas from "../components/annotation/AnnotationCanvas";
import StepNavigation from "../components/annotation/StepNavigation";
import AnnotationChat from "../components/annotation/AnnotationChat";
import LogicBuilder from "../components/annotation/LogicBuilder";
import ImagePortal from "../components/annotation/ImagePortal";

export default function AnnotationStudioPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [steps, setSteps] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCopilot, setShowCopilot] = useState(true);
  const [activeTab, setActiveTab] = useState('canvas');
  const [annotationMode, setAnnotationMode] = useState('draw');
  const [activeClass, setActiveClass] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [logicRules, setLogicRules] = useState([]);
  const [stepImages, setStepImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('projectId');
    if (id) {
      setProjectId(id);
      loadProjectData(id);
    } else {
      navigate(createPageUrl('Projects'));
    }
  }, []);

  useEffect(() => {
    if (currentStep) {
      initializeAIGuidance();
      loadLogicRules();
      loadStepImages();
      // Set the active class when the current step changes
      if (currentStep.classes && currentStep.classes.length > 0) {
        setActiveClass(currentStep.classes[0]);
      } else {
        setActiveClass(null);
      }
    }
  }, [currentStepIndex, steps]);

  const loadProjectData = async (id) => {
    try {
      const [projectData, stepsData] = await Promise.all([
        Project.filter({ id }),
        SOPStep.filter({ project_id: id }, 'step_number')
      ]);
      
      if (projectData.length > 0) {
        setProject(projectData[0]);
        setSteps(stepsData);
        
        const firstIncompleteIndex = stepsData.findIndex(step => !step.is_annotated);
        if (firstIncompleteIndex !== -1) {
          setCurrentStepIndex(firstIncompleteIndex);
        }
      }
    } catch (error) {
      console.error("Error loading project data:", error);
    }
    setIsLoading(false);
  };

  const loadLogicRules = async () => {
    if (!currentStep) return;
    try {
      const rules = await LogicRule.filter({ step_id: currentStep.id }, 'priority');
      setLogicRules(rules);
    } catch (error) {
      console.error("Error loading logic rules:", error);
    }
  };

  const loadStepImages = async () => {
    if (!currentStep) return;
    try {
      const images = await StepImage.filter({ step_id: currentStep.id }, '-created_date');
      setStepImages(images);
      setCurrentImageIndex(0);
    } catch (error) {
      console.error("Error loading step images:", error);
    }
  };

  const initializeAIGuidance = async () => {
    if (!currentStep || !currentStep.classes) return;
    
    setIsAIThinking(true);
    try {
      const guidancePrompt = `
        You are an annotation assistant.
        The user is on step: "${currentStep.title}".
        Your goal is to help them annotate one of the following classes: ${currentStep.classes.join(', ')}.
        
        Generate a very short, friendly, and direct instruction, like "Please draw a box around the [class name] on the image."
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
  };

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
      const contextPrompt = `
        You are a helpful but very concise annotation assistant.
        The user is working on step "${currentStep.title}" and is asking for help with the class "${activeClass}".
        
        Here is their question: "${message}"
        
        Provide a very short, direct, and helpful tip. Maximum 2 sentences.
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

  const handleStepComplete = async (stepId, annotationData) => {
    try {
      await SOPStep.update(stepId, {
        is_annotated: true,
        annotation_data: annotationData
      });
      
      const updatedSteps = await SOPStep.filter({ project_id: projectId }, 'step_number');
      setSteps(updatedSteps);
      
      const allComplete = updatedSteps.every(step => step.is_annotated);
      if (allComplete) {
        await Project.update(projectId, { status: "completed" });
        
        const completionMessage = {
          id: Date.now(),
          type: 'ai',
          content: "🎉 Excellent work! You've completed this annotation step. Let's move on to the next one!",
          timestamp: new Date()
        };
        setChatMessages(prev => [...prev, completionMessage]);
      } else {
        await Project.update(projectId, { status: "annotation_in_progress" });
      }
      
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      }
    } catch (error) {
      console.error("Error completing step:", error);
    }
  };

  const handleLogicRulesUpdate = async (updatedRules) => {
    setLogicRules(updatedRules);
    await loadLogicRules();
  };

  const handleImagesUpdate = async () => {
    await loadStepImages();
  };

  const getProgress = () => {
    if (steps.length === 0) return 0;
    const completedSteps = steps.filter(step => step.is_annotated).length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  const currentStep = steps[currentStepIndex];
  const currentImage = stepImages[currentImageIndex];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 animate-spin">
            <Target className="w-12 h-12 text-teal-600" />
          </div>
          <p className="text-gray-600">Loading annotation studio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
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
                <p className="text-sm text-gray-600">
                  Step {currentStepIndex + 1} of {steps.length}
                </p>
                <Progress value={getProgress()} className="w-32 h-2" />
                <span className="text-sm font-medium text-gray-700">
                  {getProgress()}%
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant={showCopilot ? "default" : "outline"}
              onClick={() => setShowCopilot(!showCopilot)}
              className={showCopilot ? "bg-teal-600 hover:bg-teal-700" : ""}
            >
              <Bot className="w-4 h-4 mr-2" />
              AI Copilot
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Left Sidebar - Steps */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 mb-4">Annotation Steps</h2>
            <StepNavigation
              steps={steps}
              currentStepIndex={currentStepIndex}
              onStepSelect={setCurrentStepIndex}
            />
          </div>
          
          {currentStep && (
            <div className="p-6 flex-1 overflow-y-auto">
              <Card className="glass-effect border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Current Step</CardTitle>
                    <Badge className={`${
                      currentStep.is_annotated 
                        ? "bg-green-100 text-green-800" 
                        : "bg-orange-100 text-orange-800"
                    } border-0`}>
                      {currentStep.is_annotated ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </>
                      ) : (
                        <>
                          <Circle className="w-3 h-3 mr-1" />
                          Pending
                        </>
                      )}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {currentStep.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-3">
                      {currentStep.description}
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">PRODUCT:</span>
                      <Badge variant="outline" className="text-xs">
                        {currentStep.product}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">CONDITION:</span>
                      <p className="text-sm text-gray-600 mt-1">{currentStep.condition}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-gray-500">CLASSES:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(currentStep.classes || []).map(cls => (
                           <code key={cls} className="text-sm bg-gray-100 px-2 py-1 rounded">
                             {cls}
                           </code>
                        ))}
                      </div>
                    </div>
                     <div>
                      <span className="text-xs font-medium text-gray-500">STATUS:</span>
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded ml-2">
                        {currentStep.status}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex">
          <div className="flex-1 relative bg-white">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="px-6 pt-4 border-b border-gray-200">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
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
                </TabsList>
              </div>
              
              <div className="flex-1">
                <TabsContent value="canvas" className="h-full m-0">
                  <AnnotationCanvas
                    currentStep={currentStep}
                    currentImage={currentImage}
                    annotationMode={annotationMode}
                    activeClass={activeClass}
                    onStepComplete={handleStepComplete}
                    projectId={projectId}
                  />
                </TabsContent>
                
                <TabsContent value="logic" className="h-full m-0">
                  <LogicBuilder
                    currentStep={currentStep}
                    logicRules={logicRules}
                    onRulesUpdate={handleLogicRulesUpdate}
                  />
                </TabsContent>
                
                <TabsContent value="images" className="h-full m-0">
                  <ImagePortal
                    currentStep={currentStep}
                    stepImages={stepImages}
                    currentImageIndex={currentImageIndex}
                    onImageIndexChange={setCurrentImageIndex}
                    onImagesUpdate={handleImagesUpdate}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>

          {/* Right Sidebar - AI Chat & Copilot */}
          {showCopilot && (
            <motion.div
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
                currentStep={currentStep}
                onAnnotationModeChange={setAnnotationMode}
                annotationMode={annotationMode}
                activeClass={activeClass}
                onActiveClassChange={setActiveClass}
              />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
