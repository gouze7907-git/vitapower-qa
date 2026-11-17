import fs from "fs";
import path from "path";

export type SourceRow = {
  type: string;
  name: string;
  count: string;
};

export type RulesInfo = {
  snapshotDate: string;
  banner: string;
  rules: string[];
  usageNote: string;
  sources: SourceRow[];
  gaps: string[];
};

export function rulesPath(): string {
  return path.join(process.cwd(), "data", "rules.md");
}

export function loadRules(): RulesInfo {
  return parseRules(fs.readFileSync(rulesPath(), "utf8"));
}

export function parseRules(markdown: string): RulesInfo {
  const snapshot = /数据快照日期\s*(\d{4}-\d{2}-\d{2})/.exec(markdown);
  const bannerLine = markdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("「尚未确认」"));
  const usage = splitSection(markdown, "## 使用规则（原文）", "## ");

  return {
    snapshotDate: snapshot?.[1] ?? "",
    banner: bannerLine ?? "",
    rules: usage.items,
    usageNote: usage.notes.join(""),
    sources: sourceRows(markdown),
    gaps: splitSection(markdown, "## 已知资料缺口", "## ").items,
  };
}

function splitSection(
  markdown: string,
  start: string,
  nextHeadingPrefix: string,
): { items: string[]; notes: string[] } {
  const startAt = markdown.indexOf(start);
  if (startAt < 0) return { items: [], notes: [] };
  const rest = markdown.slice(startAt + start.length);
  const next = rest.indexOf(`\n${nextHeadingPrefix}`);
  const body = next < 0 ? rest : rest.slice(0, next);
  const items: string[] = [];
  const notes: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (/^\d+\.\s/.test(line)) items.push(line.replace(/^\d+\.\s/, ""));
    else if (line.startsWith("- ")) items.push(line.replace(/^- /, ""));
    else notes.push(line);
  }
  return { items, notes };
}

function sourceRows(markdown: string): SourceRow[] {
  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !line.includes("---") && !line.includes("source_type"))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim().replace(/\*/g, ""));
      return {
        type: cells[0] ?? "",
        name: cells[1] ?? "",
        count: cells[2] ?? "",
      };
    })
    .filter((row) => row.type && row.count);
}
