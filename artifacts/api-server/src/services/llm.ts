export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";

function getApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DEEPSEEK_API_KEY is not set");
  }
  return key;
}

export async function deepseekChat(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek request failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}
