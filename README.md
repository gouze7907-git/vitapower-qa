# VitaPower 荷兰市场内部问答

给内部同事用的单页问答。问题可以是中文、英文或荷兰语，回答只用 `data/knowledge.json` 里的条目，不把知识库以外的产品事实写进去。界面是中文。

覆盖产品：AlphaESS VitaPower 3600 AC 与 VitaMate 4000，荷兰市场。知识库快照日期见 `data/rules.md`（当前为 2026-11-17）。

## 本地运行

```bash
npm install
cp .env.example .env.local
```

在 `.env.local` 里填写：

| 变量 | 作用 |
|---|---|
| `APP_PASSWORD` | 全员共用的访问口令。只在服务端核对，通过后写入 httpOnly cookie（12 小时，`SameSite=Lax`）。经 HTTPS（含 Vercel 的 `x-forwarded-proto`）访问时 cookie 带 `Secure`。 |
| `DEEPSEEK_API_KEY` | DeepSeek API key，只在服务端使用。模型 `deepseek-chat`，接口 `https://api.deepseek.com/chat/completions`。不填时，检索照常工作，回答会标明是本地草稿、没有调用 DeepSeek。 |

```bash
npm run dev
```

打开 http://localhost:3000 ，输入 `APP_PASSWORD`。

自检（检索样本、口令、DeepSeek 请求格式、规则解析）：

```bash
npm run check
npm run build
```

## 部署到 Vercel

不需要数据库或其他服务。

1. 把这个仓库导入 Vercel，框架选 Next.js，根目录就是仓库根目录。
2. 在 Project Settings → Environment Variables 添加 `APP_PASSWORD` 和 `DEEPSEEK_API_KEY`。
3. 部署。`/api/chat` 的 `maxDuration` 是 60 秒，流式输出需要 Vercel 计划允许相应的函数时长。

页面带 `noindex`。这是内部工具，不要当成对外 FAQ 站点。

## 更新知识库

1. 用同结构的 JSON 替换 `data/knowledge.json`。必须有唯一的 `uid`。`id` 可以重复。字段：`uid`、`id`、`source_type`（`faq` | `chat` | `dsheet` | `feishu_rd` | `kol` | `background` | `pdf`）、`title`、`text`（原文）、`source`、`date`、`status`、`notes`、`ref`、`topic`。`blocks` 可以保留，检索不用它。
2. 如果来源、条数、快照日期或使用规则变了，同时改 `data/rules.md`。页脚从这份文件读取。
3. 重新部署（或重启 `next dev` / `next start`）。文件不会自动从飞书或确认表同步。

## 回答怎么来的

每个问题单独检索最多 8 条：中文按词典分词，再加上字 bigram / trigram，和英文、数字关键词一起做 BM25。标题命中权重大于正文。`网络` / network / netwerk 会连带 Wi-Fi，`价格` / price / prijs 会连带售价。没有用向量，也不需要额外的嵌入服务。

检索结果和问题一起发给 DeepSeek，流式显示。系统提示要求：

- 只根据给出的条目回答，先结论，再说明、条件和依据
- 每一点标注 `已确认` / `有条件结论` / `尚未确认` / `研发已答复·待业务确认`，并引用 uid、id、来源、日期、状态
- 未确认和待业务确认的内容必须附上「未经业务确认：只供内部跟进，不得当作对外答复。」
- 有条件结论、2026-11-11 授权和当日价格要写依据日期，并说明会过时
- 规划日期不是发布日期
- 知识库没有答案时写「知识库中尚无法确认」，并建议一个向技术团队提出的问题
- 接线和安全以官方文件及已确认口径为准，并说明须由电工判断

每条回答下面可以展开所引用条目的原文。

## 限制

- 快照不会自动更新。确认表、价格或手册变了，要换 JSON 再部署。
- 确认问答目前主要是 D64–D130（D89 缺号）。D1–D63 未收录。其他缺口写在 `data/rules.md`。
- 没有向量检索，很短或很绕的问法可能检索偏。
- 未配置 API key 时只有摘录草稿，不会做跨条目的模型归纳。
- 口令是共享的，没有个人账号，也不能按人审计。
- 页面可以显示未确认内容。对外答复前仍要按页脚规则核对状态和日期。
