
import { useState, useEffect, useCallback } from "react";
import { BuildVariant } from "@/api/entities";
import { StepVariantConfig } from "@/api/entities";
import { SOPStep } from "@/api/entities";
import { Project } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Settings,
  Edit3,
  Trash2,
  Package,
  Layers,
  CheckCircle,
  Circle,
  Search,
  Cpu,
  Target
} from "lucide-react";
import { motion } from "framer-motion";

import CreateVariantDialog from "../components/build-variants/CreateVariantDialog";
import EditVariantDialog from "../components/build-variants/EditVariantDialog";
import StepConfigDialog from "../components/build-variants/StepConfigDialog";

export default function BuildVariantsPage() {
  const [buildVariants, setBuildVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [allSteps, setAllSteps] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [stepConfigs, setStepConfigs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [configuringStep, setConfiguringStep] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [variants, steps, projects] = await Promise.all([
        BuildVariant.list(),
        SOPStep.list(),
        Project.list()
      ]);
      
      setBuildVariants(variants);
      setAllSteps(steps);
      setAllProjects(projects);
      
      if (variants.length > 0 && !selectedVariant) {
        setSelectedVariant(variants[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  }, [selectedVariant, setBuildVariants, setAllSteps, setAllProjects, setSelectedVariant, setIsLoading]);

  const loadStepConfigs = useCallback(async (variantId) => {
    try {
      const configs = await StepVariantConfig.filter({ build_variant_id: variantId });
      setStepConfigs(configs);
    } catch (error) {
      console.error("Error loading step configs:", error);
    }
  }, [setStepConfigs]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedVariant) {
      loadStepConfigs(selectedVariant.id);
    }
  }, [selectedVariant, loadStepConfigs]);

  const handleCreateVariant = async (variantData) => {
    await BuildVariant.create(variantData);
    await loadData();
    setShowCreateDialog(false);
  };

  const handleUpdateVariant = async (variantId, variantData) => {
    await BuildVariant.update(variantId, variantData);
    await loadData();
    setEditingVariant(null);
  };

  const handleDeleteVariant = async (variantId) => {
    if (!confirm("Are you sure you want to delete this build variant and all its configurations?")) return;
    
    try {
      // Delete all associated configs first
      const configs = await StepVariantConfig.filter({ build_variant_id: variantId });
      for (const config of configs) {
        await StepVariantConfig.delete(config.id);
      }
      
      // Then delete the variant
      await BuildVariant.delete(variantId);
      await loadData();
      
      if (selectedVariant?.id === variantId) {
        setSelectedVariant(buildVariants[0] || null);
      }
    } catch (error) {
      console.error("Error deleting variant:", error);
    }
  };

  const handleConfigureStep = async (configData) => {
    const existingConfig = stepConfigs.find(c => c.sop_step_id === configuringStep.id);
    
    if (existingConfig) {
      await StepVariantConfig.update(existingConfig.id, configData);
    } else {
      await StepVariantConfig.create({
        ...configData,
        build_variant_id: selectedVariant.id,
        sop_step_id: configuringStep.id
      });
    }
    
    await loadStepConfigs(selectedVariant.id);
    setConfiguringStep(null);
  };

  const handleDeleteConfig = async (stepId) => {
    const config = stepConfigs.find(c => c.sop_step_id === stepId);
    if (config) {
      await StepVariantConfig.delete(config.id);
      await loadStepConfigs(selectedVariant.id);
    }
  };

  const getStepProject = (stepId) => {
    const step = allSteps.find(s => s.id === stepId);
    return allProjects.find(p => p.id === step?.project_id);
  };

  const getFilteredSteps = () => {
    let filtered = allSteps;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(step => 
        step.title.toLowerCase().includes(query) ||
        step.description?.toLowerCase().includes(query)
      );
    }

    if (projectFilter !== "all") {
      filtered = filtered.filter(step => step.project_id === projectFilter);
    }

    return filtered;
  };

  const getStepConfig = (stepId) => {
    return stepConfigs.find(c => c.sop_step_id === stepId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-12 h-12 mx-auto mb-4 animate-pulse text-blue-600" />
          <p className="text-gray-600">Loading build variants...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 h-full overflow-hidden">
      <div className="max-w-7xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Build Variant Configurator</h1>
            <p className="text-gray-600">
              Customize annotation settings for different product variants
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Build Variant
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Left Panel - Build Variants List */}
          <Card className="w-1/3 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Build Variants ({buildVariants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {buildVariants.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">No build variants yet</p>
                  <Button onClick={() => setShowCreateDialog(true)} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Variant
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {buildVariants.map((variant) => (
                    <motion.div
                      key={variant.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedVariant?.id === variant.id
                          ? "bg-blue-50 border-blue-200 shadow-sm"
                          : "hover:bg-gray-50 border-gray-200"
                      }`}
                      onClick={() => setSelectedVariant(variant)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">
                            {variant.name}
                          </h4>
                          {variant.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {variant.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              {stepConfigs.filter(c => c.build_variant_id === variant.id).length} configs
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingVariant(variant);
                            }}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVariant(variant.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right Panel - Step Configuration */}
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Step Configuration Overrides
                {selectedVariant && (
                  <span className="text-sm font-normal text-blue-600">
                    for &quot;{selectedVariant.name}&quot;
                  </span>
                )}
              </CardTitle>
              
              {selectedVariant && (
                <div className="flex gap-4 mt-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search steps..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={projectFilter} onValueChange={setProjectFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {allProjects.map(project => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {!selectedVariant ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Layers className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">Select a build variant to configure steps</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {getFilteredSteps().map((step) => {
                    const project = getStepProject(step.id);
                    const config = getStepConfig(step.id);
                    
                    return (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border transition-all ${
                          config ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {config ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <Circle className="w-4 h-4 text-gray-400" />
                              )}
                              <h4 className="font-medium text-gray-900">
                                Step {step.step_number}: {step.title}
                              </h4>
                              <Badge variant="outline" className="text-xs">
                                {project?.name || "Unknown Project"}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              {step.description || "No description"}
                            </p>
                            
                            <div className="flex flex-wrap gap-2">
                              <Badge className="bg-blue-100 text-blue-800 text-xs">
                                Default Classes: {(step.classes || []).join(", ") || "None"}
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-800 text-xs">
                                Default Status: {step.status || "Pass,Fail"}
                              </Badge>
                            </div>

                            {config && (
                              <div className="mt-3 p-3 bg-white rounded border">
                                <h5 className="font-medium text-sm text-green-800 mb-2">Active Overrides:</h5>
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {config.active_classes?.length > 0 && (
                                    <Badge className="bg-green-100 text-green-800">
                                      Classes: {config.active_classes.join(", ")}
                                    </Badge>
                                  )}
                                  {config.status_options && (
                                    <Badge className="bg-green-100 text-green-800">
                                      Status: {config.status_options}
                                    </Badge>
                                  )}
                                  {config.active_logic_rule_ids?.length > 0 && (
                                    <Badge className="bg-green-100 text-green-800">
                                      Logic Rules: {config.active_logic_rule_ids.length}
                                    </Badge>
                                  )}
                                  {config.inference_model_id && (
                                    <Badge className="bg-green-100 text-green-800">
                                      <Cpu className="w-3 h-3 mr-1" />
                                      AI Model
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant={config ? "default" : "outline"}
                              size="sm"
                              onClick={() => setConfiguringStep(step)}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              {config ? "Edit Config" : "Add Config"}
                            </Button>
                            {config && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteConfig(step.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {getFilteredSteps().length === 0 && (
                    <div className="text-center py-8">
                      <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-600">No steps match your search criteria</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Dialogs */}
        <CreateVariantDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreateVariant={handleCreateVariant}
        />

        <EditVariantDialog
          open={!!editingVariant}
          variant={editingVariant}
          onOpenChange={(open) => !open && setEditingVariant(null)}
          onUpdateVariant={handleUpdateVariant}
        />

        <StepConfigDialog
          open={!!configuringStep}
          step={configuringStep}
          variant={selectedVariant}
          existingConfig={configuringStep ? getStepConfig(configuringStep.id) : null}
          onOpenChange={(open) => !open && setConfiguringStep(null)}
          onSaveConfig={handleConfigureStep}
        />
      </div>
    </div>
  );
}
