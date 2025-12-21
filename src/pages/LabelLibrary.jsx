
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/api/entities';
import { SOPStep } from '@/api/entities';
import { StepImage } from '@/api/entities'; // Not used in this file but part of original imports
import { LabelLibrary } from '@/api/entities';
import { StepVariantConfig } from "@/api/entities";
import { BuildVariant } from "@/api/entities";
import { createSignedImageUrl, getStoragePathFromUrl } from "@/api/storage";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'; // Not used in this file but part of original imports
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area'; // Not used in this file but part of original imports
import { 
  Database, 
  Search, 
  Filter, 
  Tag, 
  Image as ImageIcon, // Not used in this file but part of original imports
  Palette, // Not used in this file but part of original imports
  Calendar, // Not used in this file but part of original imports
  TrendingUp,
  Eye, // Not used in this file but part of original imports
  Grid3x3,
  List,
  BarChart3, // Not used in this file but part of original imports
  Target,
  FolderOpen,
  Users, // Not used in this file but part of original imports
  Clock, // Not used in this file but part of original imports
  Hash,
  Zap, // Not used in this file but part of original imports
  X,
  Layers, // New import for variant usage display
  Package // New import for variant usage display
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { motion, AnimatePresence } from 'framer-motion';

const useMockData = import.meta.env.VITE_USE_MOCK_LABEL_LIBRARY === "true";
const STEP_IMAGES_BUCKET = import.meta.env.VITE_STEP_IMAGES_BUCKET || "step-images";
const DATASET_BUCKET = import.meta.env.VITE_DATASET_BUCKET || "datasets";

// Mock data - in real implementation, this would be generated from actual annotation data
const MOCK_LABEL_DATA = [
  {
    id: 'label1',
    label_name: 'Button',
    projects_used: ['proj1', 'proj2', 'proj3'],
    total_annotations: 234,
    sample_images: [
      'https://images.unsplash.com/photo-1588336142586-3642324c2f48?w=300',
      'https://images.unsplash.com/photo-1563520239483-199b95d87c33?w=300',
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=300'
    ],
    average_confidence: 0.89,
    category: 'UI Element',
    color_hex: '#3B82F6',
    description: 'Interactive clickable elements like submit buttons, action buttons, etc.',
    created_date: '2024-01-15T10:30:00Z',
    last_used: '2024-01-20T14:45:00Z'
  },
  {
    id: 'label2',
    label_name: 'Input Field',
    projects_used: ['proj1', 'proj4'],
    total_annotations: 156,
    sample_images: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300',
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=300'
    ],
    average_confidence: 0.92,
    category: 'Form Control',
    color_hex: '#10B981',
    description: 'Text input fields, password fields, search boxes',
    created_date: '2024-01-12T09:15:00Z',
    last_used: '2024-01-19T16:20:00Z'
  },
  {
    id: 'label3',
    label_name: 'Label',
    projects_used: ['proj1', 'proj2', 'proj3', 'proj4'],
    total_annotations: 89,
    sample_images: [
      'https://images.unsplash.com/photo-1563520239483-199b95d87c33?w=300'
    ],
    average_confidence: 0.76,
    category: 'Content',
    color_hex: '#F59E0B',
    description: 'Text labels, field descriptions, form labels',
    created_date: '2024-01-10T11:00:00Z',
    last_used: '2024-01-18T13:30:00Z'
  },
  {
    id: 'label4',
    label_name: 'Dropdown',
    projects_used: ['proj2', 'proj3'],
    total_annotations: 67,
    sample_images: [
      'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=300',
      'https://images.unsplash.com/photo-1588336142586-3642324c2f48?w=300'
    ],
    average_confidence: 0.84,
    category: 'Form Control',
    color_hex: '#8B5CF6',
    description: 'Select dropdowns, combo boxes, option lists',
    created_date: '2024-01-14T15:45:00Z',
    last_used: '2024-01-17T10:15:00Z'
  },
  {
    id: 'label5',
    label_name: 'Checkbox',
    projects_used: ['proj1', 'proj3'],
    total_annotations: 43,
    sample_images: [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=300'
    ],
    average_confidence: 0.91,
    category: 'Form Control',
    color_hex: '#EF4444',
    description: 'Check boxes, radio buttons, toggle switches',
    created_date: '2024-01-16T08:30:00Z',
    last_used: '2024-01-19T12:00:00Z'
  }
];

