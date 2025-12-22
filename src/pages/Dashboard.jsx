
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { supabase } from "@/api/supabaseClient";
import { listProjects, listAllSteps, listTrainingRuns } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  FolderPlus,
  PenTool,
  Spline,
  CheckCircle,
  Clock,
  Target,
  Brain,
  TrendingUp,
  Activity,
  FileText,
  ArrowRight,
  Sparkles,
  Database } from
"lucide-react";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [allSteps, setAllSteps] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    projectsInProgress: 0,
    completedProjects: 0,
    totalAnnotations: 0,
    modelsTrained: 0,
    totalSOPs: 0,
    stepsNeedingClarification: 0,
    averageModelAccuracy: 0,
    totalUniqueLabels: 0,
    averageAnnotationsPerProject: 0,
    totalStepsGenerated: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadDashboardData = useCallback(async () => {
    try {
      const [{ data: authUser }, projectsData, stepsData, runsData] = await Promise.all([
        supabase.auth.getUser(),
        listProjects(),
        listAllSteps(),
        listTrainingRuns(10)
      ]);

      setUser(authUser?.user ? { full_name: authUser.user.email, role: "admin" } : { full_name: "Local User", role: "admin" });
      setProjects(projectsData);
      setAllSteps(stepsData);

      // Calculate basic statistics
      const totalProjects = projectsData.length;
      const projectsInProgress = projectsData.filter((p) =>
      p.status === 'annotation_in_progress' || p.status === 'steps_generated'
      ).length;
      const completedProjects = projectsData.filter((p) => p.status === 'completed').length;
      const totalAnnotations = stepsData.filter((s) => s.is_annotated).length;
      const modelsTrained = runsData.filter((r) => r.status === 'completed').length;

      // Calculate holistic statistics
      const totalSOPs = projectsData.filter((p) => p.sop_file_url && p.status !== 'created').length;
      const stepsNeedingClarification = stepsData.filter((s) => s.needs_clarification).length;
      const totalStepsGenerated = stepsData.length;

      // Calculate average model accuracy from completed training runs
      const completedRuns = runsData.filter((r) => r.status === 'completed' && r.results?.mAP);
      const averageModelAccuracy = completedRuns.length > 0 ?
      completedRuns.reduce((sum, run) => sum + (run.results.mAP || 0), 0) / completedRuns.length :
      0;

      // Calculate unique labels across all steps
      const allLabels = new Set();
      stepsData.forEach((step) => {
        if (step.classes && Array.isArray(step.classes)) {
          step.classes.forEach((className) => {
            if (className && className.trim()) {
              allLabels.add(className.trim().toLowerCase());
            }
          });
        }
      });
      const totalUniqueLabels = allLabels.size;

      // Calculate average annotations per project
      const averageAnnotationsPerProject = totalProjects > 0 ?
      Math.round(totalAnnotations / totalProjects) :
      0;

      setStats({
        totalProjects,
        projectsInProgress,
        completedProjects,
        totalAnnotations,
        modelsTrained,
        totalSOPs,
        stepsNeedingClarification,
        averageModelAccuracy: Math.round(averageModelAccuracy * 100), // Convert to percentage
        totalUniqueLabels,
        averageAnnotationsPerProject,
        totalStepsGenerated
      });

      // Generate recent activity
      generateRecentActivity(projectsData, runsData);

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const generateRecentActivity = (projects, runs) => {
    const activities = [];

    // Add recent project updates
    projects.slice(0, 3).forEach((project) => {
      activities.push({
        id: `project-${project.id}`,
        type: 'project',
        message: `Project "${project.name}" was ${project.status === 'completed' ? 'completed' : 'updated'}`,
        date: project.updated_at || project.created_at,
        icon: <FolderPlus className="w-4 h-4 text-blue-600" />,
        color: 'blue'
      });
    });

    // Add recent training runs
    runs.slice(0, 3).forEach((run) => {
      const statusMessage = run.status === 'completed' ? 'completed successfully' :
      run.status === 'running' ? 'started training' : 'was queued';
      activities.push({
        id: `run-${run.id}`,
        type: 'training',
        message: `Model "${run.run_name}" ${statusMessage}`,
        date: run.updated_at || run.created_at,
        icon: <Brain className="w-4 h-4 text-green-600" />,
        color: 'green'
      });
    });

    // Sort by date and take most recent 5
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    setRecentActivity(activities.slice(0, 5));
  };

  const getProjectProgress = (project) => {
    const projectSteps = allSteps.filter((step) => step.project_id === project.id);
    if (projectSteps.length === 0) return 0;
    const annotatedSteps = projectSteps.filter((step) => step.is_annotated).length;
    return Math.round(annotatedSteps / projectSteps.length * 100);
  };

  const getStatusConfig = (status) => {
    const configs = {
      created: { label: "Created", color: "bg-gray-100 text-gray-700", icon: Clock },
      sop_uploaded: { label: "SOP Uploaded", color: "bg-blue-100 text-blue-700", icon: FileText },
      steps_generated: { label: "Steps Ready", color: "bg-amber-100 text-amber-700", icon: Target },
      annotation_in_progress: { label: "In Progress", color: "bg-teal-100 text-teal-700", icon: PenTool },
      completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle }
    };
    return configs[status] || configs.created;
  };

  const getMostActiveProject = () => {
    return projects.find((p) => p.status === 'annotation_in_progress') ||
    projects.find((p) => p.status === 'steps_generated') ||
    projects[0];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <Activity className="w-8 h-8 animate-pulse text-blue-600" />
          </div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>);

  }

  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto">
        {/* Welcome Header */}
        <div className="mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between">

            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {user?.full_name?.split(' ')[0] || 'there'}! 👋
              </h1>
              <p className="text-gray-600 text-lg">
                Here&apos;s what&apos;s happening with your annotation projects
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <Sparkles className="w-3 h-3 mr-1" />
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </Badge>
            </div>
          </motion.div>
        </div>

        {/* Enhanced Statistics Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">

          {/* Project Stats */}
          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalProjects}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.projectsInProgress} in progress</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FolderPlus className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">SOPs Processed</p>
                  <p className="text-3xl font-bold text-indigo-600">{stats.totalSOPs}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.totalStepsGenerated} steps generated</p>
                </div>
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Need Clarification</p>
                  <p className="text-3xl font-bold text-amber-600">{stats.stepsNeedingClarification}</p>
                  <p className="text-xs text-gray-500 mt-1">Steps requiring review</p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Annotations</p>
                  <p className="text-3xl font-bold text-teal-600">{stats.totalAnnotations}</p>
                  <p className="text-xs text-gray-500 mt-1">Avg {stats.averageAnnotationsPerProject}/project</p>
                </div>
                <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-teal-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Unique Labels</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.totalUniqueLabels}</p>
                  <p className="text-xs text-gray-500 mt-1">Classes defined</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Models Trained</p>
                  <p className="text-3xl font-bold text-green-600">{stats.modelsTrained}</p>
                  <p className="text-xs text-gray-500 mt-1">Successfully completed</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Model Accuracy</p>
                  <p className="text-3xl font-bold text-emerald-600">{stats.averageModelAccuracy}%</p>
                  <p className="text-xs text-gray-500 mt-1">Mean Average Precision</p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed Projects</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.completedProjects}</p>
                  <p className="text-xs text-gray-500 mt-1">Ready for production</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-1">

            <Card className="glass-effect border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                <Link to={createPageUrl('Projects')}>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 justify-start" size="lg">
                    <Plus className="w-5 h-5 mr-3" />
                    Create New Project
                  </Button>
                </Link>

                {getMostActiveProject() &&
                <Link to={createPageUrl(`AnnotationStudio?projectId=${getMostActiveProject().id}`)}>
                    <Button variant="outline" className="w-full justify-start" size="lg">
                      <PenTool className="w-5 h-5 mr-3" />
                      Continue Annotating
                    </Button>
                  </Link>
                }

                <Link to={createPageUrl('TrainingConfiguration')}>
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Spline className="w-5 h-5 mr-3" />
                    Start Training
                  </Button>
                </Link>

                <Link to={createPageUrl('LabelLibrary')}>
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Database className="w-5 h-5 mr-3" />
                    Manage Labels
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Projects */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2">

            <Card className="glass-effect border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FolderPlus className="w-5 h-5 text-blue-600" />
                    Recent Projects
                  </CardTitle>
                  <Link to={createPageUrl('Projects')}>
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ?
                <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <FolderPlus className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No projects yet</h3>
                    <p className="text-gray-500 mb-4">Create your first annotation project to get started</p>
                    <Link to={createPageUrl('Projects')}>
                      <Button className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Project
                      </Button>
                    </Link>
                  </div> :

                <div className="space-y-2">
                    {projects.slice(0, 4).map((project) => {
                    const statusConfig = getStatusConfig(project.status);
                    const progress = getProjectProgress(project);

                    return (
                      <div key={project.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-gray-900">{project.name}</h4>
                              <Badge className={`${statusConfig.color} border-0 text-xs`}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            {project.description &&
                          <p className="text-sm text-gray-600 mb-1">{project.description}</p>
                          }
                            {(project.status === 'annotation_in_progress' || project.status === 'completed') &&
                          <div className="flex items-center gap-1">
                                <Progress value={progress} className="h-1 flex-1" />
                                <span className="text-xs text-gray-500">{progress}%</span>
                              </div>
                          }
                          </div>
                          <Link to={createPageUrl(`Projects`)}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>);

                  })}
                  </div>
                }
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }} className="py-5">

          <Card className="glass-effect border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ?
              <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No recent activity</p>
                </div> :

              <div className="space-y-4">
                  {recentActivity.map((activity) =>
                <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-full bg-${activity.color}-100`}>
                        {activity.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{activity.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(activity.date).toLocaleDateString()} at {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>);

}
