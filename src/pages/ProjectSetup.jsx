
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Project } from "@/api/entities";
import { SOPStep } from "@/api/entities";
import { UploadFile, ExtractDataFromUploadedFile, InvokeLLM } from "@/api/integrations";
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
  Loader2
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

import FileUploadZone from "../components/setup/FileUploadZone";
import StepsPreview from "../components/setup/StepsPreview";
import DatasetUpload from "../components/setup/DatasetUpload";

export default function ProjectSetupPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(1); // 1: upload, 2: generate, 3: review, 4: datasets
  const [error, setError] = useState(null);
  const [generatedSteps, setGeneratedSteps] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      setProjectId(id);
      loadProject(id);
    } else {
      navigate(createPageUrl('Projects'));
    }
  }, []);

  const loadProject = async (id) => {
    try {
      const [projectData, existingSteps] = await Promise.all([
        Project.filter({ id }),
        SOPStep.filter({ project_id: id }, 'step_number')
      ]);
      
      if (projectData.length > 0) {
        setProject(projectData[0]);
        if (existingSteps.length > 0) {
          setGeneratedSteps(existingSteps);
          setCurrentStep(4); // Go to dataset upload if steps exist
        } else if (projectData[0].sop_file_url) {
          setCurrentStep(projectData[0].steps_generated ? 3 : 2);
        }
      }
    } catch (error) {
      console.error("Error loading project:", error);
      setError("Failed to load project");
    }
    setIsLoading(false);
  };

  const handleFileUpload = async (file) => {
    setIsProcessing(true);
    setError(null);
    
    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(95, prev + 10));
      }, 200);

      const { file_url } = await UploadFile({ file });
      clearInterval(progressInterval);
      setUploadProgress(100);

      // Update project with SOP file
      await Project.update(projectId, {
        sop_file_url: file_url,
        status: "sop_uploaded"
      });

      // Reload project
      await loadProject(projectId);
      
      setTimeout(() => {
        setCurrentStep(2);
        setUploadProgress(0);
      }, 1000);

    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Failed to upload SOP file. Please try again.");
    }
    setIsProcessing(false);
  };

  const generateSteps = async () => {
    setIsProcessing(true);
    setError(null);
    setCurrentStep(2);
    
    try {
      // Simulate generation progress
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(90, prev + 5));
      }, 300);

      // Extract content and generate steps using LLM
      const prompt = `
        Analyze the uploaded SOP document and extract actionable steps for UI annotation. 
        For each step, identify:
        1. A clear title and description.
        2. The 'product': the general UI component type (e.g., button, form, menu, modal, input).
        3. The 'condition': the business logic that triggers this step.
        4. 'classes': An array of specific names or items to be annotated (e.g., ['Submit Button', 'Cancel Button']).
        5. The 'status': the logic result or label for the annotation (e.g., 'good', 'bad', 'error', 'warning').
        6. A 'clarity_score' from 0-10 indicating how clear and specific the step is for annotation.
        7. 'clarification_questions': Array of specific questions if the step needs clarification.
        
        Return a structured list of steps. Focus on user-facing UI elements.
        If any step is ambiguous or unclear (clarity_score < 7), generate specific questions to help clarify the annotation requirements.
      `;

      const result = await InvokeLLM({
        prompt,
        file_urls: [project.sop_file_url],
        response_json_schema: {
          type: "object",
          properties: {
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  product: { type: "string" },
                  condition: { type: "string" },
                  classes: {
                    type: "array",
                    items: { "type": "string" }
                  },
                  status: { type: "string" },
                  clarity_score: { type: "number" },
                  clarification_questions: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["title", "description", "product", "condition", "classes", "status", "clarity_score"]
              }
            }
          }
        }
      });

      clearInterval(progressInterval);
      setGenerationProgress(100);

      if (result.steps && result.steps.length > 0) {
        setGeneratedSteps(result.steps);
        
        // Save steps to database
        const stepsToCreate = result.steps.map((step, index) => ({
          project_id: projectId,
          step_number: index + 1,
          title: step.title,
          description: step.description,
          product: step.product,
          condition: step.condition,
          classes: step.classes,
          status: step.status,
          clarity_score: step.clarity_score,
          needs_clarification: step.clarity_score < 7,
          clarification_questions: step.clarification_questions || []
        }));

        await SOPStep.bulkCreate(stepsToCreate);
        
        // Update project status
        await Project.update(projectId, {
          status: "steps_generated",
          steps_generated: true
        });

        setTimeout(() => {
          setCurrentStep(3);
          setGenerationProgress(0);
        }, 1000);
      } else {
        throw new Error("No steps could be generated from the SOP");
      }

    } catch (error) {
      console.error("Error generating steps:", error);
      setError("Failed to generate steps from SOP. Please try again.");
    }
    setIsProcessing(false);
  };

  const handleUpdateSteps = (updatedSteps) => {
    setGeneratedSteps(updatedSteps);
  };

  const proceedToDatasets = () => {
    setCurrentStep(4);
  };

  const proceedToAnnotation = () => {
    navigate(createPageUrl(`AnnotationStudio?projectId=${projectId}`));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8">
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
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all duration-300 ${
                  currentStep > step 
                    ? 'bg-teal-600 border-teal-600 text-white' 
                    : currentStep === step 
                      ? 'bg-white border-teal-600 text-teal-600' 
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  {currentStep > step ? <CheckCircle className="w-5 h-5" /> : step}
                </div>
                {step < 4 && (
                  <div className={`h-0.5 w-16 md:w-24 mx-4 transition-all duration-300 ${
                    currentStep > step ? 'bg-teal-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Upload SOP</span>
            <span>Generate Steps</span>
            <span>Review Steps</span>
            <span>Upload Datasets</span>
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
                  <Upload className="w-6 h-6 text-teal-600" />
                  Upload Your SOP Document
                </CardTitle>
                <p className="text-gray-600">
                  Upload your Standard Operating Procedure document (PDF format)
                </p>
              </CardHeader>
              <CardContent>
                <FileUploadZone 
                  onFileUpload={handleFileUpload}
                  isUploading={isProcessing}
                  progress={uploadProgress}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Wand2 className="w-6 h-6 text-teal-600" />
                  Generate Annotation Steps
                </CardTitle>
                <p className="text-gray-600">
                  AI will analyze your SOP and create structured annotation steps
                </p>
              </CardHeader>
              <CardContent className="text-center py-12">
                {!isProcessing ? (
                  <div>
                    <div className="w-16 h-16 mx-auto mb-6 bg-teal-50 rounded-full flex items-center justify-center">
                      <FileText className="w-8 h-8 text-teal-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Ready to Generate Steps
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Your SOP has been uploaded successfully. Click below to generate annotation steps.
                    </p>
                    <Button 
                      onClick={generateSteps}
                      className="bg-teal-600 hover:bg-teal-700 shadow-lg"
                      size="lg"
                    >
                      <Wand2 className="w-5 h-5 mr-2" />
                      Generate Steps with AI
                    </Button>
                  </div>
                ) : (
                  <div>
                    <div className="w-16 h-16 mx-auto mb-6">
                      <Loader2 className="w-16 h-16 animate-spin text-teal-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      Generating Steps...
                    </h3>
                    <p className="text-gray-600 mb-6">
                      AI is analyzing your SOP and creating structured annotation steps
                    </p>
                    <Progress value={generationProgress} className="w-64 mx-auto" />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  Review Generated Steps
                </CardTitle>
                <p className="text-gray-600">
                  Review and edit the generated steps before proceeding to dataset upload
                </p>
              </CardHeader>
              <CardContent>
                <StepsPreview 
                  steps={generatedSteps}
                  onProceed={proceedToDatasets}
                  onUpdateSteps={handleUpdateSteps}
                />
              </CardContent>
            </Card>
          )}

          {currentStep === 4 && (
            <Card className="glass-effect border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Upload className="w-6 h-6 text-teal-600" />
                  Upload Training Datasets
                </CardTitle>
                <p className="text-gray-600">
                  Upload datasets for each annotation step to train your model
                </p>
              </CardHeader>
              <CardContent>
                <DatasetUpload 
                  projectId={projectId}
                  steps={generatedSteps}
                  onComplete={proceedToAnnotation}
                />
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
