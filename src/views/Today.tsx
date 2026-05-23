import { useState } from "react";
import { latestReportDate } from "../data";
import { type DataFile } from "../types";

export default function Today({ data }: { data: DataFile }) {
  const date = latestReportDate(data);
  const [copied, setCopied] = useState<string>("");

  if (!date) {
    return <p className="muted">まだ日報がありません。「編集」から作成してください。</p>;
  }
  const report = data.reports[date];
  const projectById = new Map(data.projects.map((p) => [p.id, p]));

  const shareUrl = `${window.location.origin}${window.location.pathname}`;

  const copyShareText = async () => {
    const text = `${date} の日報\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Discord 用テキストをコピーしました");
    } catch {
      setCopied("コピーに失敗しました（手動でコピーしてください）");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied("URL をコピーしました");
    } catch {
      setCopied("コピーに失敗しました");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  return (
    <article className="report">
      <div className="report-header">
        <h2 className="report-date">{date} の日報</h2>
        <div className="share-actions">
          <button className="ghost small" onClick={copyUrl}>URL コピー</button>
          <button className="primary small" onClick={copyShareText}>
            Discord 用テキストをコピー
          </button>
        </div>
      </div>
      {copied && <p className="copied-flash">{copied}</p>}

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
              const completedToday = p.status === "done" && p.completedAt === date;
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
  );
}
