/**
 * Lightweight OpenAI chat wrappers used by the UI.
 * Expects VITE_OPENAI_API_KEY to be set.
 */

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

const getApiKey = () => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Set VITE_OPENAI_API_KEY in your environment.");
  }
  return apiKey;
};

const callOpenAI = async ({
  messages,
  temperature = 0.2,
  maxTokens = 800,
  responseFormat,
  model = DEFAULT_MODEL,
}) => {
  const apiKey = getApiKey();
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response missing content");
  }

  return content;
};

export async function invokeLLM({
  prompt,
  response_json_schema,
  temperature = 0.2,
  max_tokens = 600,
  model = DEFAULT_MODEL,
}) {
  const systemLines = ["You are a helpful assistant."];
  if (response_json_schema) {
    systemLines.push(
      "Return only valid JSON that matches this schema:",
      JSON.stringify(response_json_schema)
    );
  }

  const messages = [
    { role: "system", content: systemLines.join("\n") },
    { role: "user", content: prompt },
  ];

  const content = await callOpenAI({
    messages,
    temperature,
    maxTokens: max_tokens,
    responseFormat: response_json_schema ? { type: "json_object" } : undefined,
    model,
  });

  if (!response_json_schema) {
    return content.trim();
  }

  try {
    return JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to parse OpenAI JSON response");
  }
}

export async function generateStepsFromSOP({ sopUrl, prompt, temperature = 0.2 }) {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert in computer vision and object detection annotation. " +
        "Return ONLY valid JSON: an array of step objects with fields " +
        'title, description, product, condition, classes (array of strings), status, clarity_score, business_logic. ' +
        "Do not include any prose outside the JSON.",
    },
    {
      role: "user",
      content:
        `${prompt}\n\n` +
        `SOP file URL: ${sopUrl}\n` +
        "Output strictly JSON with no markdown, no code fences.",
    },
  ];

  const content = await callOpenAI({
    messages,
    temperature,
    maxTokens: 800,
    responseFormat: { type: "json_object" },
  });

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new Error("Failed to parse OpenAI JSON response");
  }

  // The model returns { steps: [...] } or an array directly. Normalize to array.
  if (Array.isArray(parsed)) return parsed;
  if (parsed.steps && Array.isArray(parsed.steps)) return parsed.steps;
  throw new Error("OpenAI response did not contain steps array");
}
