import { useState, useEffect, useCallback } from "react";
import { LogicRule } from "@/api/entities";
import { InvokeLLM } from "@/api/integrations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Workflow,
  ArrowDown,
  GripVertical,
  Loader2,
  Sparkles,
  Target,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LogicFlowVisualizer from "./LogicFlowVisualizer";

const initialNewRuleState = {
  rule_name: "",
  is_active: true,
  rule_type: "quantity",
  condition: "",
  operator: "equals",
  value: "",
  subject_class: "",
  relationship: "is_within",
  target_class: "",
  coverage: 100,
  iou_operator: ">=",
  iou_value: 0.95
};

export default function LogicBuilder({ currentStep, logicRules, onRulesUpdate, onOpenImagesTab }) {
  const [rules, setRules] = useState(logicRules || []);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedClass, setDraggedClass] = useState(null);
  const [newRule, setNewRule] = useState(initialNewRuleState);
  const [showVisualization, setShowVisualization] = useState(true);
  const [compactView, setCompactView] = useState(false);

  const loadAndGenerateRules = useCallback(async () => {
    if (!currentStep) {
      setRules([]);
      return;
    }

    let existingRules = await LogicRule.filter({ step_id: currentStep.id });

    if (existingRules.length === 0 && currentStep.condition) {
      setIsGenerating(true);
      try {
        const prompt = `
          You are an expert in translating natural language business logic into structured, computer-readable rules for visual inspection and quality assurance. Your task is to analyze the 'Business Logic' from the step context and create a precise rule that can be evaluated programmatically.

          Step Context:
          - Class to count/check: ${(currentStep.classes && currentStep.classes.length > 0 ? `'${currentStep.classes.join("', '")}'` : "N/A")}
          - Business Logic: ${currentStep.condition}
          - Expected Status on Success: ${currentStep.status || "Pass"}

          Your goal is to create ONE rule that defines the success condition described in the 'Business Logic'.

          Instructions:
          1.  **Identify the target class:** Look at the 'Class to count/check' and 'Business Logic' to determine what is being measured. Use the exact class name in the \`condition\` field of your JSON output. For example, if counting 'apple' objects, the condition should be \`apple\`.
          2.  **Identify the comparison:** Analyze the 'Business Logic' for keywords like 'exactly', 'at least', 'at most', 'more than', 'less than', 'is present', 'is absent'.
          3.  **Determine the \`operator\` and \`value\`:**
              - 'exactly 4' -> \`operator\`: 'equals', \`value\`: '4'
              - 'at least 2' -> \`operator\`: 'greater_than_or_equal_to', \`value\`: '2'
              - 'at most 5' -> \`operator\`: 'less_than_or_equal_to', \`value\`: '5'
              - 'more than 3' -> \`operator\`: 'greater_than', \`value\`: '3'
              - 'less than 10' -> \`operator\`: 'less_than', \`value\`: '10'
              - 'is present' -> \`operator\`: 'exists', \`value\`: ''
              - 'is absent' -> \`operator\`: 'not_exists', \`value\`: ''

          Return the output as a JSON object with a single key "rules" which is an array containing exactly ONE rule object.

          ## Example ##
          INPUT:
          - Class to count/check: 'apple'
          - Business Logic: "Count the total number of 'apple' objects detected on the table. The step passes if exactly 4 apples are detected. Otherwise, it fails."
          - Expected Status on Success: 'Pass'

          CORRECT JSON OUTPUT:
          {
            "rules": [
              {
                "rule_name": "Verify exact count of apples",
                "condition": "apple",
                "operator": "equals",
                "value": "4"
              }
            ]
          }
          ## End Example ##

          Now, generate the rule for the provided Step Context.
        `;

        const { rules: generatedRules } = await InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              rules: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    rule_name: { type: "string" },
                    condition: { type: "string" },
                    operator: { type: "string", enum: ["equals", "contains", "greater_than", "less_than", "exists", "not_exists", "greater_than_or_equal_to", "less_than_or_equal_to"] },
                    value: { type: "string" }
                  },
                  required: ["rule_name", "condition", "operator", "value"]
                }
              }
            },
            required: ["rules"]
          }
        });

        if (generatedRules && generatedRules.length > 0) {
          const rulesToCreate = generatedRules.map((rule, index) => ({
            ...rule,
            step_id: currentStep.id,
            priority: index + 1,
            is_active: true,
            rule_type: 'quantity'
          }));
          await LogicRule.bulkCreate(rulesToCreate);
          existingRules = await LogicRule.filter({ step_id: currentStep.id });
        }
      } catch (error) {
        console.error("Error generating default rules:", error);
      } finally {
        setIsGenerating(false);
      }
    }
    setRules(existingRules);
  }, [currentStep]);

  useEffect(() => {
    setRules(logicRules || []);
  }, [logicRules]);

  useEffect(() => {
    loadAndGenerateRules();
  }, [loadAndGenerateRules]);

  const handleAddRule = async () => {
    if (!currentStep || !newRule.rule_name) return;

    let ruleData = {
      rule_name: newRule.rule_name,
      is_active: newRule.is_active,
      rule_type: newRule.rule_type,
      step_id: currentStep.id,
      priority: rules.length + 1,
    };

    if (newRule.rule_type === 'quantity') {
      ruleData = { ...ruleData, condition: newRule.condition, operator: newRule.operator, value: newRule.value };
    } else {
      ruleData = { ...ruleData, subject_class: newRule.subject_class, relationship: newRule.relationship, target_class: newRule.target_class };
      if (newRule.relationship === 'has_iou_with') {
        ruleData = { ...ruleData, iou_operator: newRule.iou_operator, iou_value: newRule.iou_value };
      } else {
        ruleData = { ...ruleData, coverage: newRule.coverage };
      }
    }

    try {
      await LogicRule.create(ruleData);
      setShowAddRule(false);
      setNewRule(initialNewRuleState);
      onRulesUpdate();
    } catch (error) {
      console.error("Error adding rule:", error);
    }
  };

  const handleUpdateRule = async (ruleId, updatedData) => {
    try {
      await LogicRule.update(ruleId, updatedData);
      setEditingRuleId(null);
      onRulesUpdate();
    } catch (error) {
      console.error("Error updating rule:", error);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await LogicRule.delete(ruleId);
      onRulesUpdate();
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const handleToggleRule = async (ruleId, isActive) => {
    try {
      await LogicRule.update(ruleId, { is_active: isActive });
      onRulesUpdate();
    } catch (error) {
      console.error("Error toggling rule:", error);
    }
  };

  const getOperatorLabel = (operator) => {
    const labels = {
      equals: "Equals",
      contains: "Contains",
      greater_than: "Greater than",
      less_than: "Less than",
      exists: "Exists",
      not_exists: "Does not exist",
      greater_than_or_equal_to: "Greater than or equal to",
      less_than_or_equal_to: "Less than or equal to"
    };
    return labels[operator] || operator;
  };

  const handleDragStart = (e, className) => {
    setDraggedClass(className);
    e.dataTransfer.setData('text/plain', className);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragEnd = () => {
    setDraggedClass(null);
  };

  const handleConditionDrop = (e, fieldName, setEditDataCallback) => {
    e.preventDefault();
    const droppedClass = e.dataTransfer.getData('text/plain');
    if (droppedClass) {
      if (fieldName === 'condition') {
        setEditDataCallback(droppedClass);
      } else {
        setEditDataCallback(droppedClass);
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  if (!currentStep) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a step to build logic rules</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Logic Builder</h2>
              <p className="text-sm text-gray-600">
                Step: <span className="font-semibold text-blue-700">{currentStep.title}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{currentStep.product}</Badge>
              <Badge variant="secondary" className="text-xs">Status: {currentStep.status}</Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenImagesTab && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenImagesTab}
                className="text-xs"
              >
                <Target className="w-3 h-3 mr-1" />
                Test on images
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompactView(!compactView)}
              className="text-xs"
            >
              {compactView ? <ChevronDown className="w-3 h-3 mr-1" /> : <ChevronUp className="w-3 h-3 mr-1" />}
              {compactView ? 'Expand' : 'Compact'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowVisualization(!showVisualization)}
              className="text-xs"
            >
              {showVisualization ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
              {showVisualization ? 'Hide' : 'Show'} Flow
            </Button>
            <Button
              onClick={() => setShowAddRule(true)}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={isGenerating}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Rule
            </Button>
          </div>
        </div>

        {/* Draggable Classes Bar */}
        <AnimatePresence>
          {!compactView && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 pt-3 border-t border-gray-200"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Draggable Classes:</span>
                <div className="flex flex-wrap gap-2">
                  {(currentStep.classes || []).map(cls => (
                    <Button
                      key={cls}
                      variant="outline"
                      size="sm"
                      draggable
                      onDragStart={(e) => handleDragStart(e, cls)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab active:cursor-grabbing transition-all duration-200 bg-white text-xs h-7 px-2 ${
                        draggedClass === cls ? 'opacity-50 border-blue-400' : ''
                      } hover:bg-blue-50 hover:border-blue-300`}
                    >
                      <GripVertical className="w-3 h-3 mr-1 text-gray-400" />
                      {cls}
                    </Button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Rules Panel */}
        <div className={`${showVisualization ? 'w-1/2' : 'flex-1'} flex flex-col bg-white border-r border-gray-200`}>
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">
                Logic Rules ({rules.length})
              </h3>
              {rules.length > 0 && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {rules.filter(r => r.is_active).length} active
                </Badge>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isGenerating ? (
              <div className="text-center py-12">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-400 animate-pulse" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Generating Logic...</h3>
                <p className="text-gray-600 mb-6">
                  AI is creating default rules based on your step&apos;s context.
                </p>
                <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
              </div>
            ) : rules.length === 0 && !showAddRule ? (
              <div className="text-center py-12">
                <Workflow className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Logic Rules</h3>
                <p className="text-gray-600 mb-6">
                  Create logic rules to guide the annotation detection process
                </p>
                <Button
                  onClick={() => setShowAddRule(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Rule
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {rules.map((rule, index) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      index={index}
                      isEditing={editingRuleId === rule.id}
                      onEdit={() => setEditingRuleId(rule.id)}
                      onCancel={() => setEditingRuleId(null)}
                      onSave={(updatedData) => handleUpdateRule(rule.id, updatedData)}
                      onDelete={() => handleDeleteRule(rule.id)}
                      onToggle={(isActive) => handleToggleRule(rule.id, isActive)}
                      getOperatorLabel={getOperatorLabel}
                      onConditionDrop={handleConditionDrop}
                      onDragOver={handleDragOver}
                      draggedClass={draggedClass}
                      compact={compactView}
                    />
                  ))}
                </AnimatePresence>

                {showAddRule && (
                  <AddRuleCard
                    newRule={newRule}
                    setNewRule={setNewRule}
                    onSave={handleAddRule}
                    onCancel={() => setShowAddRule(false)}
                    onConditionDrop={handleConditionDrop}
                    onDragOver={handleDragOver}
                    draggedClass={draggedClass}
                    compact={compactView}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Visualization Panel */}
        <AnimatePresence>
          {showVisualization && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "50%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="bg-white overflow-hidden"
            >
              <LogicFlowVisualizer rules={rules} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  index,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggle,
  getOperatorLabel,
  onConditionDrop,
  onDragOver,
  draggedClass,
  compact = false
}) {
  const [editData, setEditData] = useState(rule);

  useEffect(() => {
    setEditData(rule);
  }, [rule]);

  const handleSave = () => {
    onSave(editData);
  };

  const renderRuleContent = () => {
    if (rule.rule_type === 'spatial') {
      const { subject_class, relationship, target_class, iou_operator, iou_value, coverage } = rule;
      const relString = relationship?.replace(/_/g, ' ') || '';
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
            {subject_class}
          </Badge>
          <span className="text-sm font-medium text-gray-700">{relString}</span>
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs">
            {target_class}
          </Badge>
          {relationship === 'has_iou_with' ? (
            <Badge variant="outline" className="text-xs">{iou_operator} {iou_value}</Badge>
          ) : (
            <Badge variant="outline" className="text-xs">{coverage}% coverage</Badge>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
          {rule.condition}
        </Badge>
        <Badge variant="outline" className="text-xs">
          {getOperatorLabel(rule.operator)}
        </Badge>
        {rule.value && (
          <>
            <ArrowDown className="w-3 h-3 text-gray-400" />
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
              {rule.value}
            </Badge>
          </>
        )}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`glass-effect border-0 shadow-sm transition-all duration-200 ${
        !rule.is_active ? "opacity-60" : ""
      } ${compact ? 'p-3' : ''}`}>
        <CardHeader className={compact ? "pb-2" : "pb-3"}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className={compact ? "text-sm" : "text-base"}>{rule.rule_name}</CardTitle>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={rule.is_active} onCheckedChange={onToggle} size="sm" />
              {!isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={onCancel}>
                    <X className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className={compact ? "pt-0" : ""}>
          {isEditing ? (
            <EditRuleForm
              editData={editData}
              setEditData={setEditData}
              onConditionDrop={onConditionDrop}
              onDragOver={onDragOver}
              draggedClass={draggedClass}
            />
          ) : (
            <div className="space-y-3">
              {renderRuleContent()}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AddRuleCard({
  newRule,
  setNewRule,
  onSave,
  onCancel,
  onConditionDrop,
  onDragOver,
  draggedClass,
  compact = false
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
        <CardHeader className={compact ? "pb-2" : "pb-3"}>
          <div className="flex items-center justify-between">
            <CardTitle className={`text-blue-800 ${compact ? 'text-sm' : 'text-base'}`}>Add New Logic Rule</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={onSave} className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className={compact ? "pt-0" : ""}>
          <EditRuleForm
            editData={newRule}
            setEditData={setNewRule}
            onConditionDrop={onConditionDrop}
            onDragOver={onDragOver}
            draggedClass={draggedClass}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EditRuleForm({ editData, setEditData, onConditionDrop, onDragOver, draggedClass }) {

  const DropTargetInput = ({ value, onChange, placeholder, fieldName }) => {
    const [isDropTarget, setIsDropTarget] = useState(false);

    const handleLocalDrop = (e) => {
      setIsDropTarget(false);
      onConditionDrop(e, fieldName, (newValue) => onChange({ target: { value: newValue } }));
    };

    return (
      <div
        className={`relative rounded overflow-hidden ${
          isDropTarget && draggedClass ? 'ring-2 ring-blue-400 bg-blue-50' : ''
        }`}
        onDrop={handleLocalDrop}
        onDragOver={(e) => { onDragOver(e); setIsDropTarget(true); }}
        onDragLeave={() => setIsDropTarget(false)}
      >
        <Input
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`mt-1 transition-all duration-200 ${
            isDropTarget && draggedClass ? 'border-blue-400 bg-blue-50' : ''
          }`}
        />
        {isDropTarget && draggedClass && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Target className="w-6 h-6 text-blue-500" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Rule Name</label>
          <Input
            value={editData.rule_name}
            onChange={(e) => setEditData(prev => ({ ...prev, rule_name: e.target.value }))}
            className="mt-1"
            placeholder="e.g., Verify apple count"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Rule Type</label>
          <Select
            value={editData.rule_type}
            onValueChange={(value) => setEditData(prev => ({ ...prev, rule_type: value }))}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="quantity">Quantity / Existence</SelectItem>
              <SelectItem value="spatial">Spatial Relationship</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={editData.rule_type}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2 }}
        >
          {editData.rule_type === 'quantity' ? (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <div>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  Class Name
                  {draggedClass && (
                    <span className="text-xs text-blue-600">
                      Drop &quot;{draggedClass}&quot; here
                    </span>
                  )}
                </label>
                <DropTargetInput
                  value={editData.condition}
                  onChange={(e) => setEditData(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Drop a class here"
                  fieldName="condition"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Operator</label>
                  <Select value={editData.operator} onValueChange={(v) => setEditData(p => ({...p, operator: v}))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="greater_than_or_equal_to">{'>='}</SelectItem>
                      <SelectItem value="less_than_or_equal_to">{'<='}</SelectItem>
                      <SelectItem value="greater_than">{'>'}</SelectItem>
                      <SelectItem value="less_than">{'<'}</SelectItem>
                      <SelectItem value="exists">Exists</SelectItem>
                      <SelectItem value="not_exists">Not Exists</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Value</label>
                  <Input value={editData.value} onChange={(e) => setEditData(p => ({...p, value: e.target.value}))} className="mt-1" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    Subject Class (A)
                    {draggedClass && (
                      <span className="text-xs text-blue-600">
                        Drop &quot;{draggedClass}&quot; here
                      </span>
                    )}
                  </label>
                  <DropTargetInput
                    value={editData.subject_class}
                    onChange={(e) => setEditData(p => ({...p, subject_class: e.target.value}))}
                    placeholder="Drop class"
                    fieldName="subject_class"
                  />
                </div>
                <div className="md:col-span-2">
                   <label className="text-sm font-medium text-gray-700">Relationship</label>
                   <Select value={editData.relationship} onValueChange={(v) => setEditData(p => ({...p, relationship: v}))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="is_within">Is Within</SelectItem>
                        <SelectItem value="contains">Contains</SelectItem>
                        <SelectItem value="overlaps">Overlaps</SelectItem>
                        <SelectItem value="has_iou_with">Has IoU With</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
              </div>
               <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    Target Class (B)
                    {draggedClass && (
                      <span className="text-xs text-blue-600">
                        Drop &quot;{draggedClass}&quot; here
                      </span>
                    )}
                  </label>
                  <DropTargetInput
                    value={editData.target_class}
                    onChange={(e) => setEditData(p => ({...p, target_class: e.target.value}))}
                    placeholder="Drop class"
                    fieldName="target_class"
                  />
                </div>
                {editData.relationship === 'has_iou_with' ? (
                  <>
                    <div>
                      <label className="text-sm font-medium text-gray-700">IoU Operator</label>
                      <Select value={editData.iou_operator} onValueChange={(v) => setEditData(p => ({...p, iou_operator: v}))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">=">{'>='}</SelectItem>
                          <SelectItem value="<=">{'<='}</SelectItem>
                          <SelectItem value=">">{'>'}</SelectItem>
                          <SelectItem value="<">{'<'}</SelectItem>
                          <SelectItem value="==">{'=='}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Target IoU</label>
                      <Input type="number" step="0.05" min="0" max="1" value={editData.iou_value} onChange={(e) => setEditData(p => ({...p, iou_value: parseFloat(e.target.value)}))} className="mt-1" />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Min Coverage %</label>
                    <Input type="number" step="5" min="0" max="100" value={editData.coverage} onChange={(e) => setEditData(p => ({...p, coverage: parseInt(e.target.value, 10)}))} className="mt-1" />
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
