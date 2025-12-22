import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { uploadToSupabaseStorage } from "@/api/storage";
import { generateStepsFromSOP } from "@/api/llm";
import { getProjectById, listStepsByProject, bulkCreateSteps, updateProject } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Upload,
  FileText,
  Wand2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Search,
  Brain,
  Lightbulb,
  Users,
  Zap,
  Sparkles,
  PlusCircle,
  Edit3
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import FileUploadZone from "../components/setup/FileUploadZone";

export default function ProjectSetupPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [setupChoice, setSetupChoice] = useState(null); // 'ai' or 'manual'
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);

  // Add new state for live log
  const [generationLogs, setGenerationLogs] = useState([]);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    }
  }, [generationLogs]);

  const loadProject = useCallback(async (id) => {
    try {
      const [projectData, existingSteps] = await Promise.all([
        getProjectById(id),
        listStepsByProject(id)
      ]);

      if (projectData) {
        setProject(projectData);
        // If steps are already generated or exist, navigate to StepManagement
        if (existingSteps.length > 0 || projectData.steps_generated) {
          navigate(createPageUrl(`StepManagement?projectId=${id}`));
          return;
        } else if (projectData.sop_file_url) {
          setSetupChoice('ai');
          setCurrentStep(3); // Go straight to generation
        }
      }
    } catch (error) {
      console.error("Error loading project:", error);
      setError("Failed to load project");
    }
    setIsLoading(false);
  }, [navigate]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setProjectId(id);
      loadProject(id);
    } else {
      navigate(createPageUrl('Projects'));
    }
  }, [loadProject, navigate]);

  const handleSetupChoice = (choice) => {
    setSetupChoice(choice);
    if (choice === 'manual') {
      // Go directly to Step Management for manual creation
      skipToManualCreation();
    } else {
      // Go to SOP upload
      setCurrentStep(2);
    }
  };

  const handleFileUpload = async (file) => {
    setIsUploading(true);
    setError(null);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(95, prev + 10));
      }, 200);

      const uploadPath = `${projectId}/${Date.now()}-${file.name}`;
      const { publicUrl } = await uploadToSupabaseStorage(file, uploadPath, "sops");
      clearInterval(progressInterval);
      setUploadProgress(100);

      await updateProject(projectId, {
        sop_file_url: publicUrl,
        status: "sop_uploaded"
      });

      setProject(prev => ({ ...prev, sop_file_url: publicUrl, status: "sop_uploaded" }));

      setTimeout(() => {
        setCurrentStep(3);
        setUploadProgress(0);
      }, 1000);

    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload SOP file. Please try again.");
    }
    setIsUploading(false);
  };

  const generateSteps = async () => {
    setIsGeneratingSteps(true);
    setError(null);
    setCurrentStep(3);
    setGenerationLogs([]);

    const logMessages = [
      { icon: "FileText", message: "Opening SOP document...", type: "info", duration: 800 },
      { icon: "Eye", message: "Reading through the document structure...", type: "processing", duration: 1000 },
      { icon: "Search", message: "Scanning for procedural steps...", type: "processing", duration: 1000 },
      { icon: "Brain", message: "Thinking about annotation steps...", type: "thinking", duration: 800 },
      { icon: "Sparkles", message: "Asking GPT to draft steps...", type: "generation", duration: 800 }
    ];

    try {
      const logPromise = (async () => {
        for (let i = 0; i < logMessages.length; i++) {
          const message = logMessages[i];
          setGenerationLogs(prev => [...prev, { ...message, id: Date.now() + i, timestamp: new Date() }]);
          setGenerationProgress(Math.min(90, (i + 1) / logMessages.length * 70));
          await new Promise(resolve => setTimeout(resolve, message.duration));
        }
        setGenerationProgress(90);
      })();

      const prompt = `
        You are an expert in computer vision and object detection annotation. Analyze this SOP and extract annotation steps.
        For each step, return: title, description, product ("object_detection"), condition ("Present, Absent" if unsure),
        classes (array of strings), status (e.g., "Pass, Fail"), clarity_score (0-10), business_logic (string).
        Keep steps concise and actionable. Return JSON only.
      `;

      const steps = await generateStepsFromSOP({
        sopUrl: project.sop_file_url,
        prompt,
        temperature: 0.2
      });

      await logPromise;

      setGenerationLogs(prev => [...prev, {
        icon: "CheckCircle",
        message: "Step generation complete! Redirecting to Step Management...",
        type: "success",
        id: Date.now() + 999,
        timestamp: new Date()
      }]);

      setGenerationProgress(100);

      if (steps && steps.length > 0) {
        const stepsToCreate = steps.map((step, index) => ({
          project_id: projectId,
          step_number: index + 1,
          title: step.title || `Step ${index + 1}`,
          description: step.description || "",
          product: step.product || "object_detection",
          condition: step.condition || "Present, Absent",
          classes: Array.isArray(step.classes) ? step.classes : [],
          status: step.status || "Pass, Fail",
          clarity_score: step.clarity_score ?? 8,
          needs_clarification: (step.clarity_score ?? 8) < 7,
          business_logic: step.business_logic || "",
          is_enabled: true,
          is_annotated: false,
          clarification_questions: [],
        }));

        await bulkCreateSteps(stepsToCreate);

        await updateProject(projectId, {
          status: "steps_generated",
          steps_generated: true
        });

        setTimeout(() => {
          navigate(createPageUrl(`StepManagement?projectId=${projectId}`));
        }, 1500);

      } else {
        throw new Error("No steps could be generated from the SOP");
      }

    } catch (error) {
      console.error("Error generating steps:", error);
      setError(error.message || "Failed to generate steps from SOP. Please try again.");
      setGenerationLogs(prev => [...prev, {
        icon: "AlertCircle",
        message: "Generation failed. Please try again.",
        type: "error",
        id: Date.now() + 1000,
        timestamp: new Date()
      }]);
    }
    setIsGeneratingSteps(false);
  };


  // Function to skip to manual step creation
  const skipToManualCreation = async () => {
    try {
      await updateProject(projectId, {
        status: "steps_generated",
        steps_generated: true
      });

      navigate(createPageUrl(`StepManagement?projectId=${projectId}`));
    } catch (error) {
      console.error("Error updating project status:", error);
      setError("Failed to proceed to manual step creation.");
    }
  };

  // Helper function to get icon component
  const getLogIcon = (iconName) => {
    const icons = {
      FileText, Eye, Search, Brain, Lightbulb, Users, Zap, Sparkles, CheckCircle, AlertCircle
    };
    const IconComponent = icons[iconName];
    return IconComponent || FileText;
  };

  const getTypeColor = (type) => {
    const colors = {
      info: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      thinking: "bg-amber-100 text-amber-800",
      discovery: "bg-green-100 text-green-800",
      expert: "bg-indigo-100 text-indigo-800",
      analysis: "bg-pink-100 text-pink-800",
      generation: "bg-teal-100 text-teal-800",
      validation: "bg-orange-100 text-orange-800",
      completion: "bg-gray-100 text-gray-800",
      success: "bg-emerald-100 text-emerald-800",
      error: "bg-red-100 text-red-800"
    };
    return colors[type] || colors.info;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl('Projects'))}
            className="glass-effect border-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {project?.name} Setup
            </h1>
            <p className="text-gray-600">Configure your annotation project</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all duration-300 ${
                  currentStep > step
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : currentStep === step
                      ? 'bg-white border-blue-600 text-blue-600'
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {step < 3 && (
                  <div className={`h-0.5 w-24 md:w-32 mx-4 transition-all duration-300 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Choose Method</span>
            <span>Upload SOP</span>
            <span>Generate Steps</span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentStep === 1 && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wand2 className="w-6 h-6 text-blue-600" />
                  How would you like to create your annotation steps?
                </CardTitle>
                <p className="text-gray-600">
                  Choose your preferred method to set up your annotation workflow
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* AI Generation Option */}
                  <div 
                    className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col ${
                      setupChoice === 'ai' ? 'border-blue-400 shadow-lg' : 'border-blue-200'
                    }`}
                    onClick={() => handleSetupChoice('ai')}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Wand2 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          AI-Powered Generation
                        </h3>
                        <p className="text-gray-600 mb-4 text-sm">
                          Upload your SOP document and let our AI analyze it to automatically generate structured annotation steps.
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge className="bg-blue-100 text-blue-800 border-0">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Intelligent Analysis
                          </Badge>
                          <Badge className="bg-green-100 text-green-800 border-0">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Quick Setup
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <FileText className="w-4 h-4" />
                          <span>Requires SOP PDF document</span>
                        </div>
                    </div>
                  </div>

                  {/* Manual Creation Option */}
                  <div 
                    className={`bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border-2 cursor-pointer transition-all duration-300 hover:shadow-lg flex flex-col ${
                      setupChoice === 'manual' ? 'border-gray-400 shadow-lg' : 'border-gray-200'
                    }`}
                    onClick={() => handleSetupChoice('manual')}
                  >
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-12 h-12 bg-gray-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Edit3 className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          Manual Step Creation
                        </h3>
                        <p className="text-gray-600 mb-4 text-sm">
                          Create annotation steps from scratch. This gives you complete control over your annotation workflow.
                        </p>
                      </div>
                    </div>
                     <div className="mt-auto">
                        <div className="flex flex-wrap gap-2 mb-4">
                          <Badge className="bg-gray-100 text-gray-800 border-0">
                            <PlusCircle className="w-3 h-3 mr-1" />
                            Full Control
                          </Badge>
                          <Badge className="bg-amber-100 text-amber-800 border-0">
                            <Edit3 className="w-3 h-3 mr-1" />
                            Custom Workflow
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <PlusCircle className="w-4 h-4" />
                          <span>No document required</span>
                        </div>
                    </div>
                  </div>
                </div>

                  {/* Info Box */}
                  <div className="mt-6 bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-blue-800 font-medium mb-1">
                          Pro Tip
                        </p>
                        <p className="text-sm text-blue-700">
                          You can always edit, add, or remove steps later in the Step Management interface, 
                          regardless of which method you choose now.
                        </p>
                      </div>
                    </div>
                  </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && setupChoice === 'ai' && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Upload className="w-6 h-6 text-blue-600" />
                  Upload Your SOP Document
                </CardTitle>
                <p className="text-gray-600">
                  Upload your Standard Operating Procedure document (PDF format)
                </p>
              </CardHeader>
              <CardContent>
                <FileUploadZone
                  onFileUpload={handleFileUpload}
                  isUploading={isUploading}
                  progress={uploadProgress}
                />
                
                {/* Back button */}
                <div className="mt-6 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentStep(1);
                      setSetupChoice(null);
                    }}
                    className="text-gray-600"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Method Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && setupChoice === 'ai' && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wand2 className="w-6 h-6 text-blue-600" />
                  Generating Annotation Steps
                </CardTitle>
                <p className="text-gray-600">
                  AI is analyzing your SOP and creating structured annotation steps
                </p>
              </CardHeader>
              <CardContent>
                {!isGeneratingSteps ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Ready to Generate Steps
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Your SOP document has been uploaded successfully. Click below to start the AI analysis.
                    </p>
                    <Button
                      onClick={generateSteps}
                      className="bg-blue-600 hover:bg-blue-700 shadow-lg"
                      size="lg"
                    >
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Steps with AI
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    {/* Header */}
                    <div className="text-center">
                      <div className="w-16 h-16 mx-auto mb-4">
                        <Loader2 className="w-16 h-16 animate-spin text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">
                        Generating Steps...
                      </h3>
                      <p className="text-gray-600 mb-4">
                        AI is analyzing your SOP and creating structured annotation steps
                      </p>
                      <Progress value={generationProgress} className="w-64 mx-auto mb-6" />
                    </div>

                    {/* Live Log */}
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-blue-600 animate-pulse" />
                        <h4 className="font-semibold text-gray-900">AI Generation Log</h4>
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 animate-pulse">
                          Processing...
                        </Badge>
                      </div>

                      <div className="h-48 overflow-y-auto pr-2 space-y-3">
                        {generationLogs.map((log) => {
                          const LogIcon = getLogIcon(log.icon);
                          return (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.3 }}
                              className="flex items-start gap-3"
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                log.type === 'success' ? 'bg-emerald-100' : log.type === 'error' ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                <LogIcon className={`w-4 h-4 ${
                                  log.type === 'success' ? 'text-emerald-600' : log.type === 'error' ? 'text-red-600' : 'text-gray-600'
                                }`} />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={`${getTypeColor(log.type)} border-0 text-xs`}>
                                    {log.type}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    {log.timestamp.toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">
                                  {log.message}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Active indicator */}
                        {isGeneratingSteps && generationProgress < 100 && (
                          <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                              <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                            </div>
                            <span className="text-sm text-blue-700 font-medium">
                              AI is working...
                            </span>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
