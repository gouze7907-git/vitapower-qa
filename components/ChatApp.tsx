"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { internalOnlyNote } from "@/lib/status";
import type { PublicSource, StatusKind } from "@/lib/types";

const EXAMPLES = ["800W 是否只限制放电", "P1 需要什么网络", "4 kWh 价格多少", "低温能充电吗"];

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: PublicSource[];
  mock?: boolean;
  error?: string;
};

export function ChatApp({ banner }: { banner: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const canSend = question.trim().length > 0 && !pending;

  const transcript = useMemo(
    () => turns.filter((turn) => turn.role === "user" || turn.content).map((turn) => ({ role: turn.role, content: turn.content })),
    [turns],
  );

  async function ask(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history = transcript;
    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    setTurns((current) => [...current, userTurn, { id: assistantId, role: "assistant", content: "" }]);
    setQuestion("");
    setPending(true);
    window.setTimeout(() => {
      document.getElementById(userTurn.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 30);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content }] }),
      });
      if (response.status === 401) {
        updateAssistant(assistantId, { error: "登录已失效，请重新进入。" });
        router.refresh();
        return;
      }
      if (!response.ok || !response.body) {
        updateAssistant(assistantId, { error: "回答没有生成，请重试。" });
        return;
      }
      await readStream(response.body, assistantId);
    } catch {
      updateAssistant(assistantId, { error: "无法连接服务器。" });
    } finally {
      setPending(false);
    }
  }

  function updateAssistant(id: string, patch: Partial<Turn>) {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...patch } : turn)));
  }

  async function readStream(body: ReadableStream<Uint8Array>, assistantId: string) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) {
        const line = chunk.split("\n").find((item) => item.startsWith("data:"));
        if (!line) continue;
        const event = parseEvent(line.slice(5).trim());
        if (!event) continue;
        if (event.type === "sources") updateAssistant(assistantId, { sources: event.sources });
        if (event.type === "meta") updateAssistant(assistantId, { mock: event.mock });
        if (event.type === "error") updateAssistant(assistantId, { error: event.message });
        if (event.type === "delta") {
          content += event.text;
          updateAssistant(assistantId, { content });
        }
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(question);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(question);
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">AlphaESS · 荷兰市场</p>
          <h1>VitaPower 内部问答</h1>
          <p className="subhead">VitaPower 3600 AC + VitaMate 4000 · 只依据知识库</p>
        </div>
        <button type="button" className="ghost" onClick={() => void logout()}>
          退出
        </button>
      </header>
      {banner ? <p className="banner">{banner}</p> : null}
      <div className="thread">
        {turns.length === 0 ? (
          <div className="empty">
            <p>用中文、英文或荷兰语提问。回答先给结论，并标出每条依据的状态。</p>
            <div className="examples">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" className="chip" onClick={() => void ask(example)}>
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          turns.map((turn) =>
            turn.role === "user" ? (
              <article key={turn.id} id={turn.id} className="bubble user">
                {turn.content}
              </article>
            ) : (
              <article key={turn.id} className="bubble assistant">
                {turn.mock ? <p className="mock-flag">本地草稿 · 未调用 DeepSeek</p> : null}
                {turn.content ? <RichText text={turn.content} /> : <p className="pending-line">{pending ? "正在检索知识库…" : ""}</p>}
                {turn.error ? <p className="form-error">{turn.error}</p> : null}
                {turn.sources ? <SourceList sources={turn.sources} /> : null}
              </article>
            ),
          )
        )}
      </div>
      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor="question">问题</label>
        <textarea
          id="question"
          value={question}
          placeholder="例如：800W 是否只限制放电"
          rows={4}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="composer-row">
          <p>Enter 发送 · Shift+Enter 换行</p>
          <button type="submit" disabled={!canSend}>
            {pending ? "回答中…" : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="answer-body">
      {parts.map((part, index) =>
        part.startsWith("**") && part.endsWith("**") && part.length >= 4 ? (
          <strong key={index}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </div>
  );
}

function SourceList({ sources }: { sources: PublicSource[] }) {
  if (sources.length === 0) return <p className="source-empty">本次没有检索到条目。</p>;
  return (
    <details className="sources">
      <summary>依据 {sources.length} 条（原文）</summary>
      <div className="source-list">
        {sources.map((source) => (
          <article key={source.uid} className="source-card">
            <header>
              <span className={badgeClass(source.kind)}>{source.label}</span>
              <span className="uid">{source.uid}</span>
              <span>{source.id}</span>
              <span>{source.date || "无日期"}</span>
            </header>
            <h3>{source.title}</h3>
            <p className="source-meta">
              {source.source}
              {source.topic ? ` · ${source.topic}` : ""}
              {source.ref ? ` · ${source.ref}` : ""}
            </p>
            {source.internalOnly ? <p className="internal-note">{internalOnlyNote()}</p> : null}
            {source.timeSensitive ? <p className="time-note">时效性口径，引用时保留依据日期。</p> : null}
            <pre>{source.text}</pre>
          </article>
        ))}
      </div>
    </details>
  );
}

function badgeClass(kind: StatusKind): string {
  switch (kind) {
    case "confirmed":
      return "badge confirmed";
    case "conditional":
      return "badge conditional";
    case "unconfirmed":
      return "badge unconfirmed";
    case "rd_pending":
      return "badge rd";
    case "official":
      return "badge official";
    case "expert":
      return "badge expert";
    case "mixed":
      return "badge mixed";
    case "other":
      return "badge other";
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function parseEvent(data: string): StreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== "object" || !("type" in parsed)) return null;
    return parsed as StreamEvent;
  } catch {
    return null;
  }
}

type StreamEvent =
  | { type: "sources"; sources: PublicSource[] }
  | { type: "meta"; mock: boolean }
  | { type: "delta"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
