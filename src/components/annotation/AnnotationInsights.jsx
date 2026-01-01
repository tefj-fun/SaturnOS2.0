import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Layers, Palette, ImageIcon } from 'lucide-react';

const StatCard = ({ title, value, icon, description }) => (
    <Card className="border-primary/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                {icon}
            </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

export default function AnnotationInsights({ project, steps, logicRules, stepImages }) {

    const aggregatedAnnotations = useMemo(() => {
        return stepImages.flatMap(image => image.annotations?.annotations || []);
    }, [stepImages]);

    const stats = useMemo(() => {
        const totalSteps = steps.length;
        const annotatedSteps = steps.filter(step => step.is_annotated).length;
        const stepsNeedClarification = steps.filter(step => step.needs_clarification).length;
        
        const totalAnnotations = aggregatedAnnotations.length;

        const classCounts = aggregatedAnnotations.reduce((acc, ann) => {
            if (ann.class) {
                acc[ann.class] = (acc[ann.class] || 0) + 1;
            }
            return acc;
        }, {});

        const uniqueClasses = Object.keys(classCounts).length;

        return {
            totalSteps,
            annotatedSteps,
            stepsNeedClarification,
            totalImages: stepImages.length,
            totalAnnotations,
            uniqueClasses,
            classCounts
        };
    }, [steps, stepImages, aggregatedAnnotations]);

    const stepProgress = stats.totalSteps > 0 ? (stats.annotatedSteps / stats.totalSteps) * 100 : 0;

    return (
        <div className="p-6 md:p-8 h-full overflow-y-auto bg-background">
            <Card className="mb-6 border-primary/10">
                <CardHeader className="border-b border-primary/10 bg-primary/5 p-4">
                    <CardTitle className="text-2xl text-primary">Annotation Project Insights</CardTitle>
                    <p className="text-muted-foreground">High-level overview of &quot;{project?.name}&quot;</p>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard 
                    title="Total Annotations" 
                    value={stats.totalAnnotations} 
                    icon={<Target className="h-4 w-4" />}
                    description="Total bounding boxes & shapes drawn"
                />
                <StatCard 
                    title="Annotated Images" 
                    value={stepImages.filter(img => img.annotations?.annotations?.length > 0).length}
                    icon={<ImageIcon className="h-4 w-4" />}
                    description={`out of ${stats.totalImages} total images`}
                />
                <StatCard 
                    title="Unique Classes" 
                    value={stats.uniqueClasses} 
                    icon={<Palette className="h-4 w-4" />}
                    description="Distinct object types being labeled"
                />
                <StatCard 
                    title="Steps Needing Review" 
                    value={stats.stepsNeedClarification} 
                    icon={<AlertTriangle className="h-4 w-4" />}
                    description="Steps flagged by AI for clarification"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card className="border-primary/10">
                    <CardHeader className="border-b border-primary/10 p-4">
                        <CardTitle className="text-primary">Class Distribution</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {stats.uniqueClasses > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(stats.classCounts).sort(([,a],[,b]) => b-a).map(([className, count]) => (
                                    <div key={className} className="flex items-center justify-between">
                                        <Badge variant="outline" className="border-primary/20 text-primary">
                                            {className}
                                        </Badge>
                                        <span className="font-mono text-sm">{count} annotations</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                           <p className="text-sm text-muted-foreground">No annotations with classes yet.</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="border-primary/10">
                    <CardHeader className="border-b border-primary/10 p-4">
                        <CardTitle className="text-primary">Project Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">Step Completion</span>
                                    <span className="text-sm">{stats.annotatedSteps} of {stats.totalSteps}</span>
                                </div>
                                <div className="w-full bg-primary/10 rounded-full h-2.5">
                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${stepProgress}%` }}></div>
                                </div>
                            </div>
                             <div>
                                <h4 className="text-sm font-medium mb-2">Logic & Rules</h4>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Layers className="h-4 w-4 mr-2 text-primary" />
                                        <span>{logicRules.length} active logic rules</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
