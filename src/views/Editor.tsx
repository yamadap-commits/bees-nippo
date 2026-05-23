import { useEffect, useMemo, useState } from "react";
import {
  clearDraft,
  createId,
  downloadEncryptedJson,
  downloadJson,
  ensureTodayReport,
  forgetPassword,
  loadDraft,
  mergeDraftWithInitial,
  previousNoteFor,
  rememberPassword,
  saveDraft,
  todayKey,
} from "../data";
import { type DataFile, type Project } from "../types";
import PublishPanel from "./PublishPanel";

type Props = {
  initial: DataFile;
  currentPassword: string | null;
  encrypted: boolean;
};

export default function Editor({ initial, currentPassword, encrypted }: Props) {
  const [date, setDate] = useState<string>(todayKey());
  const [data, setData] = useState<DataFile>(() => {
    const draft = loadDraft();
    const base = mergeDraftWithInitial(initial, draft);
    return ensureTodayReport(base, todayKey());
  });
  const [savedAt, setSavedAt] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState("");

  const [password, setPassword] = useState<string>(currentPassword ?? "");
  const [showPw, setShowPw] = useState(false);
  const [encryptOnExport, setEncryptOnExport] = useState<boolean>(
    encrypted || !!currentPassword,
  );

  useEffect(() => {
    setData((d) => ensureTodayReport(d, date));
  }, [date]);

  useEffect(() => {
    saveDraft(data);
    setSavedAt(new Date().toLocaleTimeString());
  }, [data]);

  const projectById = useMemo(
    () => new Map(data.projects.map((p) => [p.id, p])),
    [data.projects],
  );
  const report = data.reports[date];

  const update = (mutator: (d: DataFile) => DataFile) =>
    setData((d) => mutator(structuredClone(d)));

  const setOneLiner = (v: string) =>
    update((d) => {
      d.reports[date].oneLiner = v;
      return d;
    });

  const setNote = (projectId: string, note: string) =>
    update((d) => {
      const e = d.reports[date].entries.find((x) => x.projectId === projectId);
      if (e) e.note = note;
      return d;
    });

  const addProject = () => {
    const name = newProjectName.trim();
    if (!name) return;
    const proj: Project = {
      id: createId(),
      name,
      status: "active",
      createdAt: date,
      completedAt: null,
    };
    update((d) => {
      d.projects.push(proj);
      d.reports[date].entries.push({ projectId: proj.id, note: "" });
      return d;
    });
    setNewProjectName("");
  };

  const toggleDone = (projectId: string) =>
    update((d) => {
      const p = d.projects.find((x) => x.id === projectId);
      if (!p) return d;
      if (p.status === "active") {
        p.status = "done";
        p.completedAt = date;
      } else {
        p.status = "active";
        p.completedAt = null;
      }
      return d;
    });

  const removeFromToday = (projectId: string) =>
    update((d) => {
      d.reports[date].entries = d.reports[date].entries.filter(
        (e) => e.projectId !== projectId,
      );
      return d;
    });

  const copyYesterdayNote = (projectId: string) => {
    update((d) => {
      const prev = previousNoteFor(d, projectId, date);
      if (prev === null) return d;
      const cur = d.reports[date].entries.find(
        (x) => x.projectId === projectId,
      );
      if (cur) cur.note = prev;
      return d;
    });
  };

  const fillAllFromYesterday = () => {
    if (!confirm("今日のすべての案件メモを前日の内容で上書きします。よろしいですか？")) return;
    update((d) => {
      for (const e of d.reports[date].entries) {
        const prev = previousNoteFor(d, e.projectId, date);
        if (prev !== null) e.note = prev;
      }
      return d;
    });
  };

  const resetDraft = () => {
    if (!confirm("下書きを破棄して、最後にダウンロードされた data.json の状態に戻します。よろしいですか？")) return;
    clearDraft();
    setData(ensureTodayReport(initial, date));
  };

  const exportFile = async () => {
    if (encryptOnExport) {
      if (!password) {
        alert("暗号化するにはパスワードを入力してください。");
        return;
      }
      await downloadEncryptedJson(data, password, "data.json");
      rememberPassword(password, true);
    } else {
      if (encrypted) {
        const ok = confirm(
          "現在は暗号化された data.json が公開されています。平文でダウンロードして上書きすると、誰でも中身が見える状態になります。本当に続けますか？",
        );
        if (!ok) return;
        forgetPassword();
      }
      downloadJson(data, "data.json");
    }
  };

  if (!report) return null;

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <label>
          日付
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <span className="saved muted">自動下書き保存: {savedAt || "-"}</span>
        <div className="spacer" />
        <button onClick={resetDraft} className="ghost">下書きを破棄</button>
        <button onClick={() => void exportFile()} className="primary">
          {encryptOnExport ? "暗号化して保存" : "平文で保存"}
        </button>
      </div>

      <PublishPanel
        data={data}
        date={date}
        password={password}
        encrypt={encryptOnExport}
      />

      <section className="block password-block">
        <h3>パスワード（社内共有用）</h3>
        <div className="password-row">
          <input
            type={showPw ? "text" : "password"}
            placeholder="パスワード（変更したい時だけ入れ直す）"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="ghost small" onClick={() => setShowPw((v) => !v)}>
            {showPw ? "隠す" : "表示"}
          </button>
          <label className="done-toggle">
            <input
              type="checkbox"
              checked={encryptOnExport}
              onChange={(e) => setEncryptOnExport(e.target.checked)}
            />
            暗号化する
          </label>
        </div>
        <p className="muted small">
          パスワードを社内 Discord にピン留めして共有しておくと、閲覧者はパスワードを入れるだけで日報を見られます。
        </p>
      </section>

      <section className="block">
        <h3>今日のひとこと</h3>
        <textarea
          value={report.oneLiner}
          onChange={(e) => setOneLiner(e.target.value)}
          placeholder="今日感じたこと・雑感など"
          rows={2}
        />
      </section>

      <section className="block">
        <div className="block-head">
          <h3>案件</h3>
          <button className="ghost small" onClick={fillAllFromYesterday}>
            前日内容で全件埋め直す
          </button>
        </div>
        <ul className="entry-edit-list">
          {report.entries.map((e) => {
            const p = projectById.get(e.projectId);
            if (!p) return null;
            return (
              <li key={e.projectId} className="entry-edit">
                <div className="entry-edit-head">
                  <label className="done-toggle">
                    <input
                      type="checkbox"
                      checked={p.status === "done"}
                      onChange={() => toggleDone(p.id)}
                    />
                    完了
                  </label>
                  <span className="proj-name">{p.name}</span>
                  <button
                    className="ghost small"
                    onClick={() => copyYesterdayNote(p.id)}
                    title="前日のメモを再コピー"
                  >
                    前日コピー
                  </button>
                  <button
                    className="ghost small"
                    onClick={() => removeFromToday(p.id)}
                    title="この日の日報から外す（案件自体は残ります）"
                  >
                    今日から外す
                  </button>
                </div>
                <textarea
                  value={e.note}
                  onChange={(ev) => setNote(p.id, ev.target.value)}
                  placeholder="状況をひとことで"
                  rows={2}
                />
              </li>
            );
          })}
        </ul>

        <div className="add-project">
          <input
            type="text"
            placeholder="新しい案件名"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addProject();
            }}
          />
          <button onClick={addProject}>＋ 追加</button>
        </div>
      </section>

      <section className="block help">
        <h3>反映手順</h3>
        <ol>
          <li>「暗号化して保存」を押すと <code>data.json</code> がダウンロードされる</li>
          <li>リポジトリの <code>public/data/data.json</code> を上書き</li>
          <li><code>git add &amp;&amp; commit &amp;&amp; push</code> で GitHub Pages に自動デプロイ</li>
          <li>トップで「Discord 用テキストをコピー」を押して貼り付け</li>
        </ol>
      </section>
    </div>
  );
}
