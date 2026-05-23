import { useMemo, useState } from "react";
import { type DataFile } from "../types";

export default function Archive({ data }: { data: DataFile }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const projectById = useMemo(
    () => new Map(data.projects.map((p) => [p.id, p])),
    [data.projects],
  );

  const dates = useMemo(
    () => Object.keys(data.reports).sort().reverse(),
    [data.reports],
  );

  const filteredDates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dates;
    return dates.filter((d) => {
      const r = data.reports[d];
      if (d.includes(q)) return true;
      if (r.oneLiner.toLowerCase().includes(q)) return true;
      return r.entries.some((e) => {
        const p = projectById.get(e.projectId);
        return (
          (p && p.name.toLowerCase().includes(q)) ||
          e.note.toLowerCase().includes(q)
        );
      });
    });
  }, [dates, data.reports, projectById, query]);

  const current = selected ?? filteredDates[0] ?? null;
  const report = current ? data.reports[current] : null;

  return (
    <div className="archive">
      <aside className="archive-list">
        <input
          type="search"
          placeholder="日付・案件・本文で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul>
          {filteredDates.length === 0 && (
            <li className="muted">該当なし</li>
          )}
          {filteredDates.map((d) => {
            const r = data.reports[d];
            const names = r.entries
              .map((e) => projectById.get(e.projectId)?.name)
              .filter(Boolean)
              .join(" / ");
            return (
              <li key={d}>
                <button
                  className={d === current ? "on" : ""}
                  onClick={() => setSelected(d)}
                >
                  <div className="date">{d}</div>
                  <div className="preview muted">{names || "（記載なし）"}</div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
      <section className="archive-detail">
        {report && current ? (
          <article className="report">
            <h2 className="report-date">{current} の日報</h2>
            {report.oneLiner.trim() && (
              <section className="one-liner">
                <h3>今日のひとこと</h3>
                <p>{report.oneLiner}</p>
              </section>
            )}
            <section className="entries">
              <h3>案件</h3>
              {report.entries.length === 0 ? (
                <p className="muted">記載なし</p>
              ) : (
                <ul>
                  {report.entries.map((e) => {
                    const p = projectById.get(e.projectId);
                    if (!p) return null;
                    const completedToday =
                      p.status === "done" && p.completedAt === current;
                    return (
                      <li key={e.projectId} className="entry">
                        <div className="entry-head">
                          <span className="proj-name">{p.name}</span>
                          {completedToday && <span className="badge done">完了</span>}
                        </div>
                        <div className="entry-note">
                          {e.note.trim() ? e.note : <span className="muted">（記載なし）</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </article>
        ) : (
          <p className="muted">日報を選択してください。</p>
        )}
      </section>
    </div>
  );
}
