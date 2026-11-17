import { buildDeepSeekBody, postChatCompletions, readDeepSeekDeltas, type DeepSeekMessage } from "@/lib/deepseek";
import { verifySessionToken } from "@/lib/auth";
import { getIndex } from "@/lib/knowledge";
import { detectLanguage, retrievalQuery } from "@/lib/language";
import { buildMockAnswer } from "@/lib/mock-answer";
import { systemPrompt, userPrompt } from "@/lib/prompt";
import { search } from "@/lib/retrieve";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { toPublicSource } from "@/lib/sources";
import type { ClientMessage, PublicSource } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatEvent =
  | { type: "sources"; sources: PublicSource[] }
  | { type: "meta"; mock: boolean }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export async function POST(request: Request): Promise<Response> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!(await verifySessionToken(token))) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const messages = parseMessages(body);
  if (!messages) return Response.json({ error: "请输入问题" }, { status: 400 });
  const question = messages[messages.length - 1]?.content.trim() ?? "";
  if (!question) return Response.json({ error: "请输入问题" }, { status: 400 });

  const history = messages.slice(0, -1).slice(-6);
  const sources = search(getIndex(), retrievalQuery(history, question), 8).map(toPublicSource);
  const language = detectLanguage(question);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: ChatEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        send({ type: "sources", sources });
        const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
        if (!apiKey) {
          send({ type: "meta", mock: true });
          const draft = buildMockAnswer(language, question, sources);
          for (let i = 0; i < draft.length; i += 48) {
            send({ type: "delta", text: draft.slice(i, i + 48) });
          }
          send({ type: "done" });
          finish();
          return;
        }

        const modelMessages = buildModelMessages(history, question, language, sources);
        const upstream = await postChatCompletions(
          apiKey,
          buildDeepSeekBody(modelMessages),
          fetch,
          request.signal,
        );
        if (!upstream.ok || !upstream.body) {
          send({ type: "error", message: `DeepSeek 请求失败（HTTP ${upstream.status}）。` });
          send({ type: "done" });
          finish();
          return;
        }
        await readDeepSeekDeltas(upstream.body, (text) => send({ type: "delta", text }));
        send({ type: "done" });
        finish();
      } catch {
        send({ type: "error", message: "生成回答时出错。" });
        send({ type: "done" });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function buildModelMessages(
  history: ClientMessage[],
  question: string,
  language: ReturnType<typeof detectLanguage>,
  sources: PublicSource[],
): DeepSeekMessage[] {
  return [
    { role: "system", content: systemPrompt() },
    ...history.map((message) => ({
      role: message.role,
      content: message.content.slice(0, 4000),
    })),
    { role: "user", content: userPrompt(question, language, sources) },
  ];
}

function parseMessages(body: unknown): ClientMessage[] | null {
  if (!body || typeof body !== "object" || !("messages" in body)) return null;
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) return null;
  const parsed: ClientMessage[] = [];
  for (const message of messages) {
    if (!message || typeof message !== "object") return null;
    if (!("role" in message) || !("content" in message)) return null;
    if (message.role !== "user" && message.role !== "assistant") return null;
    if (typeof message.content !== "string") return null;
    const content = message.content.trim();
    if (!content || content.length > 4000) return null;
    parsed.push({ role: message.role, content });
  }
  const last = parsed[parsed.length - 1];
  if (!last || last.role !== "user") return null;
  return parsed;
}

function cookieValue(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
