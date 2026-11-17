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
      return "四个小标题保持中文。结论、提示、依据用中文。对外口径推荐回答也用中文。";
    case "en":
      return "Keep the four headings in Chinese (结论 / 对外口径推荐回答 / 提示 / 依据). Write only the 对外口径推荐回答 paragraph in English. 结论 and 提示 stay in Chinese.";
    case "nl":
      return "Houd de vier kopjes in het Chinees (结论 / 对外口径推荐回答 / 提示 / 依据). Schrijf alleen de alinea onder 对外口径推荐回答 in het Nederlands. 结论 en 提示 blijven Chinees.";
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
