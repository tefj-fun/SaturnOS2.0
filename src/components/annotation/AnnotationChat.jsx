import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Layers // Added icon
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
  onActiveClassChange
}) {
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAIThinking]);

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
      id: 'select',
      label: 'Select',
      icon: Target,
      description: 'Click to select'
    },
    {
      id: 'draw',
      label: 'Draw',
      icon: Square,
      description: 'Draw boxes'
    },
    {
      id: 'move',
      label: 'Adjust',
      icon: MousePointer2,
      description: 'Move & resize'
    }
  ];

  const quickResponses = [
    "I need help finding this element",
    "What should I look for?",
    "The instructions are unclear",
    "I've completed the annotation",
    "Can you explain the business logic?"
  ];

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

      {/* Chat Messages */}
      <ScrollArea className="flex-1 p-4">
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
      </ScrollArea>

      {/* Current Step Info */}
      {currentStep && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <div className="mb-4">
             <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-teal-700" />
              <span className="font-semibold text-sm text-gray-900">1. Select Class to Annotate</span>
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {(currentStep.classes || []).map(cls => (
                   <Button
                      key={cls}
                      variant={activeClass === cls ? "default" : "outline"}
                      size="sm"
                      onClick={() => onActiveClassChange(cls)}
                      className={`text-sm h-8 px-3 rounded-full transition-all duration-200 ${
                        activeClass === cls 
                          ? "bg-teal-600 hover:bg-teal-700 shadow-md" 
                          : "bg-white hover:bg-gray-100"
                      }`}
                   >
                     {cls}
                   </Button>
                ))}
              </div>
            </div>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs mt-3">
              Label as: {currentStep.status}
            </Badge>
          </div>
          
          <Separator className="my-4" />

          {/* Annotation Tools */}
           <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-teal-700" />
                <span className="font-semibold text-sm text-gray-900">2. Choose Tool</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
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
          
          <Separator className="my-4" />

          {/* Quick Responses */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-2 mb-3">
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

      {/* Chat Input */}
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