
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Bot,
  Target,
  Square,
  MousePointer2,
  Lightbulb,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { motion } from "framer-motion";

export default function AnnotationCopilot({ 
  currentStep, 
  onAnnotationModeChange, 
  annotationMode 
}) {
  const [isThinking, setIsThinking] = useState(false);

  const getProductGuidance = () => {
    if (!currentStep) return null;
    
    const { product } = currentStep;
    
    const guidance = {
      button: {
        icon: Target,
        color: "text-blue-600",
        tips: [
          "Look for clickable elements like buttons or links",
          "Consider hover states and active states",
          "Check for disabled or loading states"
        ]
      },
      form: {
        icon: Square,
        color: "text-green-600", 
        tips: [
          "Identify input fields, labels, and validation messages",
          "Look for form submission buttons",
          "Consider error states and success feedback"
        ]
      },
      menu: {
        icon: MousePointer2,
        color: "text-purple-600",
        tips: [
          "Find dropdown menus, navigation bars",
          "Look for menu items and submenus",
          "Consider open and closed states"
        ]
      }
    };
    
    return guidance[product.toLowerCase()] || guidance.button;
  };

  const productGuidance = getProductGuidance();

  const annotationModes = [
    {
      id: 'select',
      label: 'Select Element',
      icon: Target,
      description: 'Click to select UI elements'
    },
    {
      id: 'draw',
      label: 'Draw Annotation',
      icon: Square,
      description: 'Draw bounding boxes'
    },
    {
      id: 'move',
      label: 'Adjust Position',
      icon: MousePointer2,
      description: 'Move and resize annotations'
    }
  ];

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <h2 className="font-bold text-gray-900">AI Copilot</h2>
        </div>
        <p className="text-sm text-gray-600">
          Intelligent guidance for precise annotation
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Current Step Info */}
        {currentStep && (
          <Card className="glass-effect border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {productGuidance && (
                  <productGuidance.icon className={`w-4 h-4 ${productGuidance.color}`} />
                )}
                Annotating {currentStep.product}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-900 mb-1">{currentStep.title}</h4>
                <p className="text-sm text-gray-600">{currentStep.description}</p>
              </div>
              
              <div className="p-3 bg-teal-50 rounded-lg border border-teal-100">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-medium text-teal-800">AI Guidance</span>
                </div>
                <p className="text-sm text-teal-700">
                  Focus on the item: 
                  <code className="bg-teal-100 px-1 rounded text-xs mx-1">
                    {currentStep.class}
                  </code>
                   and label it with status:
                   <code className="bg-teal-100 px-1 rounded text-xs ml-1">
                    {currentStep.status}
                  </code>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Annotation Tools */}
        <Card className="glass-effect border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Annotation Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {annotationModes.map((mode) => (
                <Button
                  key={mode.id}
                  variant={annotationMode === mode.id ? "default" : "outline"}
                  onClick={() => onAnnotationModeChange(mode.id)}
                  className={`w-full justify-start h-auto p-3 ${
                    annotationMode === mode.id 
                      ? "bg-teal-600 hover:bg-teal-700" 
                      : "hover:bg-gray-50"
                  }`}
                >
                  <mode.icon className="w-4 h-4 mr-3" />
                  <div className="text-left">
                    <div className="font-medium">{mode.label}</div>
                    <div className="text-xs opacity-80">{mode.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Smart Tips */}
        {productGuidance && (
          <Card className="glass-effect border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Smart Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {productGuidance.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <ArrowRight className="w-3 h-3 text-teal-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Context Information */}
        {currentStep && (
          <Card className="glass-effect border-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Context Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Business Logic
                </span>
                <p className="text-sm text-gray-700 mt-1">{currentStep.condition}</p>
              </div>
              
              <Separator />
              
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Target Class
                </span>
                <Badge variant="outline" className="mt-2 font-mono text-xs">
                  {currentStep.class}
                </Badge>
              </div>

              <Separator />

              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Expected Status
                </span>
                <Badge variant="outline" className="mt-2 font-mono text-xs">
                  {currentStep.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-gray-200 bg-white">
        <Button className="w-full bg-teal-600 hover:bg-teal-700" disabled>
          <Sparkles className="w-4 h-4 mr-2" />
          AI Auto-Detect (Coming Soon)
        </Button>
      </div>
    </div>
  );
}
