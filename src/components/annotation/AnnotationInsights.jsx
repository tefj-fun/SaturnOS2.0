import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, AlertTriangle, Layers, Palette, ImageIcon } from 'lucide-react';

const StatCard = ({ title, value, icon, description }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
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
        <div className="p-6 h-full overflow-y-auto bg-gray-50">
            <Card className="mb-6 bg-white">
                <CardHeader>
                    <CardTitle className="text-2xl">Annotation Project Insights</CardTitle>
                    <p className="text-muted-foreground">High-level overview of '{project?.name}'</p>
                </CardHeader>
            </Card>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <StatCard 
                    title="Total Annotations" 
                    value={stats.totalAnnotations} 
                    icon={<Target className="h-4 w-4 text-muted-foreground" />}
                    description="Total bounding boxes & shapes drawn"
                />
                <StatCard 
                    title="Annotated Images" 
                    value={stepImages.filter(img => img.annotations?.annotations?.length > 0).length}
                    icon={<ImageIcon className="h-4 w-4 text-muted-foreground" />}
                    description={`out of ${stats.totalImages} total images`}
                />
                <StatCard 
                    title="Unique Classes" 
                    value={stats.uniqueClasses} 
                    icon={<Palette className="h-4 w-4 text-muted-foreground" />}
                    description="Distinct object types being labeled"
                />
                <StatCard 
                    title="Steps Needing Review" 
                    value={stats.stepsNeedClarification} 
                    icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                    description="Steps flagged by AI for clarification"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Class Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {stats.uniqueClasses > 0 ? (
                            <div className="space-y-2">
                                {Object.entries(stats.classCounts).sort(([,a],[,b]) => b-a).map(([className, count]) => (
                                    <div key={className} className="flex items-center justify-between">
                                        <Badge variant="secondary">{className}</Badge>
                                        <span className="font-mono text-sm">{count} annotations</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                           <p className="text-sm text-muted-foreground">No annotations with classes yet.</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Project Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-4">
                            <div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm font-medium">Step Completion</span>
                                    <span className="text-sm">{stats.annotatedSteps} of {stats.totalSteps}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${stepProgress}%` }}></div>
                                </div>
                            </div>
                             <div>
                                <h4 className="text-sm font-medium mb-2">Logic & Rules</h4>
                                <div className="flex items-center space-x-4">
                                    <div className="flex items-center text-sm text-muted-foreground">
                                        <Layers className="h-4 w-4 mr-2" />
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