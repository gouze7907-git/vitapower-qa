import type { AnswerLanguage, PublicSource } from "./types";

const HEADINGS = ["结论", "对外口径推荐回答", "提示", "依据"] as const;

export function buildMockAnswer(language: AnswerLanguage, question: string, sources: PublicSource[]): string {
  const primary = primaryExternal(sources, question);
  const lines = ["【本地草稿】未调用 DeepSeek。", "", "结论", conclusion(primary), "", "对外口径推荐回答", externalReply(language, primary)];
  const notes = tipLines(primary, sources);
  if (notes.length > 0) {
    lines.push("", "提示", ...notes.map((note) => `- ${note}`));
  }
  lines.push("", "依据");
  const cited = citations(primary, sources);
  if (cited.length === 0) lines.push("- 无 · 无日期 · 尚未确认");
  else lines.push(...cited);
  return lines.join("\n");
}

function conclusion(source: PublicSource | null): string {
  if (!source) return "尚未确认。知识库中尚无法确认。";
  const specialized = specialize("zh", source);
  const sentence = firstSentence(specialized ?? conclusionSentences(source.text, 1));
  return `${source.label}。${sentence}`;
}

function firstSentence(text: string): string {
  const parts = text.split(/(?<=[。！？])/);
  return (parts[0] ?? text).trim();
}

function externalReply(language: AnswerLanguage, source: PublicSource | null): string {
  if (!source) return checkingLine(language);
  return specialize(language, source) ?? (language === "zh" ? conclusionSentences(source.text, 2) : checkingLine(language));
}

function tipLines(primary: PublicSource | null, sources: PublicSource[]): string[] {
  const notes: string[] = [];
  if (primary?.timeSensitive) {
    notes.push(`时效口径，依据 ${basisIso(primary)}，对外前核实现网是否已更新。`);
  }
  if (primary && /规划/.test(primary.text)) notes.push("文中的规划日期不是已发布功能。");
  const internal = sources.find((source) => source.internalOnly);
  if (internal) {
    const title = internal.title.length > 32 ? `${internal.title.slice(0, 32)}…` : internal.title;
    notes.push(`内部，勿对外：${title}`);
  }
  return notes.slice(0, 3);
}

function citations(primary: PublicSource | null, sources: PublicSource[]): string[] {
  const chosen: PublicSource[] = [];
  const seen = new Set<string>();
  const push = (source: PublicSource | null | undefined) => {
    if (!source || seen.has(source.uid) || chosen.length >= 4) return;
    seen.add(source.uid);
    chosen.push(source);
  };
  const fact = primary ? factKey(primary) : null;
  push(primary);
  for (const source of sources) {
    if (source.kind !== "confirmed" && source.kind !== "conditional") continue;
    if (fact && factKey(source) === fact) push(source);
  }
  push(sources.find((source) => source.internalOnly));
  const lines = chosen.map((source) => `- ${source.id || source.uid} · ${source.date || "无日期"} · ${source.label}`);
  return [...new Set(lines)];
}

