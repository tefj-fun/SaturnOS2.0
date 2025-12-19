import { supabase } from "./supabaseClient";

const TABLE = "training_runs";
const FALLBACK_CREATED_BY = "unknown@local";

const columnAliases = {
  created_date: "created_at",
  updated_date: "updated_at",
};

function mapColumn(key) {
  return columnAliases[key] || key;
}

function getMissingColumn(error) {
  const message = error?.message || "";
  const match = message.match(/column [^.]+\\.([a-zA-Z0-9_]+) does not exist/i);
  return match ? match[1] : null;
}

function normalizeRun(run) {
  if (!run) return run;
  return {
    ...run,
    created_date: run.created_at,
    updated_date: run.updated_at,
    created_by: run.created_by || FALLBACK_CREATED_BY,
  };
}

function applyOrder(query, orderBy) {
  if (!orderBy) return query;
  const descending = orderBy.startsWith("-");
  const rawKey = descending ? orderBy.slice(1) : orderBy;
  const key = mapColumn(rawKey);
  return query.order(key, { ascending: !descending });
}

export const TrainingRun = {
  async executeFilter(filters = {}, orderBy) {
    let query = supabase.from(TABLE).select("*");
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      query = query.eq(mapColumn(key), value);
    });
    query = applyOrder(query, orderBy);
    return query;
  },

  async list(orderBy) {
    let query = supabase.from(TABLE).select("*");
    query = applyOrder(query, orderBy);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeRun);
  },

  async filter(filters = {}, orderBy) {
    let query = await this.executeFilter(filters, orderBy);
    let { data, error } = await query;
    if (error) {
      const missingColumn = getMissingColumn(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(filters, missingColumn)) {
        const fallbackFilters = { ...filters };
        delete fallbackFilters[missingColumn];
        console.warn(
          `TrainingRun.filter: missing column "${missingColumn}". ` +
          "Apply migration 0007_update_training_runs.sql to restore full filtering."
        );
        if (Object.keys(fallbackFilters).length === 0) {
          return [];
        }
        query = await this.executeFilter(fallbackFilters, orderBy);
        ({ data, error } = await query);
      }
    }
    if (error) throw error;
    return (data || []).map(normalizeRun);
  },

  async create(payload) {
    const insertPayload = {
      created_by: payload.created_by || FALLBACK_CREATED_BY,
      ...payload,
    };
    let { data, error } = await supabase
      .from(TABLE)
      .insert(insertPayload)
      .select()
      .single();
    if (error) {
      const missingColumn = getMissingColumn(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(insertPayload, missingColumn)) {
        const fallbackPayload = { ...insertPayload };
        delete fallbackPayload[missingColumn];
        console.warn(
          `TrainingRun.create: missing column "${missingColumn}". ` +
          "Apply migration 0007_update_training_runs.sql to store all fields."
        );
        ({ data, error } = await supabase
          .from(TABLE)
          .insert(fallbackPayload)
          .select()
          .single());
      }
    }
    if (error) throw error;
    return normalizeRun(data);
  },

  async update(id, updates) {
    let { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      const missingColumn = getMissingColumn(error);
      if (missingColumn && Object.prototype.hasOwnProperty.call(updates, missingColumn)) {
        const fallbackUpdates = { ...updates };
        delete fallbackUpdates[missingColumn];
        console.warn(
          `TrainingRun.update: missing column "${missingColumn}". ` +
          "Apply migration 0007_update_training_runs.sql to store all fields."
        );
        ({ data, error } = await supabase
          .from(TABLE)
          .update(fallbackUpdates)
          .eq("id", id)
          .select()
          .single());
      }
    }
    if (error) throw error;
    return normalizeRun(data);
  },

  async delete(id) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
