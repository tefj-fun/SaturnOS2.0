import React, { useState, useEffect } from "react";
import { PredictedAnnotation } from "@/api/entities";
import { Project } from "@/api/entities";
import { User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, ShieldCheck, ShieldAlert, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AnnotationReviewPage() {
  const [predictions, setPredictions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [action, setAction] = useState(null); // 'accept' or 'reject'

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      try {
        await User.me();
        setIsAuthenticated(true);
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('projectId');
        if (projectId) {
          loadData(projectId);
        }
      } catch (error) {
        setIsAuthenticated(false);
        setIsLoading(false);
      }
    };
    checkAuthAndLoad();
  }, []);

  const loadData = async (projectId) => {
    setIsLoading(true);
    try {
      const [projectData, preds] = await Promise.all([
        Project.filter({ id: projectId }),
        PredictedAnnotation.filter({ project_id: projectId, review_status: 'pending' }, '-confidence_score', 50)
      ]);
      setProject(projectData.length > 0 ? projectData[0] : null);
      setPredictions(preds);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setIsLoading(false);
  };

  const handleReview = async (predictionId, status) => {
    if (action) return; // Prevent multiple clicks

    setAction(status);

    await PredictedAnnotation.update(predictionId, { review_status: status });
    
    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setAction(null);
    }, 300); // Wait for animation
  };

  const handleLogin = () => {
    User.loginWithRedirect(window.location.href);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-gray-100 flex items-center justify-center p-8">
        <Card className="text-center p-8 max-w-sm">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-6">Please log in to review annotations.</p>
          <Button onClick={handleLogin} size="lg" className="w-full bg-teal-600 hover:bg-teal-700">
            Log In
          </Button>
        </Card>
      </div>
    );
  }

  const currentPrediction = predictions[currentIndex];

  return (
    <div className="fixed inset-0 bg-gray-100 flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Header */}
      <div className="w-full max-w-sm text-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{project?.name}</h1>
        <p className="text-gray-600">Review AI Predictions</p>
      </div>
      
      {/* Card Stack */}
      <div className="relative w-full max-w-sm h-[70vh] flex items-center justify-center">
        <AnimatePresence>
          {currentPrediction ? (
            <motion.div
              key={currentPrediction.id}
              className="absolute w-full h-full"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{
                x: action === 'accept' ? 500 : -500,
                opacity: 0,
                scale: 0.8,
                transition: { duration: 0.3 }
              }}
            >
              <Card className="w-full h-full overflow-hidden shadow-2xl flex flex-col">
                <div className="relative flex-1 bg-gray-200">
                  <img src={currentPrediction.image_url} className="w-full h-full object-contain" alt="Annotation subject" />
                  <div
                    className="absolute border-4 border-yellow-400 bg-yellow-400 bg-opacity-20"
                    style={{
                      left: `${currentPrediction.bounding_box.x}%`,
                      top: `${currentPrediction.bounding_box.y}%`,
                      width: `${currentPrediction.bounding_box.width}%`,
                      height: `${currentPrediction.bounding_box.height}%`,
                    }}
                  />
                </div>
                <CardContent className="p-4 border-t-2">
                  <Badge className="mb-2">
                    Class: {currentPrediction.predicted_class}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {currentPrediction.confidence_score > 0.7 ? <ShieldCheck className="w-5 h-5 text-green-600"/> : <ShieldAlert className="w-5 h-5 text-amber-500"/>}
                    <p className="text-gray-700">
                      AI Confidence: <span className="font-bold">{Math.round(currentPrediction.confidence_score * 100)}%</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card className="p-8 text-center">
                <Layers className="w-12 h-12 text-teal-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold">All Done!</h2>
                <p className="text-gray-600 mt-2">There are no more predictions to review for this project right now.</p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Action Buttons */}
      <div className="w-full max-w-sm mt-6 flex justify-around">
        <Button
          size="lg"
          variant="outline"
          className="w-24 h-24 rounded-full bg-white shadow-lg border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
          onClick={() => currentPrediction && handleReview(currentPrediction.id, 'rejected')}
          disabled={!currentPrediction || !!action}
        >
          <X className="w-12 h-12" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-24 h-24 rounded-full bg-white shadow-lg border-green-500 text-green-500 hover:bg-green-50 hover:text-green-600"
          onClick={() => currentPrediction && handleReview(currentPrediction.id, 'accepted')}
          disabled={!currentPrediction || !!action}
        >
          <Check className="w-12 h-12" />
        </Button>
      </div>
    </div>
  );
}