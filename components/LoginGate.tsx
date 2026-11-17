"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginGate({ banner }: { banner: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(readError(payload) || "口令不正确");
        setPending(false);
        return;
      }
      setPassword("");
      router.refresh();
    } catch {
      setError("无法连接服务器");
      setPending(false);
    }
  }

  return (
    <main className="gate">
      <section className="gate-card">
        <p className="eyebrow">AlphaESS · 内部工具</p>
        <h1>VitaPower 荷兰市场问答</h1>
        <p className="lede">
          只依据知识库回答 VitaPower 3600 AC 与 VitaMate 4000 的问题。页面可能显示尚未确认的研发口径，仅供内部跟进。
        </p>
        {banner ? <p className="banner">{banner}</p> : null}
        <form onSubmit={onSubmit}>
          <label htmlFor="password">访问口令</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={pending}>
            {pending ? "正在核对…" : "进入"}
          </button>
        </form>
      </section>
    </main>
  );
}

function readError(payload: unknown): string {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return "";
  return typeof payload.error === "string" ? payload.error : "";
}
