import { supabase } from "./supabaseClient";
import { TrainingRun } from "./trainingRuns";

const DEFAULT_COLUMN_ALIASES = {
  created_date: "created_at",
  updated_date: "updated_at",
};

function mapColumn(key, columnAliases = DEFAULT_COLUMN_ALIASES) {
  return columnAliases[key] || key;
}

function normalizeRecord(record) {
  if (!record) return record;
  return {
    ...record,
    created_date: record.created_at ?? record.created_date,
    updated_date: record.updated_at ?? record.updated_date,
  };
}

function mapPayload(payload, columnAliases = DEFAULT_COLUMN_ALIASES) {
  if (!payload) return payload;
  return Object.entries(payload).reduce((acc, [key, value]) => {
    acc[mapColumn(key, columnAliases)] = value;
    return acc;
  }, {});
}

function applyOrder(query, orderBy, columnAliases = DEFAULT_COLUMN_ALIASES) {
  if (!orderBy) return query;
  const descending = orderBy.startsWith("-");
  const rawKey = descending ? orderBy.slice(1) : orderBy;
  const key = mapColumn(rawKey, columnAliases);
  return query.order(key, { ascending: !descending });
}

function createEntity(table, { columnAliases = DEFAULT_COLUMN_ALIASES } = {}) {
  return {
    async list(orderBy) {
      let query = supabase.from(table).select("*");
      query = applyOrder(query, orderBy, columnAliases);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeRecord);
    },

    async filter(filters = {}, orderBy) {
      let query = supabase.from(table).select("*");
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined) return;
        const column = mapColumn(key, columnAliases);
        if (value === null) {
          query = query.is(column, null);
          return;
        }
        if (Array.isArray(value)) {
          query = query.in(column, value);
          return;
        }
        query = query.eq(column, value);
      });
      query = applyOrder(query, orderBy, columnAliases);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(normalizeRecord);
    },

    async create(payload) {
      const insertPayload = mapPayload(payload, columnAliases);
      const { data, error } = await supabase
        .from(table)
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return normalizeRecord(data);
    },

    async bulkCreate(records) {
      if (!Array.isArray(records) || records.length === 0) return;
      const payload = records.map((record) =>
        mapPayload(record, columnAliases)
      );
      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;
    },

    async update(id, updates) {
      const updatePayload = mapPayload(updates, columnAliases);
      const { data, error } = await supabase
        .from(table)
        .update(updatePayload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return normalizeRecord(data);
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
  };
}

export const Project = createEntity("projects");
export const SOPStep = createEntity("sop_steps");
export const LogicRule = createEntity("logic_rules");
export const StepImage = createEntity("step_images");
export const PredictedAnnotation = createEntity("predicted_annotations");
export const LabelLibrary = createEntity("label_library_view");
export const ProjectMember = createEntity("project_members");
export const BuildVariant = createEntity("build_variants");
export const StepVariantConfig = createEntity("step_variant_configs");
export const TrainerWorker = createEntity("trainer_workers");

export { TrainingRun };

export const User = supabase.auth;
