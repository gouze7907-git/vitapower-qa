export const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
export const DEEPSEEK_MODEL = "deepseek-chat";

export type DeepSeekMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type DeepSeekBody = {
  model: string;
  messages: DeepSeekMessage[];
  stream: true;
  temperature: number;
  max_tokens: number;
};

export function buildDeepSeekBody(messages: DeepSeekMessage[]): DeepSeekBody {
  return {
    model: DEEPSEEK_MODEL,
    messages,
    stream: true,
    temperature: 0.2,
    max_tokens: 2500,
  };
}

export async function postChatCompletions(
  apiKey: string,
  body: DeepSeekBody,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Response> {
  return fetchImpl(DEEPSEEK_URL, {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function readDeepSeekDeltas(
  stream: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      const delta = deltaFromPayload(data);
      if (delta) onDelta(delta);
    }
  }
}

function deltaFromPayload(data: string): string {
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.delta?.content;
    return typeof content === "string" ? content : "";
  } catch {
    return "";
  }
}
