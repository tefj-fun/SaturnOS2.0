import { supabase } from "./supabaseClient";

const BYTES_PER_GB = 1024 * 1024 * 1024;

const getMonthRange = (referenceDate = new Date()) => {
  const start = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), 1, 0, 0, 0));
  const end = new Date(referenceDate);
  return { start, end };
};

const normalizeConfig = (config) => {
  if (!config) return null;
  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch {
      return null;
    }
  }
  if (typeof config === "object") return config;
  return null;
};

const isCpuRun = (config) => {
  const compute = config?.compute ?? config?.device;
  if (!compute) return false;
  if (typeof compute === "string") {
    return compute.toLowerCase().includes("cpu");
  }
  return false;
};

const toIso = (value) => value.toISOString();

const calculateTrainingHours = (runs, rangeEnd) => {
  return runs.reduce((total, run) => {
    if (!run?.started_at) return total;
    const started = new Date(run.started_at);
    const ended = run.completed_at ? new Date(run.completed_at) : rangeEnd;
    if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) return total;
    if (ended <= started) return total;
    const config = normalizeConfig(run.configuration);
    if (isCpuRun(config)) return total;
    return total + (ended.getTime() - started.getTime()) / 3600000;
  }, 0);
};

export async function fetchMonthlyUsageSummary(referenceDate) {
  const { start, end } = getMonthRange(referenceDate);
  const startIso = toIso(start);
  const endIso = toIso(end);

  const [trainingResponse, inferenceResponse, storageResponse] = await Promise.all([
    supabase
      .from("training_runs")
      .select("started_at, completed_at, configuration")
      .gte("started_at", startIso)
      .lte("started_at", endIso),
    supabase
      .from("predicted_annotations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabase
      .from("step_images")
      .select("file_size")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
  ]);

  if (trainingResponse.error) throw trainingResponse.error;
  if (inferenceResponse.error) throw inferenceResponse.error;
  if (storageResponse.error) throw storageResponse.error;

  const trainingHours = calculateTrainingHours(trainingResponse.data || [], end);
  const inferenceCount = inferenceResponse.count || 0;
  const storageBytes = (storageResponse.data || []).reduce(
    (total, row) => total + (Number(row?.file_size) || 0),
    0
  );

  return {
    training: Number.isFinite(trainingHours) ? trainingHours : 0,
    inference: Number.isFinite(inferenceCount) ? inferenceCount : 0,
    storage: Number.isFinite(storageBytes) ? storageBytes / BYTES_PER_GB : 0,
  };
}
