import { createClient } from '@supabase/supabase-js';

// Fallbacks to keep dev running if env vars are missing (replace in production)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://iwyxdfjycizqxxyfupvc.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3eXhkZmp5Y2l6cXh4eWZ1cHZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMDkwODUsImV4cCI6MjA4MTU4NTA4NX0.g1naK7xec_oaGhZPERBNlr3FFlrAznKU5eTk7IND5eg";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("Supabase env vars missing; using hardcoded fallbacks. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
