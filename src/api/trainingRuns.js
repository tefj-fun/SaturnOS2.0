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
  async list(orderBy) {
    let query = supabase.from(TABLE).select("*");
    query = applyOrder(query, orderBy);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeRun);
  },

  async filter(filters = {}, orderBy) {
    let query = supabase.from(TABLE).select("*");
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(mapColumn(key), value);
    });
    query = applyOrder(query, orderBy);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizeRun);
  },

  async create(payload) {
    const insertPayload = {
      created_by: payload.created_by || FALLBACK_CREATED_BY,
      ...payload,
    };
    const { data, error } = await supabase
      .from(TABLE)
      .insert(insertPayload)
      .select()
      .single();
    if (error) throw error;
    return normalizeRun(data);
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return normalizeRun(data);
  },

  async delete(id) {
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
  },
};
