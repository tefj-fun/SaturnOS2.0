import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { listProjects, listStepImages, listStepsByProject } from "@/api/db";
import { LogicRule, TrainingRun } from "@/api/entities";
import { updateProfile } from "@/api/profiles";
import { useAuth } from "@/contexts/AuthContext";
import { createPageUrl } from "@/utils";
import { onboardingFeatureEnabled } from "@/lib/onboarding";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const emptyStats = {
  stepsCount: null,
  imagesCount: null,
  annotationsCount: null,
  logicRulesCount: null,
  trainingRunsCount: null,
};

const extractAnnotations = (imageRow) => {
  const raw = imageRow?.annotations;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object") {
    if (Array.isArray(raw.annotations)) return raw.annotations;
    if (Array.isArray(raw.objects)) return raw.objects;
  }
  return [];
};

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, setProfile } = useAuth();
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [stats, setStats] = useState(emptyStats);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  );

  const onboardingEnabled = onboardingFeatureEnabled
    && (profile?.preferences?.onboarding?.enabled ?? true);

  const loadProjects = useCallback(async () => {
    setErrorMessage("");
    try {
      const data = await listProjects();
      setProjects(data);
      if (data.length > 0) {
        setSelectedProjectId((current) => current || data[0].id);
      }
    } catch (error) {
      console.error("Failed to load projects:", error);
      setErrorMessage("Unable to load projects. Try again in a moment.");
    }
  }, []);

  const loadProjectStats = useCallback(async (projectId) => {
    if (!projectId) {
      setStats(emptyStats);
      return;
    }
    try {
      const steps = await listStepsByProject(projectId);
      const stepIds = steps.map((step) => step.id);
      let imagesCount = 0;
      let annotationsCount = 0;
      if (stepIds.length > 0) {
        const imagesByStep = await Promise.all(
          stepIds.map((stepId) => listStepImages(stepId))
        );
        imagesByStep.forEach((images) => {
          imagesCount += images.length;
          annotationsCount += images.filter((image) => extractAnnotations(image).length > 0).length;
        });
      }
      const [trainingRuns, logicRules] = await Promise.all([
        TrainingRun.filter({ project_id: projectId }),
        stepIds.length > 0 ? LogicRule.filter({ step_id: stepIds }) : Promise.resolve([]),
      ]);
      setStats({
        stepsCount: steps.length,
        imagesCount,
        annotationsCount,
        logicRulesCount: logicRules.length,
        trainingRunsCount: trainingRuns.length,
      });
    } catch (error) {
      console.error("Failed to load onboarding stats:", error);
      setStats(emptyStats);
    }
  }, []);

  useEffect(() => {
    if (!onboardingFeatureEnabled) {
      navigate(createPageUrl("Projects"), { replace: true });
      return;
    }
    loadProjects();
  }, [loadProjects, navigate]);

  useEffect(() => {
    if (!onboardingFeatureEnabled) {
      return;
    }
    if (!selectedProjectId) {
      setStats(emptyStats);
      return;
    }
    loadProjectStats(selectedProjectId);
  }, [selectedProjectId, loadProjectStats]);

  const handleComplete = async () => {
    if (!user?.id) {
      navigate(createPageUrl("Projects"));
      return;
    }
    setIsCompleting(true);
    try {
      const nextPreferences = {
        ...(profile?.preferences || {}),
        onboarding: {
          ...(profile?.preferences?.onboarding || {}),
          completed: true,
        },
      };
      const updated = await updateProfile(user.id, { preferences: nextPreferences });
      setProfile(updated);
    } catch (error) {
      console.error("Failed to update onboarding preferences:", error);
    } finally {
      setIsCompleting(false);
      navigate(createPageUrl("Projects"));
    }
  };

  return (
    <div className="min-h-screen px-6 py-8 md:px-10 md:py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-slate-50 p-6 md:p-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <Sparkles className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.3em]">Welcome</span>
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              Let us build your first model together
            </h1>
            <p className="text-sm text-gray-600 md:text-base">
              Start with a project, add steps and images, then kick off training. We will guide you the whole way.
            </p>
          </div>
        </div>

        {errorMessage && (
          <Alert className="border-amber-200 bg-amber-50">
            <AlertTitle className="text-amber-900">Heads up</AlertTitle>
            <AlertDescription className="text-amber-800">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          {onboardingEnabled && (
            <OnboardingChecklist
              projectId={selectedProjectId || null}
              projectName={selectedProject?.name}
              stepsCount={stats.stepsCount}
              imagesCount={stats.imagesCount}
              annotationsCount={stats.annotationsCount}
              copilotUsed={null}
              logicRulesCount={stats.logicRulesCount}
              trainingRunsCount={stats.trainingRunsCount}
              className="h-full"
              variant="starter"
            />
          )}
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-gray-900">Ready to explore the workspace?</p>
            <p className="text-xs text-gray-500">You can always return to onboarding from Settings.</p>
          </div>
          <Button
            className="bg-amber-600 text-white hover:bg-amber-700"
            onClick={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? "Finishing..." : "Finish onboarding"}
          </Button>
        </div>

        {!onboardingEnabled && (
          <p className="text-xs text-gray-400">
            Onboarding is disabled in settings. You can re-enable it anytime.
          </p>
        )}
      </div>
    </div>
  );
}
