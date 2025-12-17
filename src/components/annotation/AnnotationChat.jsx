
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { 
  Bot,
  Send,
  User,
  AlertTriangle,
  Target,
  Square,
  MousePointer2,
  Lightbulb,
  Sparkles,
  Layers,
  Palette,
  ChevronUp, // Added for collapse/expand
  ChevronDown, // Added for collapse/expand
  Pin, // Added for pinning
  PinOff, // Added for unpinning
  Spline, // For Polygon tool
  Brush // For Brush tool
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AnnotationChat({ 
  messages, 
  onSendMessage, 
  isAIThinking, 
  currentStep,
  onAnnotationModeChange,
  annotationMode,
  activeClass,
  onActiveClassChange,
  brushSize,
  onBrushSizeChange,
  projectId // Add projectId prop
}) {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAIThinking]);

  // Fix for Persistent Annotation Selection: Reset annotation mode and active class when current step changes
  useEffect(() => {
    if (currentStep) {
      // Default to 'draw' mode whenever a new step is loaded
      onAnnotationModeChange('draw'); 
      // Select the first available class for the new step, or set to null if no classes
      if (currentStep.classes && currentStep.classes.length > 0) {
        onActiveClassChange(currentStep.classes[0]);
      } else {
        onActiveClassChange(null);
      }
    }
  }, [currentStep, onAnnotationModeChange, onActiveClassChange]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;
    
    onSendMessage(inputMessage);
    setInputMessage("");
  };

  const handleQuickResponse = (response) => {
    onSendMessage(response);
  };

  const getStepGuidance = () => {
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

  const stepGuidance = getStepGuidance();

  const annotationModes = [
    {
      id: 'draw',
      label: 'Box',
      icon: Square,
      description: 'Draw boxes'
    },
    {
      id: 'polygon',
      label: 'Polygon',
      icon: Spline,
      description: 'Draw custom shapes'
    },
    {
      id: 'brush',
      label: 'Brush',
      icon: Brush,
      description: 'Paint an area'
    },
    {
      id: 'move',
      label: 'Adjust',
      icon: MousePointer2,
      description: 'Select, Move & Resize'
    }
  ];

  const quickResponses = [
    "I need help finding this element",
    "What should I look for?",
    "The instructions are unclear",
    "I've completed the annotation",
    "Can you explain the business logic?"
  ];
  
  const isExpanded = isPinned || isHovered;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">AI Assistant</h2>
            <p className="text-xs text-gray-600">Live annotation guidance</p>
          </div>
        </div>
      </div>

      {/* Removed ModelStatusCard section */}

      {/* Static Controls Section */}
      {currentStep && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          {/* Current Step Context */}
          <div 
            className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 transition-all duration-200"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-700" />
                <span className="font-semibold text-xs text-blue-900">Current Step Goal</span>
              </div>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPinned(!isPinned);
                }}
              >
                  {isPinned ? <Pin className="h-4 w-4 text-blue-700" /> : <PinOff className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
            
            <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-2">
                  <div>
                    <h3 className="font-semibold text-blue-900 text-sm mb-1">
                      {currentStep.title}
                    </h3>
                    {currentStep.description && (
                      <p className="text-blue-800 text-xs">
                        {currentStep.description}
                      </p>
                    )}
                  </div>

                  {(currentStep.condition || currentStep.business_logic) && (
                    <div>
                      <span className="text-xs font-medium text-blue-700">BUSINESS LOGIC:</span>
                      <p className="text-blue-800 text-xs mt-1 bg-white/50 p-2 rounded">
                        {currentStep.business_logic || currentStep.condition}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-blue-700">TARGET STATUS:</span>
                    <Badge className="bg-blue-600 text-white text-xs">
                      {currentStep.status}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Annotation Tools */}
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-teal-700" />
              <span className="font-semibold text-sm text-gray-900">1. Choose Tool</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {annotationModes.map((mode) => (
                <Button
                  key={mode.id}
                  variant={annotationMode === mode.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => onAnnotationModeChange(mode.id)}
                  className={`h-auto p-2 ${
                    annotationMode === mode.id 
                      ? "bg-teal-600 hover:bg-teal-700 text-white" 
                      : "hover:bg-gray-100 bg-white"
                  }`}
                >
                  <div className="text-center">
                    <mode.icon className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs">{mode.label}</div>
                  </div>
                </Button>
              ))}
            </div>
          </div>
          
          {/* Brush Size Slider */}
          <AnimatePresence>
            {annotationMode === 'brush' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="mt-3">
                  <label className="font-semibold text-sm text-gray-900 mb-2 block">Brush Size: <span className="text-teal-700">{brushSize}px</span></label>
                  <Slider
                    value={[brushSize]}
                    onValueChange={(value) => onBrushSizeChange(value[0])}
                    max={50}
                    min={2}
                    step={1}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Class Selector */}
          <div className="mb-3 mt-3">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-teal-700" />
              <span className="font-semibold text-sm text-gray-900">2. Select Class</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(currentStep.classes || []).map(cls => (
                 <Button
                    key={cls}
                    variant={activeClass === cls ? "default" : "outline"}
                    size="sm"
                    onClick={() => onActiveClassChange(cls)}
                    className={`h-auto text-xs py-1 px-3 rounded-full transition-all duration-200 ${
                      activeClass === cls
                        ? "bg-teal-600 hover:bg-teal-700 shadow-md text-white"
                        : "bg-white hover:bg-gray-100"
                    }`}
                 >
                   {cls}
                 </Button>
              ))}
            </div>
          </div>

          {/* Quick Responses */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-teal-700" />
                <span className="font-semibold text-sm text-gray-900">3. Ask for Help</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {quickResponses.slice(0, 3).map((response, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickResponse(response)}
                  className="text-xs h-7 px-2 bg-white"
                >
                  {response}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Chat Messages Area */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-start gap-3 ${
                    message.type === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.type === 'ai' 
                      ? 'bg-teal-100 text-teal-600' 
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    {message.type === 'ai' ? (
                      <Bot className="w-4 h-4" />
                    ) : (
                      <User className="w-4 h-4" />
                    )}
                  </div>
                  
                  <div className={`flex-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                    <div className={`inline-block p-3 rounded-lg max-w-xs ${
                      message.type === 'ai'
                        ? 'bg-white border border-gray-200 text-gray-900'
                        : 'bg-blue-600 text-white'
                    }`}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {message.timestamp.toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isAIThinking && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3"
              >
                <div className="w-8 h-8 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="inline-block p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                      <span className="text-xs text-gray-500">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
      </ScrollArea>

      {/* Fixed Chat Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask for help or clarification..."
            className="flex-1 text-sm"
            disabled={isAIThinking}
          />
          <Button
            type="submit"
            size="sm"
            disabled={!inputMessage.trim() || isAIThinking}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
