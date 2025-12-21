import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Brain,
  Spline,
  CheckCircle,
  AlertTriangle,
  Loader2,
  PlayCircle,
  BarChart3
} from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function ModelStatusCard({ projectId, currentStep }) {
  const navigate = useNavigate();
  const [trainingRuns, setTrainingRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrainingRuns();
  }, [projectId]);

  const loadTrainingRuns = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    try {
      const runs = await TrainingRun.filter({ project_id: projectId }, '-created_date');
      setTrainingRuns(runs);
    } catch (error) {
      console.error('Error loading training runs:', error);
    }
    setIsLoading(false);
  };

  const latestRun = trainingRuns.length > 0 ? trainingRuns[0] : null;
  const completedRuns = trainingRuns.filter(run => run.status === 'completed');
  const activeRun = trainingRuns.find(run => ['queued', 'running'].includes(run.status));
  const latestCompletedRun = completedRuns.length > 0 ? completedRuns[0] : null;

  const getStatusInfo = () => {
    if (isLoading) {
      return {
        status: 'loading',
        title: 'Checking Model Status...',
        description: 'Loading training information',
        color: 'bg-gray-100 text-gray-700',
        icon: Loader2
      };
    }

    if (activeRun) {
      return {
        status: 'training',
        title: 'Model Training in Progress',
        description: `Training run "${activeRun.run_name}" is currently ${activeRun.status}`,
        color: 'bg-blue-100 text-blue-700',
        icon: Loader2,
        animated: true
      };
    }

    if (completedRuns.length > 0) {
      const bestRun = completedRuns[0]; // Most recent completed run
      return {
        status: 'ready',
        title: 'Model Ready',
        description: `Latest model: ${bestRun.run_name}`,
        color: 'bg-green-100 text-green-700',
        icon: CheckCircle,
        metrics: bestRun.results
      };
    }

    return {
      status: 'not_trained',
      title: 'No Model Trained',
      description: 'Train a model to enable AI-assisted annotation',
      color: 'bg-amber-100 text-amber-700',
      icon: AlertTriangle
    };
  };

  const statusInfo = getStatusInfo();

  const stepId = currentStep?.id || currentStep;

  const getTrainingConfigUrl = () => {
    if (stepId) {
      return createPageUrl(`TrainingConfiguration?projectId=${projectId}&stepId=${stepId}`);
    }
    return createPageUrl(`TrainingConfiguration?projectId=${projectId}`);
  };

  const handleTrainModel = () => {
    navigate(getTrainingConfigUrl());
  };

  const handleViewRun = (run) => {
    if (run?.id) {
      navigate(createPageUrl(`TrainingStatus?runId=${run.id}`));
      return;
    }
    handleTrainModel();
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusInfo.color}`}>
            <statusInfo.icon className={`w-4 h-4 ${statusInfo.animated ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="text-gray-900">{statusInfo.title}</div>
            <div className="text-sm text-gray-600 font-normal">{statusInfo.description}</div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Status Details */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={statusInfo.color}>
                {statusInfo.status === 'ready' ? 'Model Ready' : 
                 statusInfo.status === 'training' ? 'Training' :
                 statusInfo.status === 'loading' ? 'Loading' : 'Not Trained'}
              </Badge>
              {completedRuns.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {completedRuns.length} model{completedRuns.length !== 1 ? 's' : ''} trained
                </Badge>
              )}
            </div>
          </div>

          {/* Metrics for completed models */}
          {statusInfo.status === 'ready' && statusInfo.metrics && (
            <div className="grid grid-cols-3 gap-2 p-2 bg-gray-50 rounded-md">
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  {(statusInfo.metrics.mAP * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600">mAP</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  {(statusInfo.metrics.precision * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600">Precision</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-gray-900">
                  {(statusInfo.metrics.recall * 100).toFixed(1)}%
                </div>
                <div className="text-xs text-gray-600">Recall</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {statusInfo.status === 'not_trained' && (
              <Button 
                onClick={handleTrainModel}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Spline className="w-4 h-4 mr-2" />
                Train Model
              </Button>
            )}
            
            {statusInfo.status === 'ready' && (
              <>
                <Button 
                  onClick={() => handleViewRun(latestCompletedRun || latestRun)}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Training
                </Button>
                <Button 
                  onClick={handleTrainModel}
                  variant="outline"
                  size="sm"
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Retrain
                </Button>
              </>
            )}

            {statusInfo.status === 'training' && (
              <Button 
                onClick={() => handleViewRun(activeRun)}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                View Progress
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
