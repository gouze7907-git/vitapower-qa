import fs from "fs";
import assert from "node:assert/strict";
import { passwordMatches, sessionTokenForPassword, verifySessionToken } from "../lib/auth.ts";
import { buildDeepSeekBody, DEEPSEEK_MODEL, DEEPSEEK_URL, postChatCompletions, readDeepSeekDeltas } from "../lib/deepseek.ts";
import { buildIndex, search } from "../lib/retrieve.ts";
import { parseRules } from "../lib/rules.ts";
import { classifyStatus, internalOnlyNote } from "../lib/status.ts";
import type { KnowledgeEntry } from "../lib/types.ts";

const entries = JSON.parse(fs.readFileSync(new URL("../data/knowledge.json", import.meta.url), "utf8")) as KnowledgeEntry[];
assert.equal(entries.length, 273);
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

const dutchPrice = top("Wat is de prijs van 4 kWh?");
assert.ok(
  dutchPrice.some((uid) => uid === "faq:057" || uid === "chat:080"),
  `dutch price missed price entries: ${dutchPrice.join(",")}`,
);

const rules = parseRules(fs.readFileSync(new URL("../data/rules.md", import.meta.url), "utf8"));
assert.equal(rules.snapshotDate, "2026-11-17");
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

console.log("\nchecks passed");
