import fs from "fs";
import assert from "node:assert/strict";
import { passwordMatches, sessionTokenForPassword, verifySessionToken } from "../lib/auth.ts";
import { buildDeepSeekBody, DEEPSEEK_MODEL, DEEPSEEK_URL, postChatCompletions, readDeepSeekDeltas } from "../lib/deepseek.ts";
import { detectLanguage } from "../lib/language.ts";
import { answerSection, buildMockAnswer } from "../lib/mock-answer.ts";
import { buildIndex, search, type ScoredEntry } from "../lib/retrieve.ts";
import { parseRules } from "../lib/rules.ts";
import { classifyStatus, internalOnlyNote } from "../lib/status.ts";
import type { KnowledgeEntry, PublicSource } from "../lib/types.ts";

const entries = JSON.parse(fs.readFileSync(new URL("../data/knowledge.json", import.meta.url), "utf8")) as KnowledgeEntry[];
assert.equal(entries.length, 278);
const index = buildIndex(entries);

function top(query: string, n = 5): string[] {
  const hits = search(index, query, n);
  console.log(`\n${query}`);
  for (const hit of hits) console.log(`  ${hit.score.toFixed(1).padStart(7)} ${hit.uid.padEnd(16)} ${hit.title.slice(0, 42)}`);
  return hits.map((hit) => hit.uid);
}

const power = top("800W 是否只限制放电");
assert.equal(power[0], "faq:006");

const network = top("P1 需要什么网络");
assert.ok(network.slice(0, 2).includes("faq:047"), `P1 network missed faq:047: ${network.join(",")}`);

const price = top("4 kWh 价格多少");
for (const uid of ["chat:080", "faq:057", "background:152"]) {
  assert.ok(price.includes(uid), `price missed ${uid}: ${price.join(",")}`);
}

const cold = top("低温能充电吗");
assert.ok(cold.includes("faq:060"), `cold missed faq:060: ${cold.join(",")}`);
assert.ok(cold.includes("kol:226"), `cold missed kol:226: ${cold.join(",")}`);

const homey = top("Homey 什么时候支持");
assert.ok(homey.slice(0, 3).includes("faq:049"), `homey missed faq:049: ${homey.join(",")}`);

const englishNetwork = top("What network does the P1 dongle need?");
assert.ok(englishNetwork.includes("faq:047"), `english P1 missed faq:047: ${englishNetwork.join(",")}`);

const standbyEnter = top("低功耗待机 进入条件");
assert.ok(standbyEnter.includes("chat:081"), `standby entry missed chat:081: ${standbyEnter.join(",")}`);

const modbusStandby = top("Modbus standby");
assert.ok(
  modbusStandby.some((uid) => uid === "chat:083" || uid === "chat:084" || uid === "chat:085"),
  `Modbus standby missed D134–D136: ${modbusStandby.join(",")}`,
);

const dutchPrice = top("Wat is de prijs van 4 kWh?");
assert.ok(
  dutchPrice.some((uid) => uid === "faq:057" || uid === "chat:080"),
  `dutch price missed price entries: ${dutchPrice.join(",")}`,
);

const rules = parseRules(fs.readFileSync(new URL("../data/rules.md", import.meta.url), "utf8"));
assert.equal(rules.snapshotDate, "2026-11-23");
assert.ok(rules.sources.some((row) => row.type === "chat" && row.count === "10"));
assert.ok(rules.sources.some((row) => row.type === "合计" && row.count === "278"));
assert.equal(rules.rules.length, 5);
assert.ok(rules.usageNote.includes("未经业务确认"));
assert.ok(rules.sources.some((row) => row.type === "faq" && row.count === "75"));
assert.ok(rules.gaps.length >= 5);

assert.equal(classifyStatus("已确认", "", "").label, "已确认");
assert.equal(classifyStatus("已确认（确认问答表）", "", "").internalOnly, false);
assert.equal(classifyStatus("有条件结论", "2026-11-11", "").timeSensitive, true);
assert.equal(classifyStatus("尚未确认", "", "").internalOnly, true);
assert.equal(classifyStatus("研发已答复·待业务确认", "", "").label, "研发已答复·待业务确认");
assert.equal(classifyStatus("研发答复·未写入确认表", "", "").internalOnly, true);
assert.equal(classifyStatus("飞书状态栏为空", "", "").internalOnly, true);
assert.equal(classifyStatus("待研发答复", "", "").internalOnly, true);
assert.ok(internalOnlyNote().includes("未经业务确认"));

process.env.APP_PASSWORD = "internal-demo";
assert.equal(await passwordMatches("wrong"), false);
assert.equal(await passwordMatches("internal-demo"), true);
const token = await sessionTokenForPassword("internal-demo");
assert.equal(await verifySessionToken(token), true);
assert.equal(await verifySessionToken(`${token.slice(0, -1)}a`), false);
delete process.env.APP_PASSWORD;
assert.equal(await verifySessionToken(token), false);

