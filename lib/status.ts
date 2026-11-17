import type { StatusKind } from "./types";

export type StatusView = {
  kind: StatusKind;
  label: string;
  internalOnly: boolean;
  timeSensitive: boolean;
};

const INTERNAL_ONLY_NOTE = "未经业务确认：只供内部跟进，不得当作对外答复。";

export function internalOnlyNote(): string {
  return INTERNAL_ONLY_NOTE;
}

export function classifyStatus(status: string, date: string, text: string): StatusView {
  const kind = kindOf(status);
  return {
    kind,
    label: labelOf(kind, status),
    internalOnly: isInternalOnly(kind),
    timeSensitive: isTimeSensitive(kind, date, text),
  };
}

function kindOf(status: string): StatusKind {
  if (status === "研发已答复·待业务确认") return "rd_pending";
  if (
    status === "尚未确认" ||
    status === "待研发答复" ||
    status === "飞书状态栏为空" ||
    status === "研发答复·未写入确认表"
  ) {
    return "unconfirmed";
  }
  if (status.startsWith("已确认")) return "confirmed";
  if (status.startsWith("有条件结论")) return "conditional";
  if (status.startsWith("官方文件")) return "official";
  if (status.startsWith("专家转述")) return "expert";
  if (status.startsWith("混合")) return "mixed";
  return "other";
}

function labelOf(kind: StatusKind, status: string): string {
  switch (kind) {
    case "confirmed":
      return "已确认";
    case "conditional":
      return "有条件结论";
    case "unconfirmed":
      return "尚未确认";
    case "rd_pending":
      return "研发已答复·待业务确认";
    case "official":
      return "官方文件原文";
    case "expert":
      return "专家转述（文内分级）";
    case "mixed":
      return "混合（文内已分开）";
    case "other":
      return status || "未标注";
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function isInternalOnly(kind: StatusKind): boolean {
  switch (kind) {
    case "unconfirmed":
    case "rd_pending":
      return true;
    case "confirmed":
    case "conditional":
    case "official":
    case "expert":
    case "mixed":
    case "other":
      return false;
    default: {
      const neverKind: never = kind;
      return neverKind;
    }
  }
}

function isTimeSensitive(kind: StatusKind, date: string, text: string): boolean {
  if (kind === "conditional") return true;
  const blob = `${date}\n${text}`;
  return blob.includes("2026-11-11") || blob.includes("规划");
}
