import { invokeLLM } from "@/api/llm";

// GPT + Supabase helpers for app integrations.
export const InvokeLLM = async ({ prompt, response_json_schema, temperature, max_tokens, model }) =>
  invokeLLM({
    prompt,
    response_json_schema,
    temperature,
    max_tokens,
    model,
  });

export const UploadFile = async () => {
  throw new Error("UploadFile is disabled. Use uploadToSupabaseStorage in src/api/storage.js.");
};




