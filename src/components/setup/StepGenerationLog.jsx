import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Brain,
  FileText,
  Search,
  Lightbulb,
  Users,
  CheckCircle,
  Sparkles,
  Eye,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LOG_MESSAGES = [
  { 
    icon: FileText, 
    message: "Opening SOP document...", 
    type: "info",
    duration: 1000 
  },
  { 
    icon: Eye, 
    message: "Reading through the document structure...", 
    type: "processing",
    duration: 1500 
  },
  { 
    icon: Search, 
    message: "Scanning for procedural steps...", 
    type: "processing",
    duration: 2000 
  },
  { 
    icon: Brain, 
    message: "Thinking deeply about the workflow...", 
    type: "thinking",
    duration: 2500 
  },
  { 
    icon: Lightbulb, 
    message: "Identifying UI components and interactions...", 
    type: "discovery",
    duration: 2000 
  },
  { 
    icon: Users, 
    message: "Consulting with annotation experts...", 
    type: "expert",
    duration: 1800 
  },
  { 
    icon: Zap, 
    message: "Analyzing business logic patterns...", 
    type: "analysis",
    duration: 2200 
  },
  { 
    icon: Sparkles, 
    message: "Generating annotation classes...", 
    type: "generation",
    duration: 2000 
  },
  { 
    icon: Brain, 
    message: "Cross-referencing with best practices...", 
    type: "validation",
    duration: 1500 
  },
  { 
    icon: CheckCircle, 
    message: "Finalizing step definitions...", 
    type: "completion",
    duration: 1000 
  }
];

const RANDOM_THINKING_MESSAGES = [
  { icon: Brain, message: "Hmm, this is an interesting workflow...", type: "thinking" },
  { icon: Lightbulb, message: "Found some complex UI patterns here...", type: "discovery" },
  { icon: Search, message: "Looking for hidden annotation opportunities...", type: "processing" },
  { icon: Users, message: "What would a senior annotator do here?", type: "expert" },
  { icon: Sparkles, message: "This section has great annotation potential!", type: "generation" },
  { icon: Zap, message: "Detecting some tricky edge cases...", type: "analysis" },
  { icon: Eye, message: "Reviewing for annotation completeness...", type: "validation" }
];

export default function StepGenerationLog({ isGenerating, onComplete }) {
  const [logs, setLogs] = useState([]);
  const scrollAreaRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom whenever new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: "smooth", 
        block: "end" 
      });
    }
  }, [logs]);

  useEffect(() => {
    if (!isGenerating) {
      setLogs([]);
      return;
    }

    // Start the log sequence
    const processMessages = async () => {
      // Process main messages
      for (let i = 0; i < LOG_MESSAGES.length; i++) {
        const message = LOG_MESSAGES[i];
        
        // Add message to log
        setLogs(prev => [...prev, {
          ...message,
          id: Date.now() + i,
          timestamp: new Date()
        }]);
        
        // Wait for the specified duration
        await new Promise(resolve => setTimeout(resolve, message.duration));
      }
      
      // After main messages, show random thinking messages
      
      // Add a few random messages
      for (let i = 0; i < 3; i++) {
        const randomMessage = RANDOM_THINKING_MESSAGES[
          Math.floor(Math.random() * RANDOM_THINKING_MESSAGES.length)
        ];
        
        setLogs(prev => [...prev, {
          ...randomMessage,
          id: Date.now() + LOG_MESSAGES.length + i,
          timestamp: new Date()
        }]);
        
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      }
      
      // Final completion message
      setLogs(prev => [...prev, {
        icon: CheckCircle,
        message: "✨ Step generation complete! Ready for review.",
        type: "success",
        id: Date.now() + 999,
        timestamp: new Date()
      }]);
      
      // Notify parent component
      setTimeout(() => {
        onComplete?.();
      }, 500);
    };

    processMessages();
  }, [isGenerating, onComplete]);

  const getTypeColor = (type) => {
    const colors = {
      info: "bg-blue-100 text-blue-800",
      processing: "bg-purple-100 text-purple-800",
      thinking: "bg-amber-100 text-amber-800",
      discovery: "bg-green-100 text-green-800",
      expert: "bg-indigo-100 text-indigo-800",
      analysis: "bg-pink-100 text-pink-800",
      generation: "bg-teal-100 text-teal-800",
      validation: "bg-orange-100 text-orange-800",
      completion: "bg-gray-100 text-gray-800",
      success: "bg-emerald-100 text-emerald-800"
    };
    return colors[type] || colors.info;
  };

  if (!isGenerating && logs.length === 0) {
    return null;
  }

  return (
    <Card className="glass-effect border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-teal-600 animate-pulse" />
          AI Generation Log
          {isGenerating && (
            <Badge className="bg-teal-100 text-teal-800 border-teal-200 animate-pulse">
              Processing...
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea ref={scrollAreaRef} className="h-64 pr-4">
          <div className="space-y-3">
            <AnimatePresence>
            {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.type === 'success' ? 'bg-emerald-100' : 'bg-gray-100'
                  }`}>
                    <log.icon className={`w-4 h-4 ${
                      log.type === 'success' ? 'text-emerald-600' : 'text-gray-600'
                    }`} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${getTypeColor(log.type)} border-0 text-xs`}>
                        {log.type}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {log.timestamp.toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {log.message}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Active indicator for current processing */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 mt-4 p-3 bg-teal-50 rounded-lg border border-teal-200"
              >
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
                <span className="text-sm text-teal-700 font-medium">
                  AI is working...
                </span>
              </motion.div>
            )}
            
            {/* Invisible element to scroll to */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        
        {logs.length > 0 && !isGenerating && (
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                Generation completed successfully!
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
