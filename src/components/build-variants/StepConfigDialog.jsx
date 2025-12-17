
import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LogicRule } from "@/api/entities";
import { TrainingRun } from "@/api/entities";
import { Settings, Cpu, Target, Zap } from "lucide-react";

export default function StepConfigDialog({ 
  open, 
  step, 
  variant, 
  existingConfig, 
  onOpenChange, 
  onSaveConfig 
}) {
  const [formData, setFormData] = useState({
    active_classes: [],
    status_options: "",
    active_logic_rule_ids: [],
    inference_model_id: "",
    is_active: true
  });
  const [availableLogicRules, setAvailableLogicRules] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRelatedData = useCallback(async () => {
    if (!step) return;
    try {
      const [logicRules, trainingRuns] = await Promise.all([
        LogicRule.filter({ step_id: step.id }),
        TrainingRun.filter({ step_id: step.id, status: "completed" })
      ]);
      
      setAvailableLogicRules(logicRules);
      setAvailableModels(trainingRuns);
    } catch (error) {
      console.error("Error loading related data:", error);
    }
  }, [step]);

  useEffect(() => {
    loadRelatedData();
  }, [loadRelatedData]);

  useEffect(() => {
    if (existingConfig) {
      setFormData({
        active_classes: existingConfig.active_classes || [],
        status_options: existingConfig.status_options || "",
        active_logic_rule_ids: existingConfig.active_logic_rule_ids || [],
        inference_model_id: existingConfig.inference_model_id || "",
        is_active: existingConfig.is_active !== false
      });
    } else if (step) {
      setFormData({
        active_classes: step.classes || [],
        status_options: step.status || "Pass,Fail",
        active_logic_rule_ids: [],
        inference_model_id: "",
        is_active: true
      });
    }
  }, [existingConfig, step]); // Depend on existingConfig and step for re-initialization

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setIsSubmitting(true);
    try {
      await onSaveConfig({
        ...formData,
        active_classes: formData.active_classes.filter(Boolean)
      });
    } catch (error) {
      console.error("Error saving config:", error);
    }
    setIsSubmitting(false);
  };

  const handleClassesChange = (value) => {
    const classes = value.split(',').map(s => s.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, active_classes: classes }));
  };

  const toggleLogicRule = (ruleId) => {
    setFormData(prev => ({
      ...prev,
      active_logic_rule_ids: prev.active_logic_rule_ids.includes(ruleId)
        ? prev.active_logic_rule_ids.filter(id => id !== ruleId)
        : [...prev.active_logic_rule_ids, ruleId]
    }));
  };

  if (!step || !variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            Configure Step for Build Variant
          </DialogTitle>
          <DialogDescription>
            Set up custom annotation settings for <strong>"{step.title}"</strong> when using build variant <strong>"{variant.name}"</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          {/* Default Values Reference */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Default Step Settings:</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">
                Classes: {(step.classes || []).join(", ") || "None"}
              </Badge>
              <Badge variant="secondary">
                Status: {step.status || "Pass,Fail"}
              </Badge>
            </div>
          </div>

          {/* Active Classes Override */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Active Classes (comma-separated)
            </Label>
            <Input
              value={formData.active_classes.join(', ')}
              onChange={(e) => handleClassesChange(e.target.value)}
              placeholder="e.g., Red Button, Blue Panel, Serial Number"
              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              Leave empty to use default step classes
            </p>
          </div>

          {/* Status Options Override */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700">
              Status Options (comma-separated)
            </Label>
            <Input
              value={formData.status_options}
              onChange={(e) => setFormData(prev => ({ ...prev, status_options: e.target.value }))}
              placeholder="e.g., Pass,Fail,Rework"
              className="border-gray-200 focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500">
              These will be the annotation buttons shown in the canvas
            </p>
          </div>

          {/* Logic Rules */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Active Logic Rules
            </Label>
            {availableLogicRules.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto border rounded p-2">
                {availableLogicRules.map((rule) => (
                  <div key={rule.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`rule-${rule.id}`}
                      checked={formData.active_logic_rule_ids.includes(rule.id)}
                      onCheckedChange={() => toggleLogicRule(rule.id)}
                    />
                    <label 
                      htmlFor={`rule-${rule.id}`} 
                      className="text-sm flex-1 cursor-pointer"
                    >
                      {rule.rule_name}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No logic rules defined for this step
              </p>
            )}
          </div>

          {/* Inference Model */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              AI Inference Model
            </Label>
            <Select 
              value={formData.inference_model_id} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, inference_model_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a trained model (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No specific model</SelectItem>
                {availableModels.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.run_name} - {model.base_model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableModels.length === 0 && (
              <p className="text-xs text-gray-500">
                No completed training runs found for this step
              </p>
            )}
          </div>

          {/* Active Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is-active" className="text-sm font-medium text-gray-700">
              Configuration is active
            </Label>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 border-gray-200"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
