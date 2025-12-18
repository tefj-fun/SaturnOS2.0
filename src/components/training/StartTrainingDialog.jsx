import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info, Sparkles, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TooltipLabel = ({ children, tooltipText }) => (
    <div className="flex items-center gap-1.5">
        <Label>{children}</Label>
        <TooltipProvider delayDuration={100}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button type="button" className="focus:outline-none -mb-0.5">
                        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
                    </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs bg-gray-800 text-white border-gray-700">
                    <p>{tooltipText}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    </div>
);

const modelOptions = [
  { value: 'YOLOv8s', label: 'YOLOv8s', description: 'Best balance of speed and accuracy.' },
  { value: 'YOLOv8n', label: 'YOLOv8n', description: 'Fastest, ideal for edge devices.' },
  { value: 'YOLOv8m', label: 'YOLOv8m', description: 'Most accurate, requires more compute.' },
  { value: 'EfficientDet-D0', label: 'EfficientDet-D0', description: 'Good performance, scalable.' },
];

const computeOptions = [
  { value: 'gpu_standard', label: 'Standard GPU (T4)', description: 'Cost-effective for most tasks.' },
  { value: 'gpu_high_perf', label: 'Performance GPU (A10G)', description: 'Faster training for large models.' },
];

export default function StartTrainingDialog({ open, onOpenChange, onSubmit, stepId, stepTitle, existingRuns }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
    
    const [config, setConfig] = useState({
        runName: "",
        dataYaml: "",
        baseModel: 'YOLOv8s',
        epochs: 100,
        batchSize: 16,
        imgSize: 640,
        learningRate: 0.001,
        optimizer: 'Adam',
        compute: 'gpu_standard',
        optimizationStrategy: 'manual',
        bayesianConfig: {
            objective: 'maximize_mAP',
            numTrials: 20,
            maxDuration: 6,
            searchSpace: {
                epochs: { enabled: false, min: 50, max: 200, type: 'integer' },
                batchSize: { enabled: false, options: [8, 16, 32], type: 'categorical' },
                learningRate: { enabled: false, min: 0.0001, max: 0.01, type: 'log_uniform' },
                imgSize: { enabled: false, options: [320, 640, 1280], type: 'categorical' }
            }
        }
    });

    useEffect(() => {
        if (open) {
            const newVersion = (existingRuns?.length || 0) + 1;
            const safeTitle = stepTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'training';
            setConfig(prev => ({
                ...prev,
                runName: `${safeTitle}_v${newVersion}`
            }));
        }
    }, [open, stepTitle, existingRuns]);

    const dynamicModelOptions = useMemo(() => {
        const completedRuns = (existingRuns || []).filter(run => run.status === 'completed' && run.trained_model_url);
        if (completedRuns.length > 0) {
            return [
                { label: "Pre-trained Models", options: modelOptions },
                {
                    label: "Your Trained Models",
                    options: completedRuns.map(run => ({
                        value: run.id,
                        label: run.run_name,
                        description: `Completed on ${new Date(run.updated_date).toLocaleDateString()}. mAP: ${run.results?.mAP || 'N/A'}`
                    }))
                }
            ];
        }
        return [{ label: "Pre-trained Models", options: modelOptions }];
    }, [existingRuns]);

    const handleConfigChange = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));
    const handleBayesianConfigChange = (key, value) => setConfig(prev => ({ ...prev, bayesianConfig: { ...prev.bayesianConfig, [key]: value } }));
    const handleSearchSpaceChange = (param, field, value) => {
        setConfig(prev => ({
            ...prev,
            bayesianConfig: {
                ...prev.bayesianConfig,
                searchSpace: {
                    ...prev.bayesianConfig.searchSpace,
                    [param]: { ...prev.bayesianConfig.searchSpace[param], [field]: value }
                }
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            await onSubmit({
                step_id: stepId,
                run_name: config.runName,
                base_model: config.baseModel,
                data_yaml: config.dataYaml,
                status: 'queued',
                configuration: config,
            });
            onOpenChange(false);
        } catch (error) {
            console.error('Error starting training:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl glass-effect border-0">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                        <Sparkles className="w-6 h-6 text-blue-600" />
                        Start New Training Run
                    </DialogTitle>
                    <DialogDescription>Configure and launch a new model training job for step: "{stepTitle}"</DialogDescription>
                </DialogHeader>
                
                <form onSubmit={handleSubmit} className="space-y-6 mt-4 max-h-[70vh] overflow-y-auto pr-4">
                    {/* Step 1: Basic Configuration */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                            <h3 className="font-semibold text-gray-900">Basic Configuration</h3>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Give your model version a unique, descriptive name so you can easily identify it later.">Model Version Name</TooltipLabel>
                            <Input id="runName" value={config.runName} onChange={e => handleConfigChange('runName', e.target.value)} placeholder="e.g., Button_Detection_v1"/>
                        </div>

                        <div>
                            <TooltipLabel tooltipText="Path on the training server to your dataset YAML file (YOLO format).">Dataset YAML Path (Server)</TooltipLabel>
                            <Input
                                id="dataYaml"
                                value={config.dataYaml}
                                onChange={e => handleConfigChange('dataYaml', e.target.value)}
                                placeholder="/mnt/d/datasets/your_dataset/data.yaml"
                            />
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Choose a pre-trained model as your starting point. YOLOv8s offers the best balance of speed and accuracy for most tasks.">Base Model</TooltipLabel>
                            <Select value={config.baseModel} onValueChange={value => handleConfigChange('baseModel', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {dynamicModelOptions.map((group, index) => (
                                        <SelectGroup key={group.label || `group-${index}`}>
                                            <SelectLabel className="px-2 py-1.5 text-xs font-semibold">{group.label}</SelectLabel>
                                            {group.options.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex flex-col">
                                                        <span>{opt.label}</span>
                                                        <span className="text-gray-500 text-xs">{opt.description}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="The optimization algorithm. Adam is highly recommended as it works well for most tasks and is very reliable.">Optimizer</TooltipLabel>
                            <Select value={config.optimizer} onValueChange={value => handleConfigChange('optimizer', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Adam">✅ Adam (Recommended - Works great for most tasks)</SelectItem>
                                    <SelectItem value="AdamW">AdamW (Advanced - Better for large models)</SelectItem>
                                    <SelectItem value="SGD">SGD (Classic - Requires careful tuning)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <TooltipLabel tooltipText="Choose your training hardware. Standard GPU is cost-effective and suitable for most projects.">Compute Resources</TooltipLabel>
                            <Select value={config.compute} onValueChange={value => handleConfigChange('compute', value)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {computeOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            <div className="flex flex-col">
                                                <span>{opt.label}</span>
                                                <span className="text-gray-500 text-xs">{opt.description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Step 2: Recommended Settings */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                            <h3 className="font-semibold text-gray-900">Recommended Training Settings</h3>
                            <Badge variant="secondary" className="bg-green-100 text-green-800">Good defaults for beginners</Badge>
                        </div>
                        
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                </div>
                                <div>
                                    <h4 className="font-medium text-green-900 mb-1">💡 Beginner Tip</h4>
                                    <p className="text-sm text-green-800">These settings work well for most annotation projects. Train your first model with these defaults, then use Advanced Optimization (Step 3) to fine-tune if needed.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <TooltipLabel tooltipText="How many times the model will see your entire dataset. 100 epochs is a good starting point - enough to learn well without taking too long.">Epochs (Recommended: 100)</TooltipLabel>
                                <Input 
                                    type="number" 
                                    value={config.epochs} 
                                    onChange={e => handleConfigChange('epochs', parseInt(e.target.value))} 
                                    className={config.epochs === 100 ? "border-green-500" : ""} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.epochs.enabled}
                                />
                            </div>
                            <div>
                                <TooltipLabel tooltipText="How many images to process together. 16 is a sweet spot - fast training without using too much memory.">Batch Size (Recommended: 16)</TooltipLabel>
                                <Select 
                                    value={String(config.batchSize)} 
                                    onValueChange={value => handleConfigChange('batchSize', parseInt(value))} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.batchSize.enabled}
                                >
                                    <SelectTrigger className={config.batchSize === 16 ? "border-green-500" : ""}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="8">8 (Slower, less memory)</SelectItem>
                                        <SelectItem value="16">16 (Recommended)</SelectItem>
                                        <SelectItem value="32">32 (Faster, more memory)</SelectItem>
                                        <SelectItem value="64">64 (Advanced)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <TooltipLabel tooltipText="Images will be resized to this size for training. 640 pixels is perfect for most detection tasks - big enough to see details, not too slow.">Image Size (Recommended: 640)</TooltipLabel>
                                <Select 
                                    value={String(config.imgSize)} 
                                    onValueChange={value => handleConfigChange('imgSize', parseInt(value))} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.imgSize.enabled}
                                >
                                    <SelectTrigger className={config.imgSize === 640 ? "border-green-500" : ""}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="320">320px (Fastest)</SelectItem>
                                        <SelectItem value="640">640px (Recommended)</SelectItem>
                                        <SelectItem value="1280">1280px (High detail)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <TooltipLabel tooltipText="How fast the model learns. 0.001 is a safe, proven value that works well with Adam optimizer.">Learning Rate (Recommended: 0.001)</TooltipLabel>
                                <Input 
                                    type="number" 
                                    step="0.0001" 
                                    value={config.learningRate} 
                                    onChange={e => handleConfigChange('learningRate', parseFloat(e.target.value))} 
                                    className={config.learningRate === 0.001 ? "border-green-500" : ""} 
                                    disabled={showAdvancedSettings && config.optimizationStrategy === 'bayesian' && config.bayesianConfig.searchSpace.learningRate.enabled}
                                />
                            </div>
                        </div>
                    </div>
                    
                    <Separator />
                    
                    {/* Step 3: Advanced Optimization */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                            <h3 className="font-semibold text-gray-900">Advanced Hyperparameter Optimization</h3>
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800">For experienced users</Badge>
                        </div>
                        
                        <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                            <div className="flex-1">
                                <h4 className="font-medium text-purple-900 mb-1">Automatic Parameter Tuning</h4>
                                <p className="text-sm text-purple-800">Use AI to automatically find the best hyperparameters. Only recommended after training your first model with the defaults above.</p>
                            </div>
                            <Switch checked={showAdvancedSettings} onCheckedChange={setShowAdvancedSettings}/>
                        </div>
                        
                        <AnimatePresence>
                            {showAdvancedSettings && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }} 
                                    animate={{ opacity: 1, height: "auto" }} 
                                    exit={{ opacity: 0, height: 0 }} 
                                    transition={{ duration: 0.3 }} 
                                    className="overflow-hidden space-y-6 pt-4 border-t border-purple-200"
                                >
                                    <div>
                                        <TooltipLabel tooltipText="Choose 'Manual' to set hyperparameters yourself, or 'Bayesian' to let the system automatically find the optimal settings.">Optimization Strategy</TooltipLabel>
                                        <Select value={config.optimizationStrategy} onValueChange={value => handleConfigChange('optimizationStrategy', value)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="manual">Manual Tuning</SelectItem>
                                                <SelectItem value="bayesian">Bayesian Optimization</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {config.optimizationStrategy === 'manual' && (
                                        <Alert className="border-blue-300 bg-blue-50">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            <AlertTitle className="text-blue-800">Manual Tuning Active</AlertTitle>
                                            <AlertDescription className="text-blue-700">
                                                You can now adjust the parameters in <strong>Step 2: Recommended Training Settings</strong>. The values you set there will be used for the training run.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    
                                    {config.optimizationStrategy === 'bayesian' && (
                                        <div className="space-y-6">
                                            <Alert className="border-purple-300 bg-purple-50">
                                                <Info className="h-4 w-4 text-purple-600" />
                                                <AlertTitle className="text-purple-800">Bayesian Optimization Active</AlertTitle>
                                                <AlertDescription className="text-purple-700">
                                                    The system will automatically try different parameter combinations to find the best settings. Enable specific parameters below to include them in the search.
                                                </AlertDescription>
                                            </Alert>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <TooltipLabel tooltipText="Objective function to optimize during training.">Optimization Objective</TooltipLabel>
                                                    <Select value={config.bayesianConfig.objective} onValueChange={value => handleBayesianConfigChange('objective', value)}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="maximize_mAP">Maximize mAP (Recommended)</SelectItem>
                                                            <SelectItem value="minimize_loss">Minimize Training Loss</SelectItem>
                                                            <SelectItem value="maximize_precision">Maximize Precision</SelectItem>
                                                            <SelectItem value="maximize_recall">Maximize Recall</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                
                                                <div>
                                                    <TooltipLabel tooltipText="Number of different parameter combinations to try.">Number of Trials</TooltipLabel>
                                                    <Input 
                                                        type="number" 
                                                        value={config.bayesianConfig.numTrials} 
                                                        onChange={e => handleBayesianConfigChange('numTrials', parseInt(e.target.value))} 
                                                        min="5" 
                                                        max="100"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <TooltipLabel tooltipText="Maximum time to spend on optimization (in hours).">Max Duration (hours)</TooltipLabel>
                                                <Input 
                                                    type="number" 
                                                    value={config.bayesianConfig.maxDuration} 
                                                    onChange={e => handleBayesianConfigChange('maxDuration', parseInt(e.target.value))} 
                                                    min="1" 
                                                    max="48"
                                                />
                                            </div>
                                            
                                            <div className="space-y-4">
                                                <h4 className="font-medium text-gray-900">Parameter Search Space</h4>
                                                <p className="text-sm text-gray-600">Enable parameters you want the optimizer to tune automatically:</p>
                                                
                                                {/* Epochs */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.epochs.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('epochs', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Epochs</span>
                                                            <p className="text-xs text-gray-600">Search between {config.bayesianConfig.searchSpace.epochs.min} and {config.bayesianConfig.searchSpace.epochs.max}</p>
                                                        </div>
                                                    </div>
                                                    {config.bayesianConfig.searchSpace.epochs.enabled && (
                                                        <div className="flex gap-2">
                                                            <Input 
                                                                type="number" 
                                                                value={config.bayesianConfig.searchSpace.epochs.min} 
                                                                onChange={e => handleSearchSpaceChange('epochs', 'min', parseInt(e.target.value))}
                                                                className="w-16 h-8 text-xs"
                                                                placeholder="Min"
                                                            />
                                                            <Input 
                                                                type="number" 
                                                                value={config.bayesianConfig.searchSpace.epochs.max} 
                                                                onChange={e => handleSearchSpaceChange('epochs', 'max', parseInt(e.target.value))}
                                                                className="w-16 h-8 text-xs"
                                                                placeholder="Max"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {/* Batch Size */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.batchSize.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('batchSize', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Batch Size</span>
                                                            <p className="text-xs text-gray-600">Choose from: {config.bayesianConfig.searchSpace.batchSize.options.join(', ')}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Learning Rate */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.learningRate.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('learningRate', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Learning Rate</span>
                                                            <p className="text-xs text-gray-600">Search between {config.bayesianConfig.searchSpace.learningRate.min} and {config.bayesianConfig.searchSpace.learningRate.max}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Image Size */}
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <Switch 
                                                            checked={config.bayesianConfig.searchSpace.imgSize.enabled}
                                                            onCheckedChange={value => handleSearchSpaceChange('imgSize', 'enabled', value)}
                                                        />
                                                        <div>
                                                            <span className="font-medium">Image Size</span>
                                                            <p className="text-xs text-gray-600">Choose from: {config.bayesianConfig.searchSpace.imgSize.options.join(', ')}px</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={isSubmitting || !config.runName}>
                            {isSubmitting ? "Starting Training..." : "Start Training"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
