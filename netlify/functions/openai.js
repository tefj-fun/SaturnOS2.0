const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "Missing OPENAI_API_KEY" });
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Invalid JSON payload" });
  }

  const { messages, temperature, maxTokens, responseFormat, model } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: "messages must be a non-empty array" });
  }

  const requestBody = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature: typeof temperature === "number" ? temperature : 0.2,
    max_tokens: typeof maxTokens === "number" ? maxTokens : 800,
  };

  if (responseFormat) {
    requestBody.response_format = responseFormat;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    return jsonResponse(502, { error: "Failed to reach OpenAI API" });
  }

  const upstreamText = await upstreamResponse.text();
  if (!upstreamResponse.ok) {
    return {
      statusCode: upstreamResponse.status,
      headers: { "Content-Type": "application/json" },
      body: upstreamText || JSON.stringify({ error: "OpenAI request failed" }),
    };
  }

  let data;
  try {
    data = JSON.parse(upstreamText);
  } catch {
    return jsonResponse(502, { error: "Invalid OpenAI response" });
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return jsonResponse(502, { error: "OpenAI response missing content" });
  }

  return jsonResponse(200, { content });
};
