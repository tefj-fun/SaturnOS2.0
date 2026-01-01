import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, Sparkles, X } from "lucide-react";
import { updateProfile } from "@/api/profiles";
import { useAuth } from "@/contexts/AuthContext";
import { createPageUrl } from "@/utils";
import { onboardingFeatureEnabled } from "@/lib/onboarding";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const normalizeCount = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
};

export default function OnboardingChecklist({
  projectId,
  projectName,
  stepsCount,
  imagesCount,
  annotationsCount,
  copilotUsed,
  logicRulesCount,
  trainingRunsCount,
  className,
  compact = false,
  hideProgress = false,
  variant = "full"
}) {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);
  const onboardingEnabled = onboardingFeatureEnabled
    && (profile?.preferences?.onboarding?.enabled ?? true);

  const normalized = useMemo(() => ({
    stepsCount: normalizeCount(stepsCount),
    imagesCount: normalizeCount(imagesCount),
    annotationsCount: normalizeCount(annotationsCount),
    logicRulesCount: normalizeCount(logicRulesCount),
    trainingRunsCount: normalizeCount(trainingRunsCount),
  }), [stepsCount, imagesCount, annotationsCount, logicRulesCount, trainingRunsCount]);

  const steps = useMemo(() => {
    const projectsUrl = createPageUrl("Projects");
    const stepManagementUrl = projectId
      ? createPageUrl(`StepManagement?projectId=${projectId}`)
      : projectsUrl;
    const annotationUrl = projectId
      ? createPageUrl(`AnnotationStudio?projectId=${projectId}`)
      : projectsUrl;
    const trainingUrl = projectId
      ? createPageUrl(`TrainingConfiguration?projectId=${projectId}`)
      : createPageUrl("TrainingConfiguration");

    const allSteps = [
      {
        id: "create_project",
        label: "Create a project",
        detail: "Define what you want to label.",
        complete: Boolean(projectId),
        action: { label: "Create project", url: projectsUrl },
      },
      {
        id: "add_steps",
        label: "Add steps",
        detail: "Build your SOP driven workflow.",
        complete: normalized.stepsCount === null ? null : normalized.stepsCount > 0,
        action: { label: "Manage steps", url: stepManagementUrl },
      },
      {
        id: "add_images",
        label: "Add images",
        detail: "Upload or connect your dataset.",
        complete: normalized.imagesCount === null ? null : normalized.imagesCount > 0,
        action: { label: "Add images", url: annotationUrl },
      },
      {
        id: "add_annotations",
        label: "Add annotations",
        detail: "Label a few samples to seed training.",
        complete: normalized.annotationsCount === null ? null : normalized.annotationsCount > 0,
        action: { label: "Annotate images", url: annotationUrl },
      },
      {
        id: "use_copilot",
        label: "Use AI copilot",
        detail: "Ask the copilot for guidance.",
        complete: copilotUsed == null ? null : Boolean(copilotUsed),
        action: { label: "Open copilot", url: annotationUrl },
      },
      {
        id: "add_logic",
        label: "Add step logic",
        detail: "Turn instructions into rules.",
        complete: normalized.logicRulesCount === null ? null : normalized.logicRulesCount > 0,
        action: { label: "Add logic rules", url: annotationUrl },
      },
      {
        id: "start_training",
        label: "Start training run",
        detail: "Launch your first model run.",
        complete: normalized.trainingRunsCount === null ? null : normalized.trainingRunsCount > 0,
        action: { label: "Start training", url: trainingUrl },
      },
    ];
    if (variant !== "starter") {
      return allSteps;
    }
    const starterStepIds = new Set([
      "create_project",
      "add_steps",
      "add_images",
      "add_annotations",
      "start_training",
    ]);
    return allSteps
      .filter((step) => starterStepIds.has(step.id))
      .map((step) => (
        step.complete === null ? { ...step, complete: false } : step
      ));
  }, [
    projectId,
    normalized.stepsCount,
    normalized.imagesCount,
    normalized.annotationsCount,
    normalized.logicRulesCount,
    normalized.trainingRunsCount,
    copilotUsed,
    variant,
  ]);

  const completedCount = steps.filter((step) => step.complete === true).length;
  const totalCount = steps.length;
  const progressValue = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextStep = steps.find((step) => step.complete !== true);

  const handleStepAction = (step) => {
    if (!step?.action?.url) return;
    navigate(step.action.url);
  };

  const handleStepKeyDown = (event, step) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleStepAction(step);
  };

  const handleDisable = async () => {
    if (!user?.id || isUpdating) return;
    setIsUpdating(true);
    try {
      const nextPreferences = {
        ...(profile?.preferences || {}),
        onboarding: {
          ...(profile?.preferences?.onboarding || {}),
          enabled: false,
        },
      };
      const updated = await updateProfile(user.id, { preferences: nextPreferences });
      setProfile(updated);
    } catch (error) {
      console.error("Failed to update onboarding preferences:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!onboardingEnabled) {
    return null;
  }

  return (
    <Card className={`glass-effect border-0 shadow-lg ${className || ""}`}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="w-5 h-5 text-blue-600" />
            Guided onboarding
          </CardTitle>
          <p className="text-xs sm:text-sm text-gray-600">
            {projectName ? `Project: ${projectName}` : "Follow the checklist to get your first model trained."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">
            {completedCount}/{totalCount} complete
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisable}
            disabled={isUpdating}
            className="text-gray-500"
          >
            <X className="w-4 h-4" />
            <span className="sr-only">Hide onboarding</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hideProgress && (
          <div className="space-y-2">
            <Progress value={progressValue} className="h-2" />
            <p className="text-xs text-gray-500">{progressValue}% complete</p>
          </div>
        )}
        <div className={`space-y-3 ${compact ? "text-sm" : ""}`}>
          {steps.map((step, index) => {
            const isDone = step.complete === true;
            const isUnknown = step.complete === null;
            const isNext = nextStep?.id === step.id;
            const isActionable = !isDone && isNext && step.action?.url;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 ${isActionable ? "cursor-pointer rounded-lg border border-transparent p-2 -m-2 transition-colors hover:border-slate-200 hover:bg-slate-50" : ""}`}
                role={isActionable ? "button" : undefined}
                tabIndex={isActionable ? 0 : undefined}
                onClick={isActionable ? () => handleStepAction(step) : undefined}
                onKeyDown={isActionable ? (event) => handleStepKeyDown(event, step) : undefined}
              >
                {isDone ? (
                  <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5" />
                ) : (
                  <div className="w-5 h-5 rounded-full border border-gray-300 text-xs text-gray-500 flex items-center justify-center mt-0.5">
                    {index + 1}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${isDone ? "text-gray-500 line-through" : "text-gray-900"}`}>
                      {step.label}
                    </p>
                    {isUnknown && (
                      <Badge variant="secondary" className="text-xs">
                        Not checked
                      </Badge>
                    )}
                    {!isDone && !isUnknown && isNext && (
                      <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">
                        Next
                      </Badge>
                    )}
                  </div>
                  {!compact && step.detail && (
                    <p className="text-xs text-gray-500 mt-1">{step.detail}</p>
                  )}
                </div>
                {!isDone && isNext && step.action?.url && (
                  <Button variant="outline" size="sm" className="text-xs whitespace-nowrap" asChild>
                    <Link
                      to={step.action.url}
                      onClick={(event) => event.stopPropagation()}
                    >
                      {step.action.label}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
