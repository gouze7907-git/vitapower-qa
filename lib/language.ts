import type { AnswerLanguage, ClientMessage } from "./types";

const DUTCH =
  /\b(de|het|een|van|voor|niet|prijs|hoe|wat|kan|zijn|met|bij|waarom|nodig|opladen|ontladen|batterij|zonnepanelen|werkt|moet|deze|geen)\b/i;

export function detectLanguage(question: string): AnswerLanguage {
  const cjk = question.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const latin = question.match(/[A-Za-z]/g)?.length ?? 0;
  if (cjk > 0 && cjk >= latin) return "zh";
  if (DUTCH.test(question)) return "nl";
  if (latin > 0) return "en";
  return "zh";
}

export function languageInstruction(language: AnswerLanguage): string {
  switch (language) {
    case "zh":
      return "请使用中文回答。";
    case "en":
      return "Answer in English. Keep product names, citations, status labels, and the fixed internal-only warning in their original wording.";
    case "nl":
      return "Antwoord in het Nederlands. Houd productnamen, citaties, statuslabels en de vaste interne waarschuwing in de oorspronkelijke formulering.";
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

export function retrievalQuery(history: ClientMessage[], question: string): string {
  const previous = [...history].reverse().find((message) => message.role === "user");
  if (!previous) return question;
  const short = question.trim().length < 18;
  const followUp = /^(那|这|它|继续|还有|那么|同上|价格呢|呢)/.test(question.trim());
  if (short || followUp) return `${previous.content}\n${question}`;
  return question;
}
