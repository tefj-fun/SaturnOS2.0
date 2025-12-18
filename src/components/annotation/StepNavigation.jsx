import React from "react";
import { Button } from "@/components/ui/button";
import { Circle, Target, AlertTriangle } from "lucide-react";

export default function StepNavigation({ steps, currentStepIndex, onStepSelect }) {
  const getClarityIndicator = (step) => {
    if (step.needs_clarification || (step.clarity_score && step.clarity_score < 7)) {
      return <AlertTriangle className="w-3 h-3 text-amber-600" />;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <Button
          key={step.id}
          variant={index === currentStepIndex ? "default" : "outline"}
          onClick={() => onStepSelect(index)}
          className={`w-full justify-start h-auto p-3 text-left ${
            index === currentStepIndex 
              ? "bg-teal-600 hover:bg-teal-700" 
              : "hover:bg-gray-50"
          }`}
        >
          <div className="flex items-start gap-3 w-full">
            <div className="flex-shrink-0 mt-1">
              {index === currentStepIndex ? (
                <Target className="w-4 h-4 text-white" />
              ) : (
                <Circle className="w-4 h-4 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm truncate">
                  Step {step.step_number}: {step.title}
                </span>
                <div className="flex items-center gap-1 ml-2">
                  {getClarityIndicator(step)}
                </div>
              </div>
              <p className={`text-xs opacity-80 line-clamp-2 ${
                index === currentStepIndex ? "text-white" : "text-gray-600"
              }`}>
                {(step.classes || []).join(', ')} - {step.status}
              </p>
              {step.needs_clarification && (
                <p className={`text-xs mt-1 ${
                  index === currentStepIndex ? "text-yellow-200" : "text-amber-600"
                }`}>
                  May need clarification
                </p>
              )}
            </div>
          </div>
        </Button>
      ))}
    </div>
  );
}
