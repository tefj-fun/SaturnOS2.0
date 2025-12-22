import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, CheckCircle, XCircle, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";

export default function LogicFlowVisualizer({ rules }) {
  const activeRules = rules.filter(r => r.is_active);

  const renderRuleContent = (rule) => {
    if (rule.rule_type === 'spatial') {
      const { subject_class, relationship, target_class, iou_operator, iou_value, coverage } = rule;
      const relString = relationship?.replace(/_/g, ' ') || '';
      return (
        <div className="space-y-2">
          <div className="text-xs font-bold text-center text-purple-600">SPATIAL RULE</div>
          <div className="flex flex-col items-center gap-1 text-sm">
             <Badge className="bg-purple-100 text-purple-800 text-xs">{subject_class}</Badge>
             <span className="text-xs text-gray-600">{relString}</span>
             <Badge className="bg-purple-100 text-purple-800 text-xs">{target_class}</Badge>
             {relationship === 'has_iou_with' ? (
              <Badge variant="outline" className="text-xs">{iou_operator} {iou_value}</Badge>
            ) : (
              <Badge variant="outline" className="text-xs">{coverage}% coverage</Badge>
            )}
          </div>
        </div>
      );
    }
    
    // Quantity/Existence Rule
    return (
      <div className="space-y-2">
        <div className="text-xs font-bold text-center text-blue-600">QUANTITY RULE</div>
        <div className="flex flex-col items-center gap-1 text-sm">
          <Badge className="bg-blue-100 text-blue-800 text-xs">{rule.condition}</Badge>
          <span className="text-xs text-gray-600">{rule.operator?.replace(/_/g, ' ')}</span>
          {rule.value && <Badge className="bg-blue-100 text-blue-800 text-xs">{rule.value}</Badge>}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-full shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-teal-600" />
          <span>Logic Flow Visualizer</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[calc(100%-72px)] p-4 overflow-y-auto">
        <div className="flex flex-col items-center space-y-4">
          {/* Start Node */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="w-12 h-12 bg-green-100 border-2 border-green-500 rounded-full flex items-center justify-center shadow-md">
              <Workflow className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-600 mt-1">START</span>
          </motion.div>

          {/* Rules Chain */}
          {activeRules.length > 0 ? (
            <>
              {activeRules.map((rule, index) => (
                <React.Fragment key={rule.id}>
                  {/* Arrow Down */}
                  <ArrowDown className="w-5 h-5 text-gray-400" />
                  
                  {/* Rule Node */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`w-full max-w-xs ${!rule.is_active ? 'opacity-50' : ''}`}
                  >
                    <Card className="bg-white border shadow-md">
                      <CardHeader className="p-3 pb-2">
                        <CardTitle className="text-sm text-center font-medium">
                          {rule.rule_name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-1 border-t border-gray-100">
                        {renderRuleContent(rule)}
                      </CardContent>
                    </Card>
                  </motion.div>
                </React.Fragment>
              ))}

              {/* Final Arrow */}
              <ArrowDown className="w-5 h-5 text-gray-400" />

              {/* Result Nodes */}
              <div className="flex items-center justify-center gap-8 mt-4">
                {/* Success Path */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: activeRules.length * 0.1 + 0.2 }}
                  className="flex flex-col items-center"
                >
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 border border-green-300 shadow-md">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Success</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">All rules pass</span>
                </motion.div>

                {/* Failure Path */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: activeRules.length * 0.1 + 0.3 }}
                  className="flex flex-col items-center"
                >
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-100 border border-red-300 shadow-md">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="font-medium text-red-800">Failure</span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">Any rule fails</span>
                </motion.div>
              </div>
            </>
          ) : (
            <>
              {/* Direct Arrow to Success when no rules */}
              <ArrowDown className="w-5 h-5 text-gray-400" />
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center"
              >
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-100 border border-green-300 shadow-md">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-green-800">Auto-Pass</span>
                </div>
                <span className="text-xs text-gray-500 mt-1">No rules defined</span>
              </motion.div>
            </>
          )}

          {/* Logic Explanation */}
          {activeRules.length > 0 && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200 w-full max-w-sm">
              <h4 className="font-semibold text-gray-800 text-sm mb-2">Logic Flow:</h4>
              <p className="text-xs text-gray-600 leading-relaxed">
                Each rule must evaluate to <span className="font-semibold text-green-600">true</span> for 
                the annotation to be considered successful. If any rule fails, the entire step fails.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
