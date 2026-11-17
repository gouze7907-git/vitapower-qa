import type { KnowledgeEntry } from "./types";

const K1 = 1.2;
const B = 0.6;
const PLAIN_NGRAM_WEIGHT = 0.45;
const EXPAND_WEIGHT = 0.85;

const FUNCTION_WORDS = new Set([
  "是否",
  "什么",
  "多少",
  "如何",
  "怎么",
  "可以",
  "能否",
  "哪些",
  "哪个",
  "需要",
  "这个",
  "那个",
  "目前",
  "已经",
  "不是",
  "没有",
  "以及",
  "对于",
  "关于",
  "一个",
  "我们",
  "如果",
  "因为",
  "所以",
  "但是",
  "或者",
  "还是",
  "时候",
  "其中",
  "通过",
  "进行",
  "使用",
  "不会",
  "不能",
  "不要",
]);

const LATIN_STOP = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "and",
  "or",
  "for",
  "does",
  "do",
  "is",
  "are",
  "what",
  "which",
  "how",
  "when",
  "need",
  "needed",
  "with",
  "that",
  "this",
  "het",
  "een",
  "van",
  "voor",
  "met",
  "wat",
  "hoe",
  "de",
  "kan",
  "niet",
  "bij",
  "welk",
  "heeft",
  "nodig",
]);

const QUERY_EXPANSIONS: Record<string, string[]> = {
  网络: ["wifi", "wi-fi", "无线", "路由器", "network"],
  network: ["wifi", "wi-fi", "网络", "无线", "路由器"],
  netwerk: ["wifi", "wi-fi", "网络", "无线", "路由器"],
  wifi: ["网络", "无线", "network"],
  "wi-fi": ["wifi", "网络", "无线", "network"],
  无线: ["wifi", "网络"],
  价格: ["售价", "日常价", "price"],
  price: ["价格", "售价", "日常价"],
  prijs: ["价格", "售价", "日常价"],
  售价: ["价格"],
  日常价: ["价格"],
  低温: ["禁充", "temperature"],
  禁充: ["低温"],
  cold: ["低温", "禁充"],
  temperature: ["温度", "低温"],
  temperatuur: ["温度", "低温"],
  charge: ["充电"],
  charging: ["充电"],
  opladen: ["充电"],
  discharge: ["放电"],
  ontladen: ["放电"],
};

export type ScoredEntry = KnowledgeEntry & { score: number };

type Counts = Map<string, number>;

type IndexedDoc = {
  entry: KnowledgeEntry;
  title: Counts;
  body: Counts;
  titleLength: number;
  bodyLength: number;
};

export type SearchIndex = {
  docs: IndexedDoc[];
  df: Map<string, number>;
  dict: Set<string>;
  avgTitle: number;
  avgBody: number;
};