const MOCK_PROJECTS = [
  { id: 'proj1', name: 'Dashboard UI Analysis' },
  { id: 'proj2', name: 'Form Validation Study' },
  { id: 'proj3', name: 'Navigation Elements' },
  { id: 'proj4', name: 'Mobile Interface Mapping' }
];

const MOCK_SOP_STEPS = [
  { id: 'step1', project_id: 'proj1', step_number: 1, title: 'Click Login Button', classes: ['Button', 'Input Field'] },
  { id: 'step2', project_id: 'proj1', step_number: 2, title: 'Enter Credentials', classes: ['Input Field', 'Label'] },
  { id: 'step3', project_id: 'proj2', step_number: 1, title: 'Select Product', classes: ['Dropdown'] },
  { id: 'step4', project_id: 'proj3', step_number: 1, title: 'Check Agreement Box', classes: ['Checkbox'] },
  { id: 'step5', project_id: 'proj4', step_number: 1, title: 'Fill Registration Form', classes: ['Button', 'Input Field', 'Label', 'Checkbox'] },
];

const MOCK_BUILD_VARIANTS = [
  { id: 'variant1', name: 'Mobile' },
  { id: 'variant2', name: 'Desktop' },
  { id: 'variant3', name: 'Tablet' },
];

const MOCK_STEP_VARIANT_CONFIGS = [
  { id: 'config1', sop_step_id: 'step1', build_variant_id: 'variant1', active_classes: ['Button'] }, // Mobile variant for step1 only uses 'Button'
  { id: 'config2', sop_step_id: 'step1', build_variant_id: 'variant2', active_classes: ['Button', 'Input Field'] }, // Desktop for step1 uses both
  { id: 'config3', sop_step_id: 'step5', build_variant_id: 'variant1', active_classes: ['Input Field', 'Label'] }, // Mobile for step5 uses subset
  { id: 'config4', sop_step_id: 'step3', build_variant_id: 'variant3', active_classes: ['Dropdown', 'Label'] }, // Tablet for step3 uses Dropdown and Label
];

const DEFAULT_LABEL_COLOR = '#64748B';
const DEFAULT_LABEL_CATEGORY = 'Other';

const CATEGORY_COLORS = {
  'UI Element': 'bg-blue-100 text-blue-800 border-blue-200',
  'Form Control': 'bg-green-100 text-green-800 border-green-200',
  'Navigation': 'bg-purple-100 text-purple-800 border-purple-200',
  'Content': 'bg-amber-100 text-amber-800 border-amber-200',
  'Layout': 'bg-pink-100 text-pink-800 border-pink-200',
  'Interactive': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'Other': 'bg-gray-100 text-gray-800 border-gray-200'
};

const normalizeLabel = (label) => {
  if (!label) return label;
  const projectsUsed = Array.isArray(label.projects_used) ? label.projects_used : [];
  const sampleImages = Array.isArray(label.sample_images) ? label.sample_images : [];
  const averageConfidence = typeof label.average_confidence === 'number'
    ? label.average_confidence
    : Number(label.average_confidence) || 0;

  return {
    ...label,
    label_name: label.label_name || 'Unnamed Label',
    projects_used: projectsUsed,
    sample_images: sampleImages,
    total_annotations: Number(label.total_annotations) || 0,
    average_confidence: averageConfidence,
    category: label.category || DEFAULT_LABEL_CATEGORY,
    color_hex: label.color_hex || DEFAULT_LABEL_COLOR,
    description: label.description || '',
    last_used: label.last_used || label.updated_date || label.created_date || null,
  };
};

const formatDate = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
};

const resolveSignedThumbnail = async (url) => {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;

  let bucket = STEP_IMAGES_BUCKET;
  let path = getStoragePathFromUrl(url, STEP_IMAGES_BUCKET);
  if (!path) {
    bucket = DATASET_BUCKET;
    path = getStoragePathFromUrl(url, DATASET_BUCKET);
  }
  if (!path) return url;

  try {
    return await createSignedImageUrl(bucket, path, {
      expiresIn: 3600,
      transform: { width: 300, height: 300, resize: "cover" },
    });
  } catch (error) {
    console.warn("Failed to sign label thumbnail URL:", error);
    return url;
  }
};

