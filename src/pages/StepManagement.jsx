
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Project } from "@/api/entities";
import { SOPStep } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  GripVertical,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Layers,
  Target,
  PenTool
} from "lucide-react";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function StepManagementPage() {
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [steps, setSteps] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingStepId, setEditingStepId] = useState(null);
  const [editedStep, setEditedStep] = useState(null);
  const [showAddStep, setShowAddStep] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState(-1); // New: for smart insertion
  const [selectedSteps, setSelectedSteps] = useState(new Set()); // New: for multi-select
  const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false); // New: bulk delete confirmation
  const [newStep, setNewStep] = useState({
    title: "",
    description: "",
    product: "button",
    condition: "",
    classes: [],
    status: "Pass,Fail",
    clarity_score: 8,
    needs_clarification: false,
    is_enabled: true
  });

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

  const loadProjectData = async (id) => {
    try {
      const [projectData, stepsData] = await Promise.all([
        Project.filter({ id }),
        SOPStep.filter({ project_id: id }, 'step_number')
      ]);
      
      if (projectData.length > 0) {
        setProject(projectData[0]);
        setSteps(stepsData);
      }
    } catch (error) {
      console.error("Error loading project data:", error);
    }
    setIsLoading(false);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    if (editingStepId) {
      // Prevent drag if a step is currently being edited
      return;
    }

    const items = Array.from(steps);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update step numbers
    const updatedSteps = items.map((step, index) => ({
      ...step,
      step_number: index + 1
    }));

    setSteps(updatedSteps);

    // Save the new order to the database
    try {
      // Update all step numbers in sequence
      for (const step of updatedSteps) {
        await SOPStep.update(step.id, { step_number: step.step_number });
      }
    } catch (error) {
      console.error("Error updating step order:", error);
      // Reload on error to restore correct order
      loadProjectData(projectId);
    }
  };

  const handleToggleEnabled = async (stepId, isEnabled) => {
    try {
      await SOPStep.update(stepId, { is_enabled: isEnabled });
      setSteps(prev => prev.map(step => 
        step.id === stepId ? { ...step, is_enabled: isEnabled } : step
      ));
    } catch (error) {
      console.error("Error toggling step:", error);
    }
  };

  // New: Multi-select functions
  const handleSelectStep = (stepId, checked) => {
    const newSelected = new Set(selectedSteps);
    if (checked) {
      newSelected.add(stepId);
    } else {
      newSelected.delete(stepId);
    }
    setSelectedSteps(newSelected);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      const allIds = new Set(steps.map(s => s.id));
      setSelectedSteps(allIds);
    } else {
      setSelectedSteps(new Set());
    }
  };

  const handleBulkDelete = async () => {
    try {
      const stepsToDelete = Array.from(selectedSteps);
      
      // Delete selected steps
      for (const stepId of stepsToDelete) {
        await SOPStep.delete(stepId);
      }
      
      // Reload and renumber remaining steps
      await loadProjectData(projectId);
      setSelectedSteps(new Set());
      setShowBulkDeleteAlert(false);
    } catch (error) {
      console.error("Error bulk deleting steps:", error);
      setShowBulkDeleteAlert(false);
    }
  };

  // New: Smart insertion function
  const handleAddStepAfter = (index) => {
    setShowAddStep(true);
    setInsertAfterIndex(index);
    // Reset newStep form when showing it
    setNewStep({
      title: "",
      description: "",
      product: "button",
      condition: "",
      classes: [],
      status: "Pass,Fail",
      clarity_score: 8,
      needs_clarification: false,
      is_enabled: true
    });
  };

  const startEditing = (step) => {
    setEditingStepId(step.id);
    setEditedStep({
      ...step,
      classes: Array.isArray(step.classes) ? step.classes : []
    });
  };

  const cancelEditing = () => {
    setEditingStepId(null);
    setEditedStep(null);
  };

  const saveEdit = async () => {
    if (!editedStep) return;

    try {
      // Create a clean version of the step data before saving
      const stepToSave = {
        ...editedStep,
        classes: (editedStep.classes || []).filter(Boolean), // Filter out empty strings
      };

      await SOPStep.update(stepToSave.id, stepToSave);
      
      // Update the main steps list with the cleaned data
      setSteps(prev => prev.map(step => 
        step.id === stepToSave.id ? stepToSave : step
      ));
      
      setEditingStepId(null);
      setEditedStep(null);
    } catch (error) {
      console.error("Error updating step:", error);
    }
  };

  const handleEditChange = (field, value) => {
    if (field === 'classes') {
      // Allow trailing commas during editing by not filtering empty strings here
      setEditedStep(prev => ({ 
        ...prev, 
        [field]: value.split(',').map(s => s.trim()) 
      }));
    } else if (field === 'clarity_score') {
      const score = parseFloat(value);
      setEditedStep(prev => ({ 
        ...prev, 
        [field]: score,
        needs_clarification: score < 7
      }));
    } else {
      setEditedStep(prev => ({ ...prev, [field]: value }));
    }
  };

  const addNewStep = async () => {
    try {
      // Determine the step_number for the new step
      let newStepNumber;
      if (insertAfterIndex === -1) {
        // Add at the very end
        newStepNumber = steps.length + 1;
      } else {
        // Insert after the step at `insertAfterIndex`
        newStepNumber = steps[insertAfterIndex].step_number + 1;
        
        // Atomically update step numbers for all steps that come after the insertion point
        // This should ideally be a single transaction on the backend for robustness.
        // For now, we'll iterate and update, then reload.
        const stepsToRenumber = steps.filter(step => step.step_number >= newStepNumber);
        for (const step of stepsToRenumber) {
          await SOPStep.update(step.id, { step_number: step.step_number + 1 });
        }
      }
      
      const stepData = {
        ...newStep,
        classes: (newStep.classes || []).filter(Boolean), // Filter out empty strings on save
        project_id: projectId,
        step_number: newStepNumber
      };
      
      await SOPStep.create(stepData);
      
      // Reload all project data to ensure correct order and step numbers are reflected
      await loadProjectData(projectId);
      
      setShowAddStep(false);
      setInsertAfterIndex(-1); // Reset insertion index
      setNewStep({ // Reset new step form
        title: "",
        description: "",
        product: "button",
        condition: "",
        classes: [],
        status: "Pass,Fail",
        clarity_score: 8,
        needs_clarification: false,
        is_enabled: true
      });
    } catch (error) {
      console.error("Error adding step:", error);
    }
  };

  const deleteStep = async (stepId) => {
    if (!confirm("Are you sure you want to delete this step?")) return;

    try {
      await SOPStep.delete(stepId);
      await loadProjectData(projectId); // Reload to re-number subsequent steps
    } catch (error) {
      console.error("Error deleting step:", error);
    }
  };

  const markAsClarified = async (stepId) => {
    try {
      await SOPStep.update(stepId, {
        needs_clarification: false,
        clarity_score: Math.max(8, steps.find(s => s.id === stepId)?.clarity_score || 0),
        clarification_questions: []
      });
      loadProjectData(projectId);
    } catch (error) {
      console.error("Error marking step as clarified:", error);
    }
  };

  const getProductColor = useCallback((product) => {
    const colors = {
      button: "bg-blue-100 text-blue-800",
      form: "bg-green-100 text-green-800",
      menu: "bg-purple-100 text-purple-800",
      modal: "bg-pink-100 text-pink-800",
      input: "bg-amber-100 text-amber-800"
    };
    return colors[product] || colors.button;
  }, []);

  const getStatusColor = useCallback((status) => {
    const colors = {
      good: "bg-green-100 text-green-800",
      bad: "bg-red-100 text-red-800",
      neutral: "bg-gray-100 text-gray-800",
      error: "bg-red-100 text-red-800",
      warning: "bg-amber-100 text-amber-800",
      info: "bg-blue-100 text-blue-800",
      other: "bg-gray-100 text-gray-800"
    };
    // If the status contains commas, try to map the first one or default
    const firstStatus = status.split(',')[0]?.trim().toLowerCase();
    return colors[firstStatus] || colors.neutral;
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Layers className="w-12 h-12 mx-auto mb-4 animate-pulse text-blue-600" />
          <p className="text-gray-600">Loading step management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto">
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
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              Step Management
            </h1>
            <p className="text-gray-600">
              {project?.name} - Review, edit, and manage your annotation steps
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => handleAddStepAfter(-1)} // Add at end
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
            <Button
              onClick={() => navigate(createPageUrl(`AnnotationStudio?projectId=${projectId}`))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Start Annotation
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-effect border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Layers className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Total Steps</p>
                  <p className="text-2xl font-bold text-gray-900">{steps.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Eye className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">Enabled</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {steps.filter(s => s.is_enabled !== false).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Annotated</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {steps.filter(s => s.is_annotated).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-effect border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
                <div>
                  <p className="text-sm text-gray-600">Need Clarification</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {steps.filter(s => s.needs_clarification).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Multi-select Controls */}
        {steps.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={steps.length > 0 && selectedSteps.size === steps.length}
                  onCheckedChange={handleSelectAll}
                  disabled={editingStepId !== null} // Disable if editing
                />
                <span className="text-sm text-gray-600">Select All Steps</span>
                {selectedSteps.size > 0 && (
                  <Badge variant="secondary">
                    {selectedSteps.size} selected
                  </Badge>
                )}
              </div>
              
              {selectedSteps.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSteps(new Set())}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowBulkDeleteAlert(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedSteps.size})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Alert */}
        {showBulkDeleteAlert && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Are you sure you want to delete {selectedSteps.size} selected step(s)? 
                This action cannot be undone.
              </span>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                >
                  Delete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDeleteAlert(false)}
                >
                  Cancel
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Add New Step */}
        {showAddStep && (
          <Card className="mb-6 border-2 border-dashed border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-blue-800">
                  {insertAfterIndex === -1 
                    ? "Add New Step at End" 
                    : `Insert Step After Step ${steps[insertAfterIndex].step_number}`
                  }
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addNewStep} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-3 h-3 mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setShowAddStep(false);
                    setInsertAfterIndex(-1);
                  }}>
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Title</label>
                  <Input
                    value={newStep.title}
                    onChange={(e) => setNewStep(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter step title"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Product</label>
                  <Select value={newStep.product} onValueChange={(value) => setNewStep(prev => ({ ...prev, product: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="button">Button</SelectItem>
                      <SelectItem value="form">Form</SelectItem>
                      <SelectItem value="menu">Menu</SelectItem>
                      <SelectItem value="modal">Modal</SelectItem>
                      <SelectItem value="input">Input</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Classes (comma-separated)</label>
                  <Input
                    value={(newStep.classes || []).join(', ')}
                    onChange={(e) => setNewStep(prev => ({ 
                      ...prev, 
                      // Allow trailing commas during editing
                      classes: e.target.value.split(',').map(s => s.trim()) 
                    }))}
                    placeholder="Submit Button, Cancel Button"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status (comma-separated)</label>
                  <Input
                    value={newStep.status}
                    onChange={(e) => setNewStep(prev => ({ ...prev, status: e.target.value }))}
                    placeholder="e.g., Pass,Fail,Compliant"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Textarea
                  value={newStep.description}
                  onChange={(e) => setNewStep(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this step should accomplish"
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Condition</label>
                <Textarea
                  value={newStep.condition}
                  onChange={(e) => setNewStep(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Describe the business logic for this step"
                  className="mt-1"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Steps List */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="steps">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                <AnimatePresence>
                  {steps.map((step, index) => (
                    <Draggable 
                      key={step.id} 
                      draggableId={step.id.toString()} 
                      index={index} 
                      isDragDisabled={editingStepId !== null || selectedSteps.size > 0}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${snapshot.isDragging ? 'shadow-2xl rotate-2 z-50' : ''}`}
                        >
                          <StepCard
                            step={step}
                            index={index}
                            isSelected={selectedSteps.has(step.id)}
                            onSelect={handleSelectStep}
                            isEditing={editingStepId === step.id}
                            editedStep={editedStep}
                            onEdit={startEditing}
                            onCancelEdit={cancelEditing}
                            onSaveEdit={saveEdit}
                            onEditChange={handleEditChange}
                            onToggleEnabled={handleToggleEnabled}
                            onDelete={deleteStep}
                            onMarkClarified={markAsClarified}
                            onAddAfter={handleAddStepAfter}
                            getProductColor={getProductColor}
                            getStatusColor={getStatusColor}
                            dragHandleProps={provided.dragHandleProps}
                            isAnyStepSelected={selectedSteps.size > 0} 
                            isEditingGlobal={editingStepId !== null} 
                            isDragging={snapshot.isDragging}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                </AnimatePresence>
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {steps.length === 0 && (
          <div className="text-center py-16">
            <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Steps Found</h3>
            <p className="text-gray-600 mb-6">
              This project doesn't have any annotation steps yet.
            </p>
            <Button onClick={() => handleAddStepAfter(-1)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Step
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({ 
  step, 
  index, 
  isSelected,
  onSelect,
  isEditing, 
  editedStep, 
  onEdit, 
  onCancelEdit, 
  onSaveEdit, 
  onEditChange, 
  onToggleEnabled, 
  onDelete, 
  onMarkClarified,
  onAddAfter,
  getProductColor,
  getStatusColor,
  dragHandleProps,
  isAnyStepSelected, 
  isEditingGlobal,
  isDragging
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 overflow-hidden 
                 ${step.is_enabled === false ? 'opacity-60' : ''} 
                 ${isSelected ? 'ring-2 ring-blue-500' : ''}
                 ${isSelected ? 'bg-blue-50' : ''}
                `}
    >
      <Card className="w-full">
        <CardHeader className="flex flex-row items-start justify-between gap-4 p-4 bg-white/50 border-b border-gray-200/80">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Multi-select checkbox */}
            {!isEditing && (
              <div className="flex-shrink-0">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onSelect(step.id, checked)}
                  disabled={isEditingGlobal} 
                />
              </div>
            )}
            
            {/* Drag handle */}
            {!isEditing && (
              <div 
                {...dragHandleProps} 
                className="flex-shrink-0 cursor-grab active:cursor-grabbing"
                style={{ 
                  cursor: (isAnyStepSelected || isEditingGlobal) ? 'not-allowed' : 'grab'
                }}
              >
                <GripVertical className={`w-5 h-5 text-gray-400 hover:text-gray-600 ${
                  (isAnyStepSelected || isEditingGlobal) ? 'text-gray-300 cursor-not-allowed' : ''
                }`} />
              </div>
            )}
            
            {/* Step number */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex-shrink-0">
              {step.step_number}
            </div>
            
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-bold text-gray-900 truncate">
                {isEditing ? "" : step.title}
              </CardTitle>
              {isEditing ? (
                <Input
                  name="title"
                  value={editedStep.title}
                  onChange={(e) => onEditChange('title', e.target.value)}
                  className="mt-1 h-8"
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                  <span>Product:</span>
                  <Badge variant="outline" className="text-xs">{step.product}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Right side: Actions (Save/Cancel or Edit/Delete/Toggle) */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={onSaveEdit} className="bg-blue-600 hover:bg-blue-700">
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  <X className="w-3 h-3 mr-1" />
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Switch
                  checked={step.is_enabled !== false}
                  onCheckedChange={(checked) => onToggleEnabled(step.id, checked)}
                  size="sm"
                  disabled={isAnyStepSelected || isEditingGlobal} 
                />
                {step.is_enabled === false ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-green-600" />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEdit(step)}
                  className="h-6 w-6 p-0"
                  disabled={isAnyStepSelected || isEditingGlobal} 
                >
                  <Edit3 className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete(step.id)}
                  className="h-6 w-6 p-0
                   text-red-500 hover:text-red-700"
                  disabled={isAnyStepSelected || isEditingGlobal} 
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        
        {/* Main content area */}
        <CardContent className="p-4">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Product</label>
                  <Select value={editedStep.product} onValueChange={(value) => onEditChange('product', value)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="button">Button</SelectItem>
                      <SelectItem value="form">Form</SelectItem>
                      <SelectItem value="menu">Menu</SelectItem>
                      <SelectItem value="modal">Modal</SelectItem>
                      <SelectItem value="input">Input</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Classes (comma-separated)</label>
                  <Input
                    value={(editedStep.classes || []).join(', ')}
                    onChange={(e) => onEditChange('classes', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status (comma-separated)</label>
                  <Input
                    value={editedStep.status}
                    onChange={(e) => onEditChange('status', e.target.value)}
                    className="mt-1"
                    placeholder="e.g., Pass,Fail,Compliant"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Clarity Score (0-10)</label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={editedStep.clarity_score}
                    onChange={(e) => onEditChange('clarity_score', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`needs-clarification-${step.id}`}
                      checked={editedStep.needs_clarification}
                      onCheckedChange={(checked) => onEditChange('needs_clarification', checked)}
                    />
                    <label htmlFor={`needs-clarification-${step.id}`} className="text-sm font-medium text-gray-700">
                      Needs Clarification
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Description</label>
                <Textarea
                  value={editedStep.description}
                  onChange={(e) => onEditChange('description', e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Condition</label>
                <Textarea
                  value={editedStep.condition}
                  onChange={(e) => onEditChange('condition', e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-gray-600 text-sm mb-3">{step.description}</p>
              
              {step.needs_clarification && (
                <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-amber-800">
                      ⚠️ This step needs clarification
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onMarkClarified(step.id)}
                      className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2"
                      disabled={isAnyStepSelected || isEditingGlobal} 
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Mark as Clarified
                    </Button>
                  </div>
                  {step.clarification_questions && step.clarification_questions.length > 0 && (
                    <ul className="text-xs text-amber-700 space-y-1 mt-2">
                      {step.clarification_questions.map((question, qIndex) => (
                        <li key={qIndex}>• {question}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                <Badge className={`${getStatusColor(step.status)} border-0`}>
                  {step.status}
                </Badge>
                <Badge variant="secondary">
                  Classes: {(step.classes || []).join(', ')}
                </Badge>
                <Badge variant="outline">
                  Clarity: {step.clarity_score}/10
                </Badge>
                {step.is_annotated && (
                  <Badge className="bg-green-100 text-green-800 border-0">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Annotated
                  </Badge>
                )}
              </div>

              {/* Smart insertion button */}
              <div className="flex justify-center mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddAfter(index)}
                  className="text-xs bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                  disabled={isAnyStepSelected || isEditingGlobal} 
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Insert Step After This
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
