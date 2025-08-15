import React, { useState, useEffect } from "react";
import { LogicRule } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Workflow,
  AlertTriangle,
  CheckCircle,
  ArrowDown,
  GripVertical
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LogicBuilder({ currentStep, logicRules, onRulesUpdate }) {
  const [rules, setRules] = useState(logicRules || []);
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_name: "",
    condition: "",
    operator: "equals",
    value: "",
    action: "annotate",
    priority: 1,
    is_active: true
  });

  useEffect(() => {
    setRules(logicRules || []);
  }, [logicRules]);

  const handleAddRule = async () => {
    if (!currentStep || !newRule.rule_name || !newRule.condition) return;

    try {
      const ruleData = {
        ...newRule,
        step_id: currentStep.id,
        priority: rules.length + 1
      };

      await LogicRule.create(ruleData);
      setShowAddRule(false);
      setNewRule({
        rule_name: "",
        condition: "",
        operator: "equals",
        value: "",
        action: "annotate",
        priority: 1,
        is_active: true
      });
      onRulesUpdate(rules);
    } catch (error) {
      console.error("Error adding rule:", error);
    }
  };

  const handleUpdateRule = async (ruleId, updatedData) => {
    try {
      await LogicRule.update(ruleId, updatedData);
      setEditingRuleId(null);
      onRulesUpdate(rules);
    } catch (error) {
      console.error("Error updating rule:", error);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    try {
      await LogicRule.delete(ruleId);
      onRulesUpdate(rules);
    } catch (error) {
      console.error("Error deleting rule:", error);
    }
  };

  const handleToggleRule = async (ruleId, isActive) => {
    try {
      await LogicRule.update(ruleId, { is_active: isActive });
      onRulesUpdate(rules);
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
      not_exists: "Does not exist"
    };
    return labels[operator] || operator;
  };

  const getActionColor = (action) => {
    const colors = {
      annotate: "bg-teal-100 text-teal-800",
      skip: "bg-gray-100 text-gray-800",
      flag: "bg-amber-100 text-amber-800",
      validate: "bg-blue-100 text-blue-800"
    };
    return colors[action] || colors.annotate;
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
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Logic Builder</h2>
            <p className="text-gray-600 mt-1">
              Define detection rules for "{currentStep.class}" annotation
            </p>
          </div>
          <Button
            onClick={() => setShowAddRule(true)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Rule
          </Button>
        </div>

        {/* Step Context */}
        <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
          <div className="flex items-center gap-2 mb-2">
            <Workflow className="w-4 h-4 text-teal-600" />
            <span className="font-medium text-teal-800">Current Context</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-teal-600 font-medium">Product:</span>
              <span className="ml-2 text-teal-800">{currentStep.product}</span>
            </div>
            <div>
              <span className="text-teal-600 font-medium">Class:</span>
              <span className="ml-2 text-teal-800">{currentStep.class}</span>
            </div>
            <div className="col-span-2">
              <span className="text-teal-600 font-medium">Condition:</span>
              <span className="ml-2 text-teal-800">{currentStep.condition}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-auto p-6">
        {rules.length === 0 && !showAddRule ? (
          <div className="text-center py-12">
            <Workflow className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Logic Rules</h3>
            <p className="text-gray-600 mb-6">
              Create logic rules to guide the annotation detection process
            </p>
            <Button
              onClick={() => setShowAddRule(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
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
                  getActionColor={getActionColor}
                />
              ))}
            </AnimatePresence>

            {showAddRule && (
              <AddRuleCard
                newRule={newRule}
                setNewRule={setNewRule}
                onSave={handleAddRule}
                onCancel={() => setShowAddRule(false)}
                getOperatorLabel={getOperatorLabel}
                getActionColor={getActionColor}
              />
            )}
          </div>
        )}
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
  getActionColor 
}) {
  const [editData, setEditData] = useState(rule);

  const handleSave = () => {
    onSave(editData);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`glass-effect border-0 shadow-sm ${
        !rule.is_active ? "opacity-60" : ""
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
              </div>
              <div>
                <CardTitle className="text-base">{rule.rule_name}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">{rule.condition}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.is_active}
                onCheckedChange={onToggle}
                size="sm"
              />
              {!isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={onEdit}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={onDelete}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={handleSave} className="bg-teal-600 hover:bg-teal-700">
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

        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Rule Name</label>
                  <Input
                    value={editData.rule_name}
                    onChange={(e) => setEditData(prev => ({ ...prev, rule_name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Action</label>
                  <Select
                    value={editData.action}
                    onValueChange={(value) => setEditData(prev => ({ ...prev, action: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annotate">Annotate</SelectItem>
                      <SelectItem value="skip">Skip</SelectItem>
                      <SelectItem value="flag">Flag</SelectItem>
                      <SelectItem value="validate">Validate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Condition</label>
                <Textarea
                  value={editData.condition}
                  onChange={(e) => setEditData(prev => ({ ...prev, condition: e.target.value }))}
                  className="mt-1"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Operator</label>
                  <Select
                    value={editData.operator}
                    onValueChange={(value) => setEditData(prev => ({ ...prev, operator: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equals">Equals</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="greater_than">Greater than</SelectItem>
                      <SelectItem value="less_than">Less than</SelectItem>
                      <SelectItem value="exists">Exists</SelectItem>
                      <SelectItem value="not_exists">Does not exist</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Value</label>
                  <Input
                    value={editData.value}
                    onChange={(e) => setEditData(prev => ({ ...prev, value: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {getOperatorLabel(rule.operator)}
                </Badge>
                <ArrowDown className="w-3 h-3 text-gray-400" />
                <Badge className={`${getActionColor(rule.action)} border-0 text-xs`}>
                  {rule.action}
                </Badge>
              </div>
              
              {rule.value && (
                <div className="text-sm">
                  <span className="text-gray-600">Value: </span>
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                    {rule.value}
                  </code>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AddRuleCard({ newRule, setNewRule, onSave, onCancel, getOperatorLabel, getActionColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="border-2 border-dashed border-teal-200 bg-teal-50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-teal-800">Add New Logic Rule</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={onSave} className="bg-teal-600 hover:bg-teal-700">
                <Save className="w-3 h-3 mr-1" />
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Rule Name</label>
              <Input
                value={newRule.rule_name}
                onChange={(e) => setNewRule(prev => ({ ...prev, rule_name: e.target.value }))}
                placeholder="Enter rule name"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Action</label>
              <Select
                value={newRule.action}
                onValueChange={(value) => setNewRule(prev => ({ ...prev, action: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annotate">Annotate</SelectItem>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="flag">Flag</SelectItem>
                  <SelectItem value="validate">Validate</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Condition</label>
            <Textarea
              value={newRule.condition}
              onChange={(e) => setNewRule(prev => ({ ...prev, condition: e.target.value }))}
              placeholder="Describe the condition for this rule"
              className="mt-1"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Operator</label>
              <Select
                value={newRule.operator}
                onValueChange={(value) => setNewRule(prev => ({ ...prev, operator: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="greater_than">Greater than</SelectItem>
                  <SelectItem value="less_than">Less than</SelectItem>
                  <SelectItem value="exists">Exists</SelectItem>
                  <SelectItem value="not_exists">Does not exist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Value</label>
              <Input
                value={newRule.value}
                onChange={(e) => setNewRule(prev => ({ ...prev, value: e.target.value }))}
                placeholder="Comparison value"
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}