export type SourceType =
  | "faq"
  | "chat"
  | "dsheet"
  | "feishu_rd"
  | "kol"
  | "background"
  | "pdf";

export type KnowledgeEntry = {
  uid: string;
  id: string;
  source_type: string;
  title: string;
  text: string;
  source: string;
  date: string;
  status: string;
  notes: string;
  ref: string;
  topic: string;
};

export type StatusKind =
  | "confirmed"
  | "conditional"
  | "unconfirmed"
  | "rd_pending"
  | "official"
  | "expert"
  | "mixed"
  | "other";

export type AnswerLanguage = "zh" | "en" | "nl";

export type PublicSource = {
  uid: string;
  id: string;
  sourceType: string;
  title: string;
  text: string;
  source: string;
  date: string;
  status: string;
  notes: string;
  ref: string;
  topic: string;
  label: string;
  kind: StatusKind;
  internalOnly: boolean;
  timeSensitive: boolean;
  score: number;
};

export type ChatRole = "user" | "assistant";

export type ClientMessage = {
  role: ChatRole;
  content: string;
};
