import { classifyStatus } from "./status";
import type { PublicSource } from "./types";
import type { ScoredEntry } from "./retrieve";

export function toPublicSource(entry: ScoredEntry): PublicSource {
  const view = classifyStatus(entry.status, entry.date, entry.text);
  return {
    uid: entry.uid,
    id: entry.id,
    sourceType: entry.source_type,
    title: entry.title,
    text: entry.text,
    source: entry.source,
    date: entry.date,
    status: entry.status,
    notes: entry.notes,
    ref: entry.ref,
    topic: entry.topic,
    label: view.label,
    kind: view.kind,
    internalOnly: view.internalOnly,
    timeSensitive: view.timeSensitive,
    score: Number(entry.score.toFixed(2)),
  };
}
