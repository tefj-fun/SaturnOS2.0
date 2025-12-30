
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox"; // Added Checkbox import
import { ArrowRight, PenTool, Edit3, Save, X, AlertTriangle, CheckCircle } from "lucide-react";

export default function StepsPreview({ steps, onProceed, onUpdateSteps }) {
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editedStep, setEditedStep] = useState(null);

  const getProductColor = (product) => {
    const colors = {
      button: "bg-blue-100 text-blue-800",
      form: "bg-blue-100 text-blue-800",
      menu: "bg-purple-100 text-purple-800",
      modal: "bg-orange-100 text-orange-800",
      input: "bg-blue-100 text-blue-800",
      link: "bg-pink-100 text-pink-800",
      default: "bg-gray-100 text-gray-800"
    };
    const productKey = product?.toLowerCase() || 'default';
    return colors[productKey] || colors.default;
  };

  const getStatusColor = (status) => {
    const colors = {
        good: "bg-blue-100 text-blue-800",
        bad: "bg-red-100 text-red-800",
        neutral: "bg-gray-100 text-gray-800",
        error: "bg-red-100 text-red-800",
        warning: "bg-amber-100 text-amber-800",
        info: "bg-blue-100 text-blue-800",
        default: "bg-gray-100 text-gray-800",
    };
    const statusKey = status?.toLowerCase() || 'default';
    return colors[statusKey] || colors.default;
  };

  const getClarityIndicator = (step) => {
    // Check if needs_clarification is explicitly set to true
    if (step.needs_clarification === true) {
      return {
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-100",
        label: "Needs Clarification"
      };
    }
    // Fallback to clarity score if needs_clarification is false or undefined
    if (step.clarity_score >= 8) {
      return {
        icon: CheckCircle,
        color: "text-blue-600",
        bgColor: "bg-blue-100",
        label: "Clear"
      };
    } else if (step.clarity_score >= 6) {
      return {
        icon: AlertTriangle,
        color: "text-amber-600",
        bgColor: "bg-amber-100",
        label: "Needs Review"
      };
    } else {
      return {
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-100",
        label: "Needs Clarification"
      };
    }
  };

  const startEditing = (index, step) => {
    setEditingIndex(index);
    // Ensure 'classes' is an array for editing.
    // Prioritize step.classes if it's already an array.
    // Fallback to converting step.class (string) to an array if it exists.
    // Default to an empty array otherwise.
    const initialClasses = Array.isArray(step.classes)
      ? step.classes
      : (typeof step.class === 'string' && step.class.trim() !== '')
        ? [step.class.trim()]
        : [];

    setEditedStep({
      ...step,
      classes: initialClasses,
      // Explicitly set the old 'class' property to undefined to ensure consistency
      // during editing, as we're now using 'classes'.
      class: undefined,
      // Ensure clarity_score is a number for the input field
      clarity_score: typeof step.clarity_score === 'number' ? step.clarity_score : 0,
      // Ensure needs_clarification is a boolean
      needs_clarification: typeof step.needs_clarification === 'boolean' ? step.needs_clarification : false
    });
  };

  const cancelEditing = () => {
    setEditingIndex(-1);
    setEditedStep(null);
  };

  const saveEdit = () => {
    if (editedStep && onUpdateSteps) {
      const updatedSteps = [...steps];
      updatedSteps[editingIndex] = editedStep;
      onUpdateSteps(updatedSteps);
    }
    setEditingIndex(-1);
    setEditedStep(null);
  };

  const handleEditChange = (field, value) => {
    if (field === 'classes') {
      setEditedStep(prev => ({ ...prev, [field]: value.split(',').map(s => s.trim()).filter(Boolean) }));
    } else if (field === 'clarity_score') {
      // When clarity score changes, also update needs_clarification
      const score = parseFloat(value);
      setEditedStep(prev => ({ 
        ...prev, 
        [field]: score,
        // If clarity_score drops below 6, set needs_clarification to true.
        // If it reaches 6 or above, set needs_clarification to false unless explicitly overridden.
        // We use 6 here to align with the "Needs Review" threshold, ensuring that "Needs Clarification" implies a critical issue.
        needs_clarification: score < 6 
      }));
    } else if (field === 'needs_clarification') {
      setEditedStep(prev => ({ ...prev, [field]: value }));
    } else {
      setEditedStep(prev => ({ ...prev, [field]: value }));
    }
  };

  // New function to mark step as clarified
  const markAsClarified = (index) => {
    const updatedSteps = [...steps];
    updatedSteps[index] = {
      ...updatedSteps[index],
      needs_clarification: false,
      // Ensure clarity_score is at least 7 when marked as clarified, implying it's "Clear" or "Needs Review"
      clarity_score: Math.max(updatedSteps[index].clarity_score || 0, 7), 
      clarification_questions: [] // Clear any outstanding questions
    };
    onUpdateSteps(updatedSteps);
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Generated Steps ({steps.length})
        </h3>
        <p className="text-gray-600">
          Review and edit the generated steps. Steps with low clarity scores may need additional information.
        </p>
      </div>

      <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
        {steps.map((step, index) => {
          const clarityIndicator = getClarityIndicator(step);
          const ClarityIcon = clarityIndicator.icon;
          
          return (
            <Card key={index} className="glass-effect border-0 shadow-sm">
              <CardContent className="p-4">
                {editingIndex === index ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">Edit Step {index + 1}</h4>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700">
                          <Save className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditing}>
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Title</label>
                        <Input
                          value={editedStep.title}
                          onChange={(e) => handleEditChange('title', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Product</label>
                        <Input
                          value={editedStep.product}
                          onChange={(e) => handleEditChange('product', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Classes (comma-separated)</label>
                        <Input
                          value={(editedStep.classes || []).join(', ')}
                          onChange={(e) => handleEditChange('classes', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Status</label>
                        <Select value={editedStep.status} onValueChange={(value) => handleEditChange('status', value)}>
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="bad">Bad</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Clarity Score (0-10)</label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={editedStep.clarity_score}
                          onChange={(e) => handleEditChange('clarity_score', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <Checkbox
                          id={`needs-clarification-${index}`}
                          checked={editedStep.needs_clarification}
                          onCheckedChange={(checked) => handleEditChange('needs_clarification', checked)}
                        />
                        <label htmlFor={`needs-clarification-${index}`} className="text-sm font-medium text-gray-700 cursor-pointer">
                          Needs Clarification
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      <Textarea
                        value={editedStep.description}
                        onChange={(e) => handleEditChange('description', e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Condition</label>
                      <Textarea
                        value={editedStep.condition}
                        onChange={(e) => handleEditChange('condition', e.target.value)}
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{step.title}</h4>
                        <div className="flex items-center gap-2">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${clarityIndicator.bgColor}`}>
                            <ClarityIcon className={`w-3 h-3 ${clarityIndicator.color}`} />
                            <span className={`text-xs font-medium ${clarityIndicator.color}`}>
                              {clarityIndicator.label}
                            </span>
                          </div>
                          <Badge className={`${getProductColor(step.product)} border-0`}>
                            {step.product}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEditing(index, step)}
                            className="h-6 w-6 p-0"
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{step.description}</p>
                      
                      {/* Display clarification questions with Mark as Clarified button */}
                      {step.clarification_questions && step.clarification_questions.length > 0 && (
                        <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-xs font-medium text-amber-800">
                              ⚠️ This step may need clarification:
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsClarified(index)}
                              className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Mark as Clarified
                            </Button>
                          </div>
                          <ul className="text-xs text-amber-700 space-y-1">
                            {step.clarification_questions.map((question, qIndex) => (
                              <li key={qIndex}>• {question}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Display needs_clarification flag without questions with Mark as Clarified button */}
                      {step.needs_clarification && (!step.clarification_questions || step.clarification_questions.length === 0) && (
                        <div className="mb-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-amber-800">
                              ⚠️ This step has been flagged as needing clarification
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => markAsClarified(index)}
                              className="h-6 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100 px-2"
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Mark as Clarified
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary" className="font-normal">
                          Condition: {step.condition}
                        </Badge>
                        <Badge variant="secondary" className="font-normal">
                          Classes: {(step.classes || []).join(', ')}
                        </Badge>
                        <Badge className={`${getStatusColor(step.status)} border-0 font-normal`}>
                          Status: {step.status}
                        </Badge>
                        <Badge variant="outline" className="font-normal">
                          Clarity: {step.clarity_score}/10
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-200">
        <div>
          <p className="text-sm text-gray-600">
            {steps.length} annotation steps ready for your review
          </p>
        </div>
        <Button 
          onClick={onProceed}
          className="bg-blue-600 hover:bg-blue-700 shadow-lg"
          size="lg"
        >
          <PenTool className="w-5 h-5 mr-2" />
          Continue to Dataset Upload
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