function primaryExternal(sources: PublicSource[], question: string): PublicSource | null {
  const external = sources.filter((source) => source.kind === "confirmed" || source.kind === "conditional");
  if (external.length === 0) return null;
  const tokens = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}.]+/u)
    .filter((token) => token.length >= 2);
  let best = external[0] ?? null;
  let bestScore = -1;
  for (const source of external) {
    const blob = `${source.title}\n${source.text}`.toLowerCase();
    const score = tokens.reduce((sum, token) => sum + (blob.includes(token) ? token.length : 0), 0);
    if (score > bestScore) {
      best = source;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : (external[0] ?? null);
}

function factKey(source: PublicSource): "power" | "network" | "price" | "temperature" | null {
  if (powerReply("zh", source)) return "power";
  if (networkReply("zh", source)) return "network";
  if (priceReply("zh", source)) return "price";
  if (temperatureReply("zh", source)) return "temperature";
  return null;
}

function specialize(language: AnswerLanguage, source: PublicSource): string | null {
  const key = factKey(source);
  switch (key) {
    case "power":
      return powerReply(language, source);
    case "network":
      return networkReply(language, source);
    case "price":
      return priceReply(language, source);
    case "temperature":
      return temperatureReply(language, source);
    case null:
      return null;
    default: {
      const neverKey: never = key;
      return neverKey;
    }
  }
}

function powerReply(language: AnswerLanguage, source: PublicSource): string | null {
  if (!/800\s*W/.test(source.text) || !/仅限制放电|只限制放电/.test(source.text)) return null;
  const when = source.text.includes("2026-11-14") ? "2026-11-14" : basisIso(source);
  switch (language) {
    case "zh":
      return `按 ${when} 的答复，App 里的 800 W 目前只限制放电，充电不按这个数卡住，4 kWh 仍可能充到约 2000 W。跟客户说时请带上这个日期。`;
    case "en":
      return `As of ${spokenDate(language, when)}, the 800 W setting in the app only limits discharge. Charging is not held to that number, and a 4 kWh unit can still charge at up to about 2000 W.`;
    case "nl":
      return `Per ${spokenDate(language, when)} beperkt de 800 W-instelling in de app alleen het ontladen. Laden volgt dat getal niet; een 4 kWh-systeem kan nog tot ongeveer 2000 W laden.`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function networkReply(language: AnswerLanguage, source: PublicSource): string | null {
  if (!/P1/.test(source.text) || !/2\.4/.test(source.text) || !/Wi-?Fi/i.test(source.text)) return null;
  const when = source.text.includes("2026-11-11") ? "2026-11-11" : basisIso(source);
  switch (language) {
    case "zh":
      return `截至 ${when}，P1 需要经家里的 2.4 GHz Wi-Fi（通过路由器）和主机通信，不支持 5 GHz。这是该日期的口径。`;
    case "en":
      return `As of ${spokenDate(language, when)}, the P1 dongle needs the home 2.4 GHz Wi-Fi, through the router, to keep talking to the unit. It does not support 5 GHz.`;
    case "nl":
      return `Per ${spokenDate(language, when)} heeft de P1-dongle het 2,4 GHz-wifinetwerk thuis nodig, via de router, om met het toestel te blijven communiceren. 5 GHz wordt niet ondersteund.`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function priceReply(language: AnswerLanguage, source: PublicSource): string | null {
  if (!/4\s*kWh/i.test(source.text) || !/1[.,]399/.test(source.text)) return null;
  const amount = source.text.match(/€\s?1[.,]399/)?.[0] ?? "€1,399";
  switch (language) {
    case "zh":
      return `截至 2026-11-11，4 kWh 的荷兰官网日常价是 ${amount}，含 VAT，不含安装。这不是长期目录价，之后以当时官网为准。`;
    case "en":
      return `As of 11 November 2026, the displayed everyday price for 4 kWh is ${amount}, including VAT and excluding installation. It is not a fixed list price.`;
    case "nl":
      return `Per 11 november 2026 is de getoonde dagprijs voor 4 kWh ${amount}, inclusief btw en exclusief installatie. Dit is geen vaste catalogusprijs.`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function temperatureReply(language: AnswerLanguage, source: PublicSource): string | null {
  if (source.internalOnly || !/禁充/.test(source.text) || !/0℃|0°C/.test(source.text)) return null;
  switch (language) {
    case "zh":
      return "电芯在 0℃ 及以下不充电，回到 0℃ 以上可以恢复；−10℃ 及以下才不放电。";
    case "en":
      return "The confirmed cell limits are: charging stops at 0 °C and below and resumes above 0 °C. Discharging stops at −10 °C and below.";
    case "nl":
      return "De bevestigde celgrenzen zijn: laden stopt bij 0 °C of lager en hervat boven 0 °C. Ontladen stopt bij −10 °C of lager.";
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function checkingLine(language: AnswerLanguage): string {
  switch (language) {
    case "zh":
      return "这个问题我们正在和技术团队核对，目前还不能作为对外答复。";
    case "en":
      return "We're checking this with the technical team, so we can't confirm it for a customer reply yet.";
    case "nl":
      return "We stemmen dit af met het technische team en kunnen het nu nog niet bevestigen voor een antwoord aan de klant.";
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

function conclusionSentences(text: string, count: number): string {
  const marked = text.match(/【直接结论】\s*([\s\S]*?)(?=\n【|$)/);
  const body = clean(marked?.[1] ?? text);
  const parts = body
    .split(/(?<=[。！？])/)
    .map((part) => part.trim())
    .filter((part) => part.length > 6);
  let joined = (parts.length > 0 ? parts : [body]).slice(0, count).join("");
  if (joined.length > 140) joined = `${joined.slice(0, 140).replace(/[，,、；;]\s*[^，,、；;]*$/, "")}。`;
  return joined;
}

function clean(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\[\[[^\]]+\]\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function basisIso(source: PublicSource): string {
  return source.text.match(/2026-\d{2}-\d{2}/)?.[0] ?? source.date ?? "条目所载日期";
}

function spokenDate(language: AnswerLanguage, iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const year = match[1] ?? "";
  const month = Number(match[2]);
  const day = Number(match[3]);
  switch (language) {
    case "zh":
      return iso;
    case "en":
      return `${day} ${MONTHS_EN[month - 1] ?? iso} ${year}`;
    case "nl":
      return `${day} ${MONTHS_NL[month - 1] ?? iso} ${year}`;
    default: {
      const neverLanguage: never = language;
      return neverLanguage;
    }
  }
}

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTHS_NL = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export function answerSection(text: string, heading: (typeof HEADINGS)[number]): string {
  const pattern = new RegExp(`(?:^|\\n)${heading}\\n([\\s\\S]*?)(?=\\n(?:${HEADINGS.join("|")})\\n|$)`);
  return pattern.exec(text)?.[1]?.trim() ?? "";
}
