import fs from "fs";
import path from "path";
import { buildIndex, type SearchIndex } from "./retrieve";
import type { KnowledgeEntry } from "./types";

const globalStore = globalThis as unknown as { __vitapowerIndex?: SearchIndex };

export function knowledgePath(): string {
  return path.join(process.cwd(), "data", "knowledge.json");
}

export function getIndex(): SearchIndex {
  if (!globalStore.__vitapowerIndex) {
    const raw = fs.readFileSync(knowledgePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("data/knowledge.json 必须是数组");
    globalStore.__vitapowerIndex = buildIndex(parsed.map(asEntry).filter((entry) => entry.uid));
  }
  return globalStore.__vitapowerIndex;
}

function asEntry(value: unknown): KnowledgeEntry {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    uid: asString(row.uid),
    id: asString(row.id),
    source_type: asString(row.source_type),
    title: asString(row.title),
    text: asString(row.text),
    source: asString(row.source),
    date: asString(row.date),
    status: asString(row.status),
    notes: asString(row.notes),
    ref: asString(row.ref),
    topic: asString(row.topic),
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
