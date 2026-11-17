import { internalOnlyNote } from "./status";
import type { AnswerLanguage, PublicSource } from "./types";

export function buildMockAnswer(language: AnswerLanguage, question: string, sources: PublicSource[]): string {
  const lines = [draftHeader(language), ""];
  if (sources.length === 0) {
    lines.push("知识库中尚无法确认。");
    lines.push(suggestedQuestion(language, question));
    return lines.join("\n");
  }

  lines.push(sectionTitle(language, "conclusion"), "");
  for (const source of sources.slice(0, 3)) {
    lines.push(cite(source));
    lines.push(excerpt(source.text));
    if (source.internalOnly) lines.push(internalOnlyNote());
    if (source.timeSensitive) lines.push(timeNote(language, source.date));
    lines.push("");
  }

  lines.push(sectionTitle(language, "limits"), "");
  lines.push(limitNote(language));
  lines.push("");
  lines.push(sectionTitle(language, "basis"), "");
  for (const source of sources) {
    lines.push(
      `- ${source.label} · uid ${source.uid} · id ${source.id} · ${source.source} · ${source.date || "无日期"} · status ${source.status}`,
    );
  }
  return lines.join("\n");
}

function draftHeader(language: AnswerLanguage): string {
  switch (language) {
    case "zh":
      return "【本地草稿】未配置 DEEPSEEK_API_KEY，没有调用 DeepSeek。下面只摘录本次检索到的知识库原文，不是模型归纳。";
    case "en":
      return "[Local draft] DEEPSEEK_API_KEY is not set, so DeepSeek was not called. The text below quotes retrieved knowledge-base entries only.";
    case "nl":
      return "[Lokaal concept] DEEPSEEK_API_KEY ontbreekt, dus DeepSeek is niet aangeroepen. Onderstaande tekst citeert alleen teruggevonden kennisbankfragmenten.";
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function sectionTitle(language: AnswerLanguage, section: "conclusion" | "limits" | "basis"): string {
  switch (language) {
    case "zh":
      switch (section) {
        case "conclusion":
          return "结论";
        case "limits":
          return "适用条件或限制";
        case "basis":
          return "依据";
        default: {
          const neverSection: never = section;
          return neverSection;
        }
      }
    case "en":
      switch (section) {
        case "conclusion":
          return "Conclusion";
        case "limits":
          return "Conditions and limits";
        case "basis":
          return "Basis";
        default: {
          const neverSection: never = section;
          return neverSection;
        }
      }
    case "nl":
      switch (section) {
        case "conclusion":
          return "Conclusie";
        case "limits":
          return "Voorwaarden en grenzen";
        case "basis":
          return "Basis";
        default: {
          const neverSection: never = section;
          return neverSection;
        }
      }
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function suggestedQuestion(language: AnswerLanguage, question: string): string {
  switch (language) {
    case "zh":
      return `建议向技术团队确认：${question}`;
    case "en":
      return `Suggested question for the technical team: ${question}`;
    case "nl":
      return `Voorgestelde vraag aan het technische team: ${question}`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function timeNote(language: AnswerLanguage, date: string): string {
  const stamp = date || "条目所载日期";
  switch (language) {
    case "zh":
      return `时效：依据日期 ${stamp}。这是时效性口径，对外使用前需核实现网 App、文档或官方答复是否已更新。规划日期不是已发布日期。`;
    case "en":
      return `Time-sensitive: basis date ${stamp}. Check the live app, documents, or an official reply before using this externally. A planned date is not a release.`;
    case "nl":
      return `Tijdsgevoelig: datum van de basis ${stamp}. Controleer de live app, documenten of een officieel antwoord voordat dit extern wordt gebruikt. Een plandatum is geen release.`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function limitNote(language: AnswerLanguage): string {
  switch (language) {
    case "zh":
      return "接线、回路、保护和安全以条目中的官方文件及已确认口径为准，现场是否适用须由电工判断。某一次使用成功不能证明普遍兼容。已确认的产品事实不要和一般储能原理混写。";
    case "en":
      return "Wiring, circuits, protection, and safety follow the official documents and confirmed entries. An electrician has to judge the site. One successful installation does not prove general compatibility.";
    case "nl":
      return "Bedrading, groepen, beveiliging en veiligheid volgen de officiële documenten en bevestigde items. Een elektricien moet de situatie ter plaatse beoordelen. Eén geslaagde installatie bewijst geen algemene compatibiliteit.";
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function cite(source: PublicSource): string {
  return `${source.label} · uid ${source.uid} · id ${source.id} · ${source.date || "无日期"} · ${source.title}`;
}

function excerpt(text: string): string {
  const marked = text.match(/【直接结论】\s*([\s\S]*?)(?=\n【|$)/);
  const chunk = (marked?.[1] ?? text).replace(/\*\*/g, "").trim();
  if (chunk.length <= 700) return chunk;
  return `${chunk.slice(0, 700)}…`;
}
