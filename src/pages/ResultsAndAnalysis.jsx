
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { TrainingRun } from '@/api/entities';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { StepImage } from '@/api/entities';
import { LogicRule } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Upload,
  Image as ImageIcon,
  Brain,
  Target,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Play,
  Loader2,
  Download,
  Code,
  Grid3x3,
  Zap,
  BarChart3,
  Clock,
  Rocket,
  ChevronRight,
  ArrowUpDown,
  X,
  Settings,
  History,
  Calendar,
  User,
  Database,
  Spline // Added Spline icon
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';

// Mock data for existing images in database
const MOCK_DB_IMAGES = [
  {
    id: 'img1',
    name: 'dashboard_01.png',
    url: 'https://images.unsplash.com/photo-1588336142586-3642324c2f48?w=600',
    thumbnail: 'https://images.unsplash.com/photo-1588336142586-3642324c2f48?w=150',
    project: 'Dashboard UI Analysis',
    date: '2024-01-15',
    tags: ['training', 'validated']
  },
  {
    id: 'img2',
    name: 'form_interface.png',
    url: 'https://images.unsplash.com/photo-1563520239483-199b95d87c33?w=600',
    thumbnail: 'https://images.unsplash.com/photo-1563520239483-199b95d87c33?w=150',
    project: 'Form Validation Study',
    date: '2024-01-12',
    tags: ['training']
  },
  {
    id: 'img3',
    name: 'mobile_nav.png',
    url: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=600',
    thumbnail: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=150',
    project: 'Navigation Elements',
    date: '2024-01-18',
    tags: ['inference', 'production']
  }
];

// MOCK_TRAINED_MODELS is removed as it will be replaced by dynamic 'deployedModels'


// Mock inference history/results
const MOCK_INFERENCE_HISTORY = [
  {
    id: 'inf1',
    run_name: 'Dashboard Test Run #1',
    model_name: 'Button Detector v2.1',
    project_name: 'Dashboard UI Analysis',
    image_name: 'dashboard_01.png',
    status: 'completed',
    created_date: '2024-01-22T10:30:00Z',
    created_by: 'john.doe@company.com',
    results: {
      total_predictions: 4,
      avg_confidence: 0.89,
      logic_status: 'PASS',
      compliance_score: 1.0
    }
  },
  {
    id: 'inf2',
    run_name: 'Form Elements Test',
    model_name: 'Form Elements Classifier',
    project_name: 'Form Validation Study',
    image_name: 'form_interface.png',
    status: 'completed',
    created_date: '2024-01-21T14:15:00Z',
    created_by: 'jane.smith@company.com',
    results: {
      total_predictions: 6,
      avg_confidence: 0.92,
      logic_status: 'FAIL',
      compliance_score: 0.67
    }
  }
];

const statusConfig = {
  running: { icon: <Rocket className="w-4 h-4 text-blue-500" />, color: "bg-blue-100 text-blue-800", label: "Running" },
  completed: { icon: <CheckCircle className="w-4 h-4 text-green-500" />, color: "bg-green-100 text-green-800", label: "Completed" },
  failed: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: "bg-red-100 text-red-800", label: "Failed" }
};