const body = buildDeepSeekBody([
  { role: "system", content: "rules" },
  { role: "user", content: "800W 是否只限制放电" },
]);
assert.equal(body.model, DEEPSEEK_MODEL);
assert.equal(body.model, "deepseek-chat");
assert.equal(body.stream, true);
assert.equal(body.messages[0]?.role, "system");

let seenUrl = "";
let seenAuth = "";
let seenModel = "";
const response = await postChatCompletions("sk-test", body, async (url, init) => {
  seenUrl = String(url);
  const headers = new Headers(init?.headers);
  seenAuth = headers.get("authorization") ?? "";
  seenModel = JSON.parse(String(init?.body)).model;
  return new Response("ok", { status: 200 });
});
assert.equal(response.status, 200);
assert.equal(seenUrl, DEEPSEEK_URL);
assert.equal(seenUrl, "https://api.deepseek.com/chat/completions");
assert.equal(seenAuth, "Bearer sk-test");
assert.equal(seenModel, "deepseek-chat");

const encoder = new TextEncoder();
const stream = new ReadableStream<Uint8Array>({
  start(controller) {
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"结论"}}]}\n'));
    controller.enqueue(encoder.encode("data: [DONE]\n"));
    controller.close();
  },
});
let delta = "";
await readDeepSeekDeltas(stream, (text) => {
  delta += text;
});
assert.equal(delta, "结论");

const prompt = fs.readFileSync(new URL("../lib/prompt.ts", import.meta.url), "utf8");
assert.ok(prompt.includes("对外口径推荐回答"));
assert.ok(prompt.includes("内部，勿对外"));
assert.ok(!prompt.includes("先给结论，再写说明"));

function asPublic(hit: ScoredEntry): PublicSource {
  const view = classifyStatus(hit.status, hit.date, hit.text);
  return {
    uid: hit.uid,
    id: hit.id,
    sourceType: hit.source_type,
    title: hit.title,
    text: hit.text,
    source: hit.source,
    date: hit.date,
    status: hit.status,
    notes: hit.notes,
    ref: hit.ref,
    topic: hit.topic,
    label: view.label,
    kind: view.kind,
    internalOnly: view.internalOnly,
    timeSensitive: view.timeSensitive,
    score: hit.score,
  };
}

function draft(question: string): string {
  const language = detectLanguage(question);
  const sources = search(index, question, 8).map(asPublic);
  const text = buildMockAnswer(language, question, sources);
  console.log(`\n---- ${question} (${language}) ----\n${text}`);
  assert.ok(text.includes("\n结论\n"), question);
  assert.ok(text.includes("\n对外口径推荐回答\n"), question);
  assert.ok(text.includes("\n依据\n"), question);
  assert.ok(!text.includes("适用条件或限制"), question);
  assert.ok(!text.includes(internalOnlyNote()), question);
  const tips = answerSection(text, "提示");
  const bullets = tips ? tips.split("\n").filter((line) => line.startsWith("- ")) : [];
  assert.ok(bullets.length <= 3, `${question} tips ${bullets.length}`);
  assert.ok(text.length < 1400, `${question} still verbose (${text.length})`);
  return text;
}

const powerDraft = draft("800W 是否只限制放电");
assert.match(answerSection(powerDraft, "结论"), /有条件结论/);
assert.match(answerSection(powerDraft, "对外口径推荐回答"), /只限制放电/);
assert.match(answerSection(powerDraft, "对外口径推荐回答"), /2026-11-14/);
assert.match(answerSection(powerDraft, "依据"), /D131 · 2026-11-14 · 有条件结论/);
assert.match(answerSection(powerDraft, "提示"), /内部，勿对外/);

const networkDraft = draft("P1 需要什么网络");
assert.match(answerSection(networkDraft, "对外口径推荐回答"), /2\.4 GHz Wi-Fi/);
assert.match(answerSection(networkDraft, "对外口径推荐回答"), /2026-11-11/);

const priceDraft = draft("4 kWh 价格多少");
assert.match(answerSection(priceDraft, "对外口径推荐回答"), /1,399/);
assert.match(answerSection(priceDraft, "对外口径推荐回答"), /2026-11-11/);
assert.match(answerSection(priceDraft, "结论"), /有条件结论/);

const coldDraft = draft("低温能充电吗");
const coldExternal = answerSection(coldDraft, "对外口径推荐回答");
assert.match(coldExternal, /0℃/);
assert.match(answerSection(coldDraft, "结论"), /已确认/);
assert.ok(!coldExternal.includes("禁充禁放"), coldExternal);
assert.match(answerSection(coldDraft, "提示"), /内部，勿对外/);

const dutchDraft = draft("Wat is de prijs van 4 kWh?");
assert.equal(detectLanguage("Wat is de prijs van 4 kWh?"), "nl");
const dutchExternal = answerSection(dutchDraft, "对外口径推荐回答");
assert.match(dutchExternal, /Per 11 november 2026/);
assert.match(dutchExternal, /btw/);
assert.ok(!/[\u4e00-\u9fff]/.test(dutchExternal), dutchExternal);

console.log("\nchecks passed");
