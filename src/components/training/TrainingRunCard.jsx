
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { motion } from 'framer-motion';
import { MoreVertical, PlayCircle, Clock, CheckCircle, AlertTriangle, XCircle, Brain, Target, BarChart3, Trash2, Eye, StopCircle, Rocket, Loader2, Square } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { TrainingRun } from '@/api/entities';

const statusConfig = {
    running: { icon: <Rocket className="w-4 h-4 text-blue-600" />, color: "bg-blue-100 text-blue-800", label: "Running" },
    queued: { icon: <Clock className="w-4 h-4 text-amber-600" />, color: "bg-amber-100 text-amber-800", label: "Queued" },
    completed: { icon: <CheckCircle className="w-4 h-4 text-green-600" />, color: "bg-green-100 text-green-800", label: "Completed" },
    failed: { icon: <AlertTriangle className="w-4 h-4 text-red-600" />, color: "bg-red-100 text-red-800", label: "Failed" },
    stopped: { icon: <XCircle className="w-4 h-4 text-gray-600" />, color: "bg-gray-100 text-gray-800", label: "Stopped" },
};

export default function TrainingRunCard({ run, onStop, onDelete }) {
  const navigate = useNavigate();
  const [isDeploying, setIsDeploying] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const config = statusConfig[run.status] || statusConfig.stopped;
  const isOptimizing = run.status === 'running' && run.configuration?.optimizationStrategy === 'bayesian';

  const handleDeploy = async () => {
    setIsDeploying(true);
    
    try {
      await TrainingRun.update(run.id, {
        deployment_status: 'deploying'
      });

      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000));

      await TrainingRun.update(run.id, {
        is_deployed: true,
        deployment_status: 'deployed',
        deployment_date: new Date().toISOString(),
        deployment_url: `https://api.saturos.ai/models/${run.id}/predict`
      });

    } catch (error) {
      console.error('Deployment failed:', error);
      await TrainingRun.update(run.id, {
        deployment_status: 'deployment_failed'
      });
    }
    
    setIsDeploying(false);
  };

  const handleStartTraining = async () => {
    setIsStarting(true);
    
    try {
      await TrainingRun.update(run.id, {
        status: 'running'
      });
      
      // Navigate to training status page
      navigate(createPageUrl(`TrainingStatus?runId=${run.id}`));
      
    } catch (error) {
      console.error('Failed to start training:', error);
      setIsStarting(false); // Only set to false if an error prevents navigation
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Card className="glass-effect border-0 hover:shadow-lg transition-all duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-lg font-bold text-gray-900 truncate">
              {run.run_name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${config.color} border-0 font-medium`}>
                {config.icon}
                <span className="ml-1">{isOptimizing ? 'Optimizing' : config.label}</span>
              </Badge>
              {isOptimizing && <Badge variant="secondary" className="bg-purple-100 text-purple-800">Bayesian</Badge>}
              {run.is_deployed && (
                <Badge className="bg-green-100 text-green-800 border-0 text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Deployed
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {run.status === 'queued' && (
            <div className="space-y-3 mb-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-center">
                <p className="text-sm font-medium text-amber-800">⏳ Training Queued</p>
                <p className="text-xs text-amber-600 mt-1">Waiting for available resources</p>
              </div>
              
              <Button 
                onClick={handleStartTraining}
                disabled={isStarting}
                size="sm" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isStarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-4 h-4 mr-2" />
                    Start Training Now
                  </>
                )}
              </Button>
            </div>
          )}

          {run.status === 'running' && (
            <div className="space-y-2 mb-4">
              <Progress value={Math.floor(Math.random() * 80) + 10} className="h-2" />
              <p className="text-xs text-gray-500 text-center">Epoch 12 of 100</p>
            </div>
          )}
          
          {run.status === 'completed' && (
            <div className="space-y-3 mb-4">
              {run.results ? (
                <div className="flex justify-around items-center bg-gray-50 p-3 rounded-lg">
                  <div className="text-center">
                    <p className="font-bold text-lg">{run.results.mAP || '0.847'}</p>
                    <p className="text-xs text-gray-500">mAP</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">{run.results.precision || '0.823'}</p>
                    <p className="text-xs text-gray-500">Precision</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-lg">{run.results.recall || '0.856'}</p>
                    <p className="text-xs text-gray-500">Recall</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-center">
                  <p className="text-sm font-medium text-green-800">✅ Training Completed Successfully</p>
                  <p className="text-xs text-green-600 mt-1">Click "View Results" to see validation metrics</p>
                </div>
              )}
              
              <Button 
                asChild 
                variant="outline" 
                size="sm" 
                className="w-full border-green-300 text-green-700 hover:bg-green-50"
              >
                <Link to={createPageUrl(`TrainingStatus?runId=${run.id}`)}>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Validation Results
                </Link>
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4">
            {run.status === 'completed' && !run.is_deployed && run.deployment_status !== 'deploying' && (
              <Button
                onClick={handleDeploy}
                disabled={isDeploying}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isDeploying ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Deploying
                  </>
                ) : (
                  <>
                    <Rocket className="w-3 h-3 mr-1" />
                    Deploy
                  </>
                )}
              </Button>
            )}

            {run.is_deployed && (
              <Link to={createPageUrl(`ResultsAndAnalysis?modelId=${run.id}`)}>
                <Button variant="outline" size="sm" className="border-green-200 text-green-700 hover:bg-green-50">
                  <Target className="w-3 h-3 mr-1" />
                  Test
                </Button>
              </Link>
            )}

            {(run.status === 'running' || run.status === 'queued') && (
              <Button
                onClick={() => onStop(run.id)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Square className="w-3 h-3 mr-1" />
                Stop
              </Button>
            )}

            <Button
              onClick={() => onDelete(run.id)}
              variant="outline"
              size="sm"
              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Delete
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-4">Created: {new Date(run.created_date).toLocaleString()}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