export default function ResultsAndAnalysisPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('inference-testing');
  const [deployedModels, setDeployedModels] = useState([]); // New state for deployed models
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inferenceResults, setInferenceResults] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDeployedModels();

    // Check if a specific model was selected from URL
    const urlParams = new URLSearchParams(window.location.search);
    const modelId = urlParams.get('modelId');
    if (modelId) {
      setSelectedModel(modelId);
    }
  }, []);

  const loadDeployedModels = async () => {
    try {
      const allRuns = await TrainingRun.list();
      const deployed = allRuns.filter(run =>
        run.is_deployed && run.deployment_status === 'deployed'
      );
      setDeployedModels(deployed);
    } catch (error) {
      console.error('Error loading deployed models:', error);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadPreview(reader.result);
      };
      reader.readAsDataURL(file);
      setInferenceResults(null);
    }
  };

  const handleRunInference = async () => {
    if (!selectedModel || (!selectedImage && !uploadFile)) {
      return;
    }

    setIsProcessing(true);
    setInferenceResults(null);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock results
    const mockResults = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      model_used: selectedModel,
      image_analyzed: selectedImage?.name || uploadFile?.name,
      processing_time: '1.24s',
      predictions: [
        {
          id: 1,
          class: 'Button',
          confidence: 0.94,
          bbox: { x: 150, y: 80, width: 100, height: 40 },
          area: 4000
        },
        {
          id: 2,
          class: 'Input Field',
          confidence: 0.87,
          bbox: { x: 50, y: 200, width: 200, height: 30 },
          area: 6000
        }
      ],
      logic_evaluation: {
        status: 'PASS',
        rules_checked: 2,
        rules_passed: 2,
        compliance_score: 1.0
      },
      raw_response: {
        model_version: '2.1',
        inference_id: 'inf_' + Math.random().toString(36).substr(2, 9),
        total_objects: 2,
        processing_metadata: {
          gpu_used: 'Tesla T4',
          memory_usage: '2.1GB',
          batch_size: 1
        }
      }
    };

    setInferenceResults(mockResults);
    setIsProcessing(false);
  };

  const filteredHistory = MOCK_INFERENCE_HISTORY.filter(item => {
    if (historyFilter !== 'all' && item.status !== historyFilter) return false;
    if (searchQuery && !item.run_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="border-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                Results & Analysis Hub
              </h1>
              <p className="text-gray-600 mt-1">Test your models and review inference history</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 bg-white p-1 rounded-lg shadow-sm">
            <TabsTrigger value="inference-testing" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Zap className="inline-block w-4 h-4 mr-2" /> Live Model Testing
            </TabsTrigger>
            <TabsTrigger value="inference-history" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <History className="inline-block w-4 h-4 mr-2" /> Inference History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inference-testing" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[800px]">
              {/* Left Panel - Database Images */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-600" />
                    Image Database
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-3">
                      {MOCK_DB_IMAGES.map((image) => (
                        <div
                          key={image.id}
                          onClick={() => setSelectedImage(image)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedImage?.id === image.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={image.thumbnail}
                              alt={image.name}
                              className="w-12 h-12 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{image.name}</p>
                              <p className="text-xs text-gray-500">{image.project}</p>
                              <div className="flex gap-1 mt-1">
                                {image.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Center Panel - Image Display */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-blue-600" />
                    Image Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative h-[600px] bg-gray-50 rounded-lg flex items-center justify-center">
                    {selectedImage ? (
                      <img
                        src={selectedImage.url}
                        alt={selectedImage.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : uploadPreview ? (
                      <img
                        src={uploadPreview}
                        alt="Upload preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-gray-500">
                        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <p>Select an image from database or upload new one</p>
                      </div>
                    )}

                    {/* Inference Results Overlay */}
                    {inferenceResults?.predictions && (
                      <>
                        {inferenceResults.predictions.map((prediction, index) => (
                          <div
                            key={prediction.id}
                            className="absolute border-2 border-red-500 bg-red-500/10"
                            style={{
                              left: `${prediction.bbox.x}px`,
                              top: `${prediction.bbox.y}px`,
                              width: `${prediction.bbox.width}px`,
                              height: `${prediction.bbox.height}px`,
                            }}
                          >
                            <div className="absolute -top-6 left-0 bg-red-500 text-white px-2 py-1 text-xs rounded">
                              {prediction.class} ({(prediction.confidence * 100).toFixed(1)}%)
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Right Panel - Upload & Results */}
              <div className="space-y-6">
                {/* Upload Area */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="w-5 h-5 text-blue-600" />
                      Upload New Image
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 border-dashed"
                    >
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-600">Click to upload image</p>
                      </div>
                    </Button>
                  </CardContent>
                </Card>

                {/* Model Selection & Run */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-blue-600" />
                      Deployed Models
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a deployed model" />
                      </SelectTrigger>
                      <SelectContent>
                        {deployedModels.length === 0 ? (
                          <SelectItem value={null} disabled>
                            No deployed models available
                          </SelectItem>
                        ) : (
                          deployedModels.map(model => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex items-center gap-2">
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Deployed
                                </Badge>
                                {model.run_name}
                                {model.results?.mAP && (
                                  <span className="text-gray-500 text-xs">
                                    ({(model.results.mAP * 100).toFixed(1)}% mAP)
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {deployedModels.length === 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          No models are currently deployed. Train and deploy a model from the Training Configuration page first.
                          <Link to={createPageUrl('TrainingConfiguration')} className="block mt-2">
                            <Button variant="outline" size="sm">
                              <Spline className="w-4 h-4 mr-2" />
                              Go to Training
                            </Button>
                          </Link>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      onClick={handleRunInference}
                      disabled={!selectedModel || (!selectedImage && !uploadFile) || isProcessing || deployedModels.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Run Inference
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Results */}
                {inferenceResults && (
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-600" />
                        Results
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Logic Status */}
                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-medium text-green-800">Logic Status: PASS</span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          {(inferenceResults.logic_evaluation.compliance_score * 100).toFixed(0)}%
                        </Badge>
                      </div>

                      {/* Predictions List */}
                      <div>
                        <h4 className="font-medium mb-2">Detections ({inferenceResults.predictions.length})</h4>
                        <div className="space-y-2">
                          {inferenceResults.predictions.map((pred, index) => (
                            <div key={pred.id} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{pred.class}</span>
                                <Badge variant="outline">
                                  {(pred.confidence * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                Location: ({pred.bbox.x}, {pred.bbox.y}) |
                                Size: {pred.bbox.width}×{pred.bbox.height} |
                                Area: {pred.area}px²
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Raw JSON */}
                      <details className="text-xs">
                        <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                          View Raw JSON Response
                        </summary>
                        <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-40">
                          {JSON.stringify(inferenceResults.raw_response, null, 2)}
                        </pre>
                      </details>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="inference-history" className="mt-6">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Inference History
                </CardTitle>
                <CardDescription>Review past inference runs and results</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search inference runs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* History Table */}
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run Name</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Image</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Results</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.run_name}</TableCell>
                          <TableCell>{item.model_name}</TableCell>
                          <TableCell>{item.project_name}</TableCell>
                          <TableCell>{item.image_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {statusConfig[item.status].icon}
                              <Badge className={statusConfig[item.status].color}>
                                {statusConfig[item.status].label}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>{new Date(item.created_date).toLocaleDateString()}</TableCell>
                          <TableCell>{item.created_by.split('@')[0]}</TableCell>
                          <TableCell>
                            {item.results ? (
                              <div className="text-sm">
                                <div>Objects: {item.results.total_predictions}</div>
                                <div>Confidence: {(item.results.avg_confidence * 100).toFixed(1)}%</div>
                                <Badge
                                  className={
                                    item.results.logic_status === 'PASS'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-red-100 text-red-800'
                                  }
                                >
                                  {item.results.logic_status}
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-gray-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
