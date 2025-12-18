import { invokeLLM } from "@/api/llm";

// Base44 integrations replaced with GPT + Supabase helpers.
export const InvokeLLM = async ({ prompt, response_json_schema, temperature, max_tokens, model }) =>
  invokeLLM({
    prompt,
    response_json_schema,
    temperature,
    max_tokens,
    model,
  });

export const UploadFile = async () => {
  throw new Error("Base44 UploadFile is disabled. Use uploadToSupabaseStorage in src/api/storage.js.");
};




