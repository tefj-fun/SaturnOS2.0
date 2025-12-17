import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { PredictedAnnotation } from '@/api/entities';
import { StepImage } from '@/api/entities';
import { LogicRule } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  ChevronLeft, 
  ChevronRight, 
  PenTool, 
  Check, 
  X, 
  Wand2, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Target,
  BarChart3,
  Image as ImageIcon,
  MousePointer
} from 'lucide-react';
import { createPageUrl } from '@/utils';

// Mock data for demonstration
const MOCK_VALIDATION_IMAGES = [
  { id: 'img1', image_url: 'https://images.unsplash.com/photo-1588336142586-3642324c2f48?w=800', name: 'dashboard_001.jpg' },
  { id: 'img2', image_url: 'https://images.unsplash.com/photo-1563520239483-199b95d87c33?w=800', name: 'dashboard_002.jpg' },
  { id: 'img3', image_url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800', name: 'dashboard_003.jpg' },
  { id: 'img4', image_url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800', name: 'dashboard_004.jpg' },
  { id: 'img5', image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', name: 'dashboard_005.jpg' },
];

const MOCK_PREDICTIONS = {
  img1: [
    { id: 'p1', bounding_box: { x: 50, y: 100, width: 120, height: 80 }, predicted_class: 'Button', confidence_score: 0.92, match: 'true_positive' },
    { id: 'p2', bounding_box: { x: 200, y: 250, width: 100, height: 70 }, predicted_class: 'Label', confidence_score: 0.85, match: 'true_positive' },
    { id: 'p3', bounding_box: { x: 350, y: 150, width: 90, height: 60 }, predicted_class: 'Checkbox', confidence_score: 0.76, match: 'false_positive' },
  ],
  img2: [
    { id: 'p4', bounding_box: { x: 100, y: 120, width: 150, height: 100 }, predicted_class: 'Input Field', confidence_score: 0.88, match: 'true_positive' },
    { id: 'p5', bounding_box: { x: 300, y: 200, width: 80, height: 60 }, predicted_class: 'Button', confidence_score: 0.65, match: 'false_positive' },
  ],
  img3: [
    { id: 'p6', bounding_box: { x: 150, y: 180, width: 120, height: 90 }, predicted_class: 'Label', confidence_score: 0.72, match: 'false_positive' },
  ],
  img4: [
    { id: 'p7', bounding_box: { x: 80, y: 150, width: 100, height: 70 }, predicted_class: 'Input Field', confidence_score: 0.81, match: 'true_positive' },
  ],
  img5: [
    { id: 'p8', bounding_box: { x: 120, y: 100, width: 110, height: 80 }, predicted_class: 'Checkbox', confidence_score: 0.89, match: 'true_positive' },
  ],
};

const MOCK_GROUND_TRUTH = {
  img1: [
    { id: 'gt1', bounding_box: { x: 55, y: 105, width: 120, height: 80 }, class: 'Button' },
    { id: 'gt2', bounding_box: { x: 205, y: 255, width: 100, height: 70 }, class: 'Label' },
  ],
  img2: [
    { id: 'gt3', bounding_box: { x: 105, y: 125, width: 150, height: 100 }, class: 'Input Field' },
  ],
  img3: [
    { id: 'gt4', bounding_box: { x: 80, y: 200, width: 110, height: 90 }, class: 'Button', match: 'false_negative' },
  ],
  img4: [
    { id: 'gt5', bounding_box: { x: 85, y: 155, width: 100, height: 70 }, class: 'Input Field' },
  ],
  img5: [
    { id: 'gt6', bounding_box: { x: 125, y: 105, width: 110, height: 80 }, class: 'Checkbox' },
  ],
};

// Mock logic rule validation results
const MOCK_LOGIC_RESULTS = [
  {
    id: 'rule1',
    rule_name: 'Exactly 2 Buttons Required',
    rule_type: 'quantity',
    condition: 'Button',
    operator: 'equals',
    value: '2',
    pass_rate: 0.60, // 60% of images passed this rule
    failed_images: ['img2', 'img3'], // Images that failed this rule
    details: 'Failed because model detected wrong number of buttons'
  },
  {
    id: 'rule2', 
    rule_name: 'Input Field Must Exist',
    rule_type: 'quantity',
    condition: 'Input Field',
    operator: 'exists',
    value: '',
    pass_rate: 0.80,
    failed_images: ['img3'],
    details: 'Model missed input fields in some images'
  },
  {
    id: 'rule3',
    rule_name: 'Label Within Form Area',
    rule_type: 'spatial',
    subject_class: 'Label',
    relationship: 'is_within',
    target_class: 'Form',
    coverage: 80,
    pass_rate: 0.40,
    failed_images: ['img1', 'img2', 'img5'],
    details: 'Spatial relationship detection needs improvement'
  }
];

// Generate confusion matrix data with image references
const generateConfusionMatrixWithImages = () => {
  const classes = ['Button', 'Input Field', 'Label', 'Checkbox', 'Dropdown'];
  const confusionData = [];
  
  classes.forEach(actualClass => {
    classes.forEach(predictedClass => {
      const isCorrect = actualClass === predictedClass;
      const count = isCorrect ? Math.floor(Math.random() * 25) + 15 : Math.floor(Math.random() * 8) + 1;
      
      // Generate mock image references for incorrect predictions
      const incorrectImages = [];
      if (!isCorrect && count > 0) {
        const numIncorrectImages = Math.min(count, 3); // Show up to 3 example images
        for (let i = 0; i < numIncorrectImages; i++) {
          incorrectImages.push({
            id: MOCK_VALIDATION_IMAGES[i % MOCK_VALIDATION_IMAGES.length].id,
            url: MOCK_VALIDATION_IMAGES[i % MOCK_VALIDATION_IMAGES.length].image_url,
            name: MOCK_VALIDATION_IMAGES[i % MOCK_VALIDATION_IMAGES.length].name,
            confidence: Math.random() * 0.4 + 0.3 // Low confidence for incorrect predictions
          });
        }
      }
      
      confusionData.push({
        actual: actualClass,
        predicted: predictedClass,
        count,
        isCorrect,
        incorrectImages
      });
    });
  });
  
  return confusionData;
};

const BoundingBox = ({ box, color, label }) => (
  <div
    className={`absolute border-2 ${color}`}
    style={{
      left: `${box.x}px`,
      top: `${box.y}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    }}
  >
    <div className={`absolute -top-6 left-0 text-xs px-1 rounded-sm ${color.replace('border-', 'bg-').replace('text-white', '')} text-white`}>
      {label}
    </div>
  </div>
);

const InteractiveConfusionMatrix = ({ data, classes, onCellClick }) => {
  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div className="w-full">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-600">Click on any cell to see example images</p>
      </div>
      <div className="grid grid-cols-6 gap-1 text-xs">
        <div className="text-center font-bold text-gray-700 p-2">Actual →<br/>Predicted ↓</div>
        {classes.map(cls => (
          <div key={cls} className="text-center font-medium text-gray-600 p-2 rotate-45 origin-center">{cls}</div>
        ))}
        {classes.map((predictedClass, i) => (
          <React.Fragment key={predictedClass}>
            <div className="text-right font-medium text-gray-600 p-2 flex items-center justify-end">{predictedClass}</div>
            {classes.map(actualClass => {
              const cell = data.find(d => d.actual === actualClass && d.predicted === predictedClass);
              const intensity = cell ? cell.count / maxCount : 0;
              const isCorrect = actualClass === predictedClass;
              
              return (
                <button
                  key={`${actualClass}-${predictedClass}`}
                  onClick={() => onCellClick(cell)}
                  className={`aspect-square flex items-center justify-center text-xs font-medium rounded transition-all hover:scale-110 hover:shadow-lg cursor-pointer ${
                    isCorrect 
                      ? `bg-green-${Math.floor(intensity * 400) + 100} hover:bg-green-${Math.floor(intensity * 400) + 200} text-green-800` 
                      : cell && cell.count > 0
                        ? `bg-red-${Math.floor(intensity * 400) + 100} hover:bg-red-${Math.floor(intensity * 400) + 200} text-red-800`
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-400'
                  }`}
                  title={`${actualClass} → ${predictedClass}: ${cell ? cell.count : 0} cases${!isCorrect && cell && cell.count > 0 ? ' (Click to see examples)' : ''}`}
                >
                  {cell ? cell.count : 0}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const ImageErrorDialog = ({ cell, open, onClose }) => {
  if (!cell || !cell.incorrectImages || cell.incorrectImages.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Classification Errors: {cell.actual} → {cell.predicted}
          </DialogTitle>
          <DialogDescription>
            The model incorrectly predicted "{cell.predicted}" when the actual class was "{cell.actual}" in these {cell.count} cases.
            Here are some example images:
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {cell.incorrectImages.map((image, index) => (
            <Card key={index} className="border-red-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{image.name}</span>
                  <Badge variant="destructive" className="text-xs">
                    Confidence: {Math.round(image.confidence * 100)}%
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <img 
                  src={image.url} 
                  alt={image.name}
                  className="w-full h-32 object-cover rounded border"
                />
                <div className="mt-2 text-xs text-gray-600">
                  <p><span className="font-medium">Ground Truth:</span> {cell.actual}</p>
                  <p><span className="font-medium">Predicted:</span> {cell.predicted}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <Alert className="mt-4 border-blue-200 bg-blue-50">
          <Wand2 className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Recommendation:</strong> Review these images in the annotation studio. 
            Consider adding more similar examples or refining the class definitions to improve model performance.
          </AlertDescription>
        </Alert>
      </DialogContent>
    </Dialog>
  );
};

const LogicRuleCard = ({ rule }) => {
  const passRate = Math.round(rule.pass_rate * 100);
  const isGoodPerformance = passRate >= 80;
  const isOkPerformance = passRate >= 60;
  
  return (
    <Card className={`border-l-4 ${
      isGoodPerformance ? 'border-l-green-500 bg-green-50' : 
      isOkPerformance ? 'border-l-yellow-500 bg-yellow-50' : 
      'border-l-red-500 bg-red-50'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{rule.rule_name}</CardTitle>
          <div className="flex items-center gap-2">
            {isGoodPerformance ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600" />
            )}
            <Badge variant={isGoodPerformance ? "default" : "destructive"} className="bg-white">
              {passRate}% Pass Rate
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Performance</span>
            <span className={`font-medium ${isGoodPerformance ? 'text-green-700' : isOkPerformance ? 'text-yellow-700' : 'text-red-700'}`}>
              {rule.failed_images.length}/{MOCK_VALIDATION_IMAGES.length} images failed
            </span>
          </div>
          <Progress 
            value={passRate} 
            className={`h-2 ${
              isGoodPerformance ? '[&>div]:bg-green-600' : 
              isOkPerformance ? '[&>div]:bg-yellow-600' : 
              '[&>div]:bg-red-600'
            }`} 
          />
          <p className="text-sm text-gray-600">{rule.details}</p>
          
          {rule.failed_images.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">Failed on images:</p>
              <div className="flex flex-wrap gap-1">
                {rule.failed_images.slice(0, 3).map(imageId => {
                  const image = MOCK_VALIDATION_IMAGES.find(img => img.id === imageId);
                  return image ? (
                    <Badge key={imageId} variant="outline" className="text-xs">
                      {image.name}
                    </Badge>
                  ) : null;
                })}
                {rule.failed_images.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{rule.failed_images.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function AnnotationReviewPage() {
  const navigate = useNavigate();
  const [trainingRun, setTrainingRun] = useState(null);
  const [validationImages, setValidationImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [predictions, setPredictions] = useState({});
  const [groundTruths, setGroundTruths] = useState({});
  const [logicResults, setLogicResults] = useState([]);
  const [confusionMatrix, setConfusionMatrix] = useState([]);
  const [selectedCell, setSelectedCell] = useState(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  useEffect(() => {
    // In a real app, you would fetch this data based on the runId from the URL
    const urlParams = new URLSearchParams(window.location.search);
    const runId = urlParams.get('runId');
    if (runId) {
      // Simulate fetching run data
      TrainingRun.filter({ id: runId }).then(runs => {
        if (runs.length > 0) setTrainingRun(runs[0]);
      });
      // Set mock data
      setValidationImages(MOCK_VALIDATION_IMAGES);
      setPredictions(MOCK_PREDICTIONS);
      setGroundTruths(MOCK_GROUND_TRUTH);
      setLogicResults(MOCK_LOGIC_RESULTS);
      setConfusionMatrix(generateConfusionMatrixWithImages());
    }
  }, []);

  const currentImage = validationImages[currentImageIndex];
  const currentPredictions = currentImage ? predictions[currentImage.id] || [] : [];
  const currentGroundTruths = currentImage ? groundTruths[currentImage.id] || [] : [];

  const goToNextImage = () => setCurrentImageIndex(prev => Math.min(prev + 1, validationImages.length - 1));
  const goToPrevImage = () => setCurrentImageIndex(prev => Math.max(prev - 1, 0));

  const handleConfusionCellClick = (cell) => {
    if (cell && !cell.isCorrect && cell.count > 0) {
      setSelectedCell(cell);
      setShowErrorDialog(true);
    }
  };

  const overallLogicPassRate = logicResults.length > 0 
    ? Math.round((logicResults.reduce((sum, rule) => sum + rule.pass_rate, 0) / logicResults.length) * 100)
    : 0;

  if (!trainingRun || !currentImage) {
    return <div className="flex items-center justify-center h-screen">Loading validation results...</div>;
  }

  const truePositives = currentPredictions.filter(p => p.match === 'true_positive').length;
  const falsePositives = currentPredictions.filter(p => p.match === 'false_positive').length;
  const falseNegatives = currentGroundTruths.filter(gt => gt.match === 'false_negative').length;
  const totalGroundTruth = currentGroundTruths.length;
  const precision = (truePositives + falsePositives) > 0 ? (truePositives / (truePositives + falsePositives)) * 100 : 0;
  const recall = totalGroundTruth > 0 ? (truePositives / totalGroundTruth) * 100 : 0;

  const classes = ['Button', 'Input Field', 'Label', 'Checkbox', 'Dropdown'];

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100">
      {/* Header */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl(`TrainingStatus?runId=${trainingRun.id}`))}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Model Validation Review</h1>
              <p className="text-sm text-gray-600">Reviewing predictions for model: <span className="font-semibold">{trainingRun.run_name}</span></p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge className={`${overallLogicPassRate >= 80 ? 'bg-green-100 text-green-800' : overallLogicPassRate >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
              Logic Compliance: {overallLogicPassRate}%
            </Badge>
            <Button
              onClick={() => navigate(createPageUrl(`AnnotationStudio?projectId=${trainingRun.project_id}`))}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <PenTool className="w-4 h-4 mr-2" />
              Re-annotate This Project
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <Tabs defaultValue="logic-results" className="flex-1 flex flex-col">
          <div className="bg-white border-b px-6 py-2">
            <TabsList>
              <TabsTrigger value="logic-results" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Logic Rule Results
              </TabsTrigger>
              <TabsTrigger value="confusion-matrix" className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Confusion Matrix
              </TabsTrigger>
              <TabsTrigger value="image-viewer" className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Image Viewer
              </TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="logic-results" className="flex-1 p-6 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Business Logic Validation</h2>
                <p className="text-gray-600">
                  Results of running your trained model against the business rules you defined. 
                  Rules with low pass rates indicate areas where the model needs improvement.
                </p>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {logicResults.map((rule) => (
                    <LogicRuleCard key={rule.id} rule={rule} />
                  ))}
                  
                  {logicResults.length === 0 && (
                    <Alert className="border-blue-200 bg-blue-50">
                      <Target className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        No logic rules found for this step. Go to the Logic Builder to define business rules for validation.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
          
          <TabsContent value="confusion-matrix" className="flex-1 p-6 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Classification Analysis</h2>
                <p className="text-gray-600 mb-4">
                  Click on any cell to see which specific images caused classification errors.
                </p>
              </div>
              
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-sm border p-6 max-w-2xl w-full">
                  <InteractiveConfusionMatrix 
                    data={confusionMatrix}
                    classes={classes}
                    onCellClick={handleConfusionCellClick}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="image-viewer" className="flex-1 overflow-hidden">
            {/* Image Viewer Content - keeping existing implementation */}
            <main className="flex-1 flex overflow-hidden">
              {/* Image Viewer */}
              <div className="flex-1 flex items-center justify-center bg-gray-800 p-4 relative">
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevImage} disabled={currentImageIndex === 0}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm font-medium text-white bg-black/50 px-2 py-1 rounded">
                    Image {currentImageIndex + 1} of {validationImages.length}
                  </span>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextImage} disabled={currentImageIndex === validationImages.length - 1}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="relative">
                  <img src={currentImage.image_url} alt="Validation" className="max-h-[85vh] max-w-[70vw] object-contain rounded" />
                  {/* Ground Truth Boxes */}
                  {currentGroundTruths.map(gt => (
                    <BoundingBox key={gt.id} box={gt.bounding_box} color="border-green-500" label={`GT: ${gt.class}`} />
                  ))}
                  {/* Prediction Boxes */}
                  {currentPredictions.map(p => (
                    <BoundingBox
                      key={p.id}
                      box={p.bounding_box}
                      color={p.match === 'true_positive' ? 'border-blue-500' : 'border-red-500'}
                      label={`Pred: ${p.predicted_class} (${(p.confidence_score * 100).toFixed(0)}%)`}
                    />
                  ))}
                </div>
              </div>

              {/* Side Panel */}
              <aside className="w-80 bg-white border-l border-gray-200 p-6 flex flex-col">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Image Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span>Precision</span><span>{precision.toFixed(1)}%</span></div>
                      <Progress value={precision} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span>Recall</span><span>{recall.toFixed(1)}%</span></div>
                      <Progress value={recall} />
                    </div>
                  </CardContent>
                </Card>
                
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                    <span className="font-medium text-green-800">Correct Detections</span>
                    <Badge variant="secondary">{truePositives}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                    <span className="font-medium text-red-800">False Detections</span>
                    <Badge variant="destructive">{falsePositives}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                    <span className="font-medium text-yellow-800">Missed Detections</span>
                    <Badge className="bg-yellow-200 text-yellow-900">{falseNegatives}</Badge>
                  </div>
                </div>
                
                <div className="mt-auto">
                  <Alert className="border-blue-300 bg-blue-50">
                    <Wand2 className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Low recall? Add more examples of missed objects. High false detections? Add more negative examples.
                    </AlertDescription>
                  </Alert>
                </div>
              </aside>
            </main>
          </TabsContent>
        </Tabs>
      </div>

      {/* Error Dialog */}
      <ImageErrorDialog 
        cell={selectedCell} 
        open={showErrorDialog} 
        onClose={() => setShowErrorDialog(false)} 
      />
    </div>
  );
}