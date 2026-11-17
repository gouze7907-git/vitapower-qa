import type { RulesInfo } from "@/lib/rules";

export function Footer({ rules, loadedCount }: { rules: RulesInfo; loadedCount: number }) {
  return (
    <footer className="site-footer">
      <p className="footer-meta">
        数据快照 {rules.snapshotDate || "未知"} · 当前载入 {loadedCount} 条 · 快照不会自动同步，替换 data/knowledge.json 后需重新部署
      </p>
      {rules.rules.length > 0 ? (
        <ol className="footer-rules">
          {rules.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      ) : null}
      {rules.usageNote ? <p className="footer-note">{rules.usageNote}</p> : null}
      <p className="footer-sources">
        {rules.sources.map((row) => `${row.type} ${row.count}`).join(" · ")}
      </p>
      <details className="footer-more">
        <summary>来源说明与已知资料缺口</summary>
        <ul>
          {rules.sources.map((row) => (
            <li key={row.type}>
              <strong>{row.type}</strong>（{row.count}）{row.name}
            </li>
          ))}
        </ul>
        {rules.gaps.length > 0 ? (
          <ul>
            {rules.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </footer>
  );
}