const StatCard = ({ icon, title, value, subtitle, color = 'blue' }) => (
  <Card className="glass-effect border-0 shadow-sm">
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 bg-${color}-100 rounded-xl flex items-center justify-center`}>
          {React.cloneElement(icon, { className: `w-6 h-6 text-${color}-600` })}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm font-medium text-gray-700">{title}</p>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const LabelCard = ({ label, onSelect, isSelected, viewMode }) => {
  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-50';
    if (confidence >= 0.8) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };
  const categoryClass = CATEGORY_COLORS[label.category] || CATEGORY_COLORS[DEFAULT_LABEL_CATEGORY];

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
        }`}
        onClick={() => onSelect(label)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-4 h-4 rounded-full border-2"
              style={{ backgroundColor: label.color_hex }}
            />
            <div>
              <h3 className="font-semibold text-gray-900">{label.label_name}</h3>
              <p className="text-sm text-gray-600 truncate max-w-md">{label.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {label.total_annotations}
            </span>
            <span className="flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              {label.projects_used.length}
            </span>
            <Badge className={`text-xs ${getConfidenceColor(label.average_confidence)}`}>
              {Math.round(label.average_confidence * 100)}%
            </Badge>
            <Badge className={`text-xs ${categoryClass}`}>
              {label.category}
            </Badge>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      }`}
      onClick={() => onSelect(label)}
    >
      <Card className="glass-effect border-0 shadow-sm hover:shadow-lg transition-shadow h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: label.color_hex }}
              />
              <CardTitle className="text-lg">{label.label_name}</CardTitle>
            </div>
            <Badge className={`text-xs ${categoryClass}`}>
              {label.category}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Sample Images */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {label.sample_images.slice(0, 3).map((img, idx) => (
              <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={img}
                  alt={`${label.label_name} example ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="space-y-2 mb-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Annotations</span>
              <span className="font-semibold text-gray-900">{label.total_annotations}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Projects</span>
              <span className="font-semibold">{label.projects_used.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Confidence</span>
              <Badge className={`text-xs ${getConfidenceColor(label.average_confidence)}`}>
                {Math.round(label.average_confidence * 100)}%
              </Badge>
            </div>
          </div>

          <p className="text-xs text-gray-500 line-clamp-2">{label.description}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default function LabelLibraryPage() {
  const navigate = useNavigate();
  const [labels, setLabels] = useState([]); // Changed initial state to empty array as data is fetched
  const [projects, setProjects] = useState([]); // Changed initial state to empty array as data is fetched
  const [steps, setSteps] = useState([]); // New state for SOPSteps
  const [buildVariants, setBuildVariants] = useState([]); // New state for BuildVariants
  const [stepVariantConfigs, setStepVariantConfigs] = useState([]); // New state for StepVariantConfigs
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New state for loading

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [labelsData, projectsData, stepsData, variantsData, configsData] = await Promise.all([
        LabelLibrary.list(),
        Project.list(),
        SOPStep.list(),
        BuildVariant.list(),
        StepVariantConfig.list()
      ]);
      
      const signedLabels = await Promise.all(
        labelsData.map(async (label) => {
          const sampleImages = Array.isArray(label.sample_images) ? label.sample_images : [];
          const signedImages = await Promise.all(sampleImages.map(resolveSignedThumbnail));
          return normalizeLabel({ ...label, sample_images: signedImages });
        })
      );
      setLabels(signedLabels);
      setProjects(projectsData);
      setSteps(stepsData);
      setBuildVariants(variantsData);
      setStepVariantConfigs(configsData);
      
      // In real implementation, the 'labels' data might need processing
      // to aggregate statistics from steps and variant configs.
      // For now, MOCK_LABEL_DATA already contains aggregated stats.
      
    } catch (error) {
      console.error('Error loading label library data:', error);
      if (useMockData) {
        const signedMockLabels = await Promise.all(
          MOCK_LABEL_DATA.map(async (label) => {
            const sampleImages = Array.isArray(label.sample_images) ? label.sample_images : [];
            const signedImages = await Promise.all(sampleImages.map(resolveSignedThumbnail));
            return normalizeLabel({ ...label, sample_images: signedImages });
          })
        );
        setLabels(signedMockLabels);
        setProjects(MOCK_PROJECTS);
        setSteps(MOCK_SOP_STEPS);
        setBuildVariants(MOCK_BUILD_VARIANTS);
        setStepVariantConfigs(MOCK_STEP_VARIANT_CONFIGS);
      } else {
        setLoadError(error?.message || 'Failed to load label library data.');
        setLabels([]);
        setProjects([]);
        setSteps([]);
        setBuildVariants([]);
        setStepVariantConfigs([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLabels = useMemo(() => {
    if (isLoading) return []; // Don't show filtered labels until data is loaded
    return labels.filter(label => {
      const matchesSearch = !searchQuery || 
        label.label_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        label.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || label.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });
  }, [labels, searchQuery, categoryFilter, isLoading]);

  const stats = useMemo(() => {
    if (isLoading) return { totalLabels: 0, totalAnnotations: 0, totalProjects: 0, avgConfidence: 0 };
    const totalLabels = labels.length;
    const totalAnnotations = labels.reduce((sum, label) => sum + label.total_annotations, 0);
    const totalProjects = new Set(labels.flatMap(label => label.projects_used)).size;
    const avgConfidence = labels.length > 0 ? labels.reduce((sum, label) => sum + label.average_confidence, 0) / labels.length : 0;

    return {
      totalLabels,
      totalAnnotations,
      totalProjects,
      avgConfidence: Math.round(avgConfidence * 100)
    };
  }, [labels, isLoading]);

  const categories = useMemo(() => [...new Set(labels.map(label => label.category))], [labels]);

  // Enhanced function to get label usage including build variants
  const getLabelUsage = (labelName) => {
    const usage = {
      defaultSteps: [],
      variantConfigs: [],
      totalUsage: 0
    };

    // Find steps that use this label by default
    steps.forEach(step => {
      if (step.classes && step.classes.includes(labelName)) {
        const project = projects.find(p => p.id === step.project_id);
        usage.defaultSteps.push({
          step,
          project: project?.name || "Unknown Project"
        });
      }
    });

    // Find build variant configurations that use this label
    stepVariantConfigs.forEach(config => {
      if (config.active_classes && config.active_classes.includes(labelName)) {
        const step = steps.find(s => s.id === config.sop_step_id);
        const variant = buildVariants.find(v => v.id === config.build_variant_id);
        
        if (step && variant) {
          const project = projects.find(p => p.id === step.project_id); // Find project for the step
          usage.variantConfigs.push({
            step,
            variant,
            project: project?.name || "Unknown Project"
          });
        }
      }
    });

    usage.totalUsage = usage.defaultSteps.length + usage.variantConfigs.length;
    return usage;
  };

  // Enhanced LabelDetailModal component
  const LabelDetailModal = ({ label, onClose }) => {
    if (!label) return null;

    const labelUsage = getLabelUsage(label.label_name);
    const categoryClass = CATEGORY_COLORS[label.category] || CATEGORY_COLORS[DEFAULT_LABEL_CATEGORY];

    return (
      <Dialog open={!!label} onOpenChange={() => onClose()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full border-2"
                style={{ backgroundColor: label.color_hex || '#3B82F6' }}
              />
              {label.label_name}
              <Badge className={`${categoryClass}`}>
                {label.category}
              </Badge>
            </DialogTitle>
            <DialogDescription>{label.description}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            {/* Statistics */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Annotations</span>
                  <span className="font-semibold">{label.total_annotations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Projects Used</span>
                  <span className="font-semibold">{label.projects_used.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Average Confidence</span>
                  <span className="font-semibold">{Math.round(label.average_confidence * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created</span>
                  <span className="font-semibold">
                    {formatDate(label.created_date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Used</span>
                  <span className="font-semibold">
                    {formatDate(label.last_used)}
                  </span>
                </div>
              </div>
            </div>

            {/* Enhanced Usage Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Usage Details</h3>
              
              {/* Default Step Usage */}
              {labelUsage.defaultSteps.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Default Step Configurations ({labelUsage.defaultSteps.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {labelUsage.defaultSteps.map(({ step, project }, index) => (
                      <div key={`default-${step.id}-${index}`} className="p-2 bg-blue-50 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm text-blue-900">
                              Step {step.step_number}: {step.title}
                            </p>
                            <p className="text-xs text-blue-600">{project}</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800 text-xs">Default</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Build Variant Usage */}
              {labelUsage.variantConfigs.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Build Variant Configurations ({labelUsage.variantConfigs.length})
                  </h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                    {labelUsage.variantConfigs.map(({ step, variant, project }, index) => (
                      <div key={`variant-${step.id}-${variant.id}-${index}`} className="p-2 bg-green-50 rounded border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm text-green-900">
                              Step {step.step_number}: {step.title}
                            </p>
                            <p className="text-xs text-green-600">{project}</p>
                            <p className="text-xs text-green-700 font-medium mt-1">
                              Variant: {variant.name}
                            </p>
                          </div>
                          <Badge className="bg-green-100 text-green-800 text-xs">Build Variant</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {labelUsage.totalUsage === 0 && (
                <div className="text-center py-4 bg-gray-50 rounded">
                  <p className="text-gray-600">This label is not currently being used in any steps or build variants.</p>
                </div>
              )}
            </div>

            {/* Sample Images Gallery */}
            <div className="space-y-4 md:col-span-2"> {/* Make sample images span both columns */}
              <h3 className="font-semibold text-gray-900">Sample Images</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {label.sample_images.map((img, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={img}
                      alt={`${label.label_name} example ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600" />
              Label Library
            </h1>
            <p className="text-gray-600 text-lg">
              Your complete annotation memory - all labels, datasets, and insights in one place
            </p>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {loadError}
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<Tag />}
            title="Total Labels"
            value={stats.totalLabels}
            subtitle="Unique classes defined"
            color="blue"
          />
          <StatCard
            icon={<Target />}
            title="Annotations"
            value={stats.totalAnnotations.toLocaleString()}
            subtitle="Total bounding boxes"
            color="green"
          />
          <StatCard
            icon={<FolderOpen />}
            title="Projects"
            value={stats.totalProjects}
            subtitle="Using these labels"
            color="purple"
          />
          <StatCard
            icon={<TrendingUp />}
            title="Avg Confidence"
            value={`${stats.avgConfidence}%`}
            subtitle="Model prediction accuracy"
            color="amber"
          />
        </div>

        {/* Search and Filters */}
        <Card className="glass-effect border-0 shadow-sm mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search labels by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-600">
            Showing {filteredLabels.length} of {labels.length} labels
            {searchQuery && <span> matching "{searchQuery}"</span>}
            {categoryFilter !== 'all' && <span> in "{categoryFilter}"</span>}
          </p>
        </div>

        {/* Loading / Empty / Labels Grid/List */}
        {isLoading ? (
          <div className="text-center py-16">
            <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-gray-600">Loading labels...</p>
          </div>
        ) : filteredLabels.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Labels Found</h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || categoryFilter !== 'all' 
                ? "Try adjusting your search or filters"
                : "Start by creating your first annotation project to build your label library"
              }
            </p>
            {(!searchQuery && categoryFilter === 'all') && (
              <Button
                onClick={() => navigate(createPageUrl('Projects'))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Go to Projects
              </Button>
            )}
          </div>
        ) : (
          <div className={`${
            viewMode === 'grid' 
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' 
              : 'space-y-3'
          }`}>
            <AnimatePresence>
              {filteredLabels.map(label => (
                <LabelCard
                  key={label.id}
                  label={label}
                  onSelect={(label) => {
                    setSelectedLabel(label);
                    setShowDetailModal(true);
                  }}
                  isSelected={selectedLabel?.id === label.id}
                  viewMode={viewMode}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Label Detail Modal */}
        <LabelDetailModal
          label={selectedLabel}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedLabel(null);
          }}
        />
      </div>
    </div>
  );
}