export function buildIndex(entries: KnowledgeEntry[]): SearchIndex {
  const prepared = entries
    .filter((entry) => entry.uid && entry.text && entry.title)
    .map((entry) => ({
      entry,
      title: normalize(entry.title),
      body: normalize([entry.text, entry.topic, entry.ref].filter(Boolean).join("\n")),
    }));

  const dict = new Set<string>();
  const bigramDocs = new Map<string, number>();
  for (const doc of prepared) {
    for (const run of cjkRuns(doc.title)) addTitleSpans(dict, run);
    const seen = new Set<string>();
    for (const run of [...cjkRuns(doc.title), ...cjkRuns(doc.body)]) {
      if (run.length < 2) continue;
      for (let i = 0; i < run.length - 1; i += 1) seen.add(run.slice(i, i + 2));
    }
    for (const gram of seen) bigramDocs.set(gram, (bigramDocs.get(gram) ?? 0) + 1);
  }
  for (const [gram, count] of bigramDocs) {
    if (count >= 4) dict.add(gram);
  }

  const docs: IndexedDoc[] = prepared.map((doc) => {
    const title = tokenCounts(doc.title, dict);
    const body = tokenCounts(doc.body, dict);
    return {
      entry: doc.entry,
      title,
      body,
      titleLength: tokenLength(title),
      bodyLength: tokenLength(body),
    };
  });

  const df = new Map<string, number>();
  for (const doc of docs) {
    const terms = new Set<string>([...doc.title.keys(), ...doc.body.keys()]);
    for (const term of terms) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const n = docs.length || 1;
  const avgTitle = docs.reduce((sum, doc) => sum + doc.titleLength, 0) / n;
  const avgBody = docs.reduce((sum, doc) => sum + doc.bodyLength, 0) / n;
  return { docs, df, dict, avgTitle: avgTitle || 1, avgBody: avgBody || 1 };
}

export function search(index: SearchIndex, query: string, limit = 8): ScoredEntry[] {
  const weights = queryWeights(query, index);
  if (weights.size === 0) return [];

  const ranked: ScoredEntry[] = [];
  for (const doc of index.docs) {
    const titleScore = bm25(weights, doc.title, doc.titleLength, index.avgTitle, index);
    const bodyScore = bm25(weights, doc.body, doc.bodyLength, index.avgBody, index);
    const matched = new Map<string, number>();
    for (const [term, weight] of weights) {
      const inTitle = doc.title.has(term);
      const inBody = doc.body.has(term);
      if (!inTitle && !inBody) continue;
      matched.set(term, weight * (inTitle ? 2.3 : 1));
    }
    let cover = 0;
    let distinctive = 0;
    for (const [term, weight] of matched) {
      const termIdf = idf(index, term);
      cover += termIdf * weight;
      if (termIdf >= 1.8 && (weights.get(term) ?? 0) >= 0.8) distinctive += 1;
    }
    const coordination = 1 + 0.25 * Math.max(0, distinctive - 1);
    const score = (2 * titleScore + bodyScore + 0.75 * cover) * coordination;
    if (score > 0) ranked.push({ ...doc.entry, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

function queryWeights(query: string, index: SearchIndex): Map<string, number> {
  const weights = new Map<string, number>();
  const put = (term: string, weight: number) => {
    if (!term || FUNCTION_WORDS.has(term) || LATIN_STOP.has(term)) return;
    const previous = weights.get(term) ?? 0;
    if (weight > previous) weights.set(term, weight);
  };

  const text = normalize(query);
  for (const token of latinTokens(text)) put(token, 1);
  for (const token of fmmPhrases(text, index.dict)) put(token, 1);
  for (const token of ngrams(text)) put(token, index.dict.has(token) ? 1 : PLAIN_NGRAM_WEIGHT);

  for (const [term] of [...weights]) {
    const extras = QUERY_EXPANSIONS[term];
    if (!extras) continue;
    for (const extra of extras) put(extra, EXPAND_WEIGHT);
  }

  for (const term of [...weights.keys()]) {
    const count = index.df.get(term) ?? 0;
    if (count === 0 || count > 200) weights.delete(term);
  }
  for (const term of [...weights.keys()]) {
    if (!/^\d$/.test(term)) continue;
    const subsumed = [...weights.keys()].some((other) => other !== term && other.includes(term));
    if (subsumed) weights.delete(term);
  }
  return weights;
}

function bm25(
  weights: Map<string, number>,
  counts: Counts,
  length: number,
  avgLength: number,
  index: SearchIndex,
): number {
  let score = 0;
  for (const [term, weight] of weights) {
    const freq = counts.get(term) ?? 0;
    if (!freq) continue;
    const denom = freq + K1 * (1 - B + B * (length / avgLength));
    score += weight * idf(index, term) * ((freq * (K1 + 1)) / denom);
  }
  return score;
}

function idf(index: SearchIndex, term: string): number {
  const docFreq = index.df.get(term) ?? 0;
  if (!docFreq) return 0;
  const n = index.docs.length;
  return Math.log(1 + (n - docFreq + 0.5) / (docFreq + 0.5));
}

function tokenCounts(text: string, dict: Set<string>): Counts {
  const counts: Counts = new Map();
  const add = (term: string) => {
    if (!term || FUNCTION_WORDS.has(term)) return;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  };
  for (const token of latinTokens(text)) add(token);
  for (const token of fmmPhrases(text, dict)) add(token);
  for (const token of ngrams(text)) add(token);
  return counts;
}

function tokenLength(counts: Counts): number {
  let total = 0;
  for (const count of counts.values()) total += count;
  return total || 1;
}

function fmmPhrases(text: string, dict: Set<string>): string[] {
  const phrases: string[] = [];
  for (const run of cjkRuns(text)) {
    let i = 0;
    while (i < run.length) {
      let matched = "";
      const max = Math.min(6, run.length - i);
      for (let size = max; size >= 2; size -= 1) {
        const piece = run.slice(i, i + size);
        if (dict.has(piece)) {
          matched = piece;
          break;
        }
      }
      if (matched) {
        if (matched.length >= 4 && !FUNCTION_WORDS.has(matched)) phrases.push(matched);
        i += matched.length;
      } else {
        i += 1;
      }
    }
  }
  return phrases;
}

function ngrams(text: string): string[] {
  const grams: string[] = [];
  for (const run of cjkRuns(text)) {
    for (const size of [2, 3]) {
      if (run.length < size) continue;
      for (let i = 0; i <= run.length - size; i += 1) {
        const gram = run.slice(i, i + size);
        if (!FUNCTION_WORDS.has(gram)) grams.push(gram);
      }
    }
  }
  return grams;
}

function addTitleSpans(dict: Set<string>, run: string): void {
  const max = Math.min(6, run.length);
  for (let size = 2; size <= max; size += 1) {
    for (let i = 0; i <= run.length - size; i += 1) dict.add(run.slice(i, i + size));
  }
}

function cjkRuns(text: string): string[] {
  return text.match(/[\u4e00-\u9fff]+/g) ?? [];
}

function latinTokens(text: string): string[] {
  const words = text.match(/[a-z0-9]+(?:[.\-][a-z0-9]+)*/g) ?? [];
  const tokens: string[] = [];
  for (const word of words) {
    if (word.length === 1 && !/\d/.test(word)) continue;
    tokens.push(word);
    if (word.includes("-")) tokens.push(word.replace(/-/g, ""));
    const numberUnit = /^(\d+)([a-z]+)$/.exec(word);
    if (numberUnit) {
      const number = numberUnit[1] ?? "";
      const unit = numberUnit[2] ?? "";
      if (unit.length >= 2) tokens.push(number, unit);
      else if (number.length >= 2) tokens.push(number);
    }
    const alphaNumber = /^([a-z]+)(\d+)$/.exec(word);
    if (alphaNumber && (alphaNumber[1]?.length ?? 0) >= 2 && (alphaNumber[2]?.length ?? 0) >= 2) {
      tokens.push(alphaNumber[1] ?? "", alphaNumber[2] ?? "");
    }
  }
  for (let i = 0; i < words.length - 1; i += 1) {
    const left = words[i] ?? "";
    const right = words[i + 1] ?? "";
    if (/^\d+$/.test(left) && /^[a-z]{2,}$/.test(right)) tokens.push(left + right);
  }
  return tokens;
}

export function normalize(value: string): string {
  let text = value.toLowerCase();
  let normalized = "";
  for (const char of text) {
    const code = char.charCodeAt(0);
    normalized += code >= 0xff01 && code <= 0xff5e ? String.fromCharCode(code - 0xfee0) : char;
  }
  text = normalized.replace(/°c/g, "℃");
  return text;
}
