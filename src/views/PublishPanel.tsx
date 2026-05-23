import { useState } from "react";
import {
  clearSettings,
  defaultSettings,
  loadSettings,
  publicUrl,
  publishDataFile,
  saveSettings,
  verifyAccess,
  type GhSettings,
  type PublishResult,
} from "../github";
import { encryptJson } from "../crypto";
import { type DataFile } from "../types";

type Props = {
  data: DataFile;
  date: string;
  password: string;
  encrypt: boolean;
};

type Phase =
  | { kind: "idle" }
  | { kind: "verifying" }
  | { kind: "publishing" }
  | { kind: "done"; result: PublishResult; url: string }
  | { kind: "error"; message: string };

export default function PublishPanel({ data, date, password, encrypt }: Props) {
  const [settings, setSettings] = useState<GhSettings | null>(() => loadSettings());
  const [showSetup, setShowSetup] = useState(false);
  const [draft, setDraft] = useState(() => {
    const s = loadSettings();
    return s
      ? { owner: s.owner, repo: s.repo, branch: s.branch, path: s.path, token: s.token }
      : { ...defaultSettings(), token: "" };
  });
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const saveAndClose = async () => {
    setPhase({ kind: "verifying" });
    try {
      const next: GhSettings = {
        owner: draft.owner.trim(),
        repo: draft.repo.trim(),
        branch: draft.branch.trim() || "main",
        path: draft.path.trim() || "public/data/data.json",
        token: draft.token.trim(),
      };
      await verifyAccess(next);
      saveSettings(next);
      setSettings(next);
      setShowSetup(false);
      setPhase({ kind: "idle" });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  };

  const handlePublish = async () => {
    if (!settings) {
      setShowSetup(true);
      return;
    }
    if (encrypt && !password) {
      setPhase({
        kind: "error",
        message: "暗号化が有効ですがパスワードが入っていません。",
      });
      return;
    }
    setPhase({ kind: "publishing" });
    try {
      const payload = encrypt
        ? await encryptJson(data, password)
        : data;
      const text = JSON.stringify(payload, null, 2);
      const result = await publishDataFile(
        settings,
        text,
        `Update data.json (${date})`,
      );
      setPhase({ kind: "done", result, url: publicUrl(settings) });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  };

  const handleClearSettings = () => {
    if (!confirm("GitHub 設定（トークン含む）をこのブラウザから削除します。よろしいですか？")) return;
    clearSettings();
    setSettings(null);
    setDraft({ ...defaultSettings(), token: "" });
  };

  const copyShare = async () => {
    if (phase.kind !== "done") return;
    const text = `${date} の日報\n${phase.url}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <section className="block publish-panel">
      <div className="block-head">
        <h3>公開（GitHub Pages）</h3>
        {settings && (
          <button className="ghost small" onClick={() => setShowSetup(true)}>
            設定
          </button>
        )}
      </div>

      {!settings && !showSetup && (
        <div className="publish-empty">
          <p className="muted small">
            初回だけ GitHub のリポジトリと Fine-grained PAT を登録すれば、以降は1クリックで公開できます。
          </p>
          <button className="primary" onClick={() => setShowSetup(true)}>
            GitHub 連携を設定する
          </button>
        </div>
      )}

      {settings && !showSetup && (
        <div className="publish-actions">
          <div className="muted small">
            公開先: <code>{settings.owner}/{settings.repo}</code> →{" "}
            <a href={publicUrl(settings)} target="_blank" rel="noreferrer">
              {publicUrl(settings)}
            </a>
          </div>
          <div className="publish-buttons">
            <button
              className="primary"
              onClick={() => void handlePublish()}
              disabled={phase.kind === "publishing" || phase.kind === "verifying"}
            >
              {phase.kind === "publishing" ? "公開中…" : "GitHub に公開"}
            </button>
          </div>
        </div>
      )}

      {showSetup && (
        <div className="publish-setup">
          <label>
            owner（GitHub ユーザー名 or org）
            <input
              type="text"
              value={draft.owner}
              onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              placeholder="yamadap-commits"
            />
          </label>
          <label>
            repo（リポジトリ名）
            <input
              type="text"
              value={draft.repo}
              onChange={(e) => setDraft({ ...draft, repo: e.target.value })}
              placeholder="bees-nippo"
            />
          </label>
          <label>
            branch
            <input
              type="text"
              value={draft.branch}
              onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
              placeholder="main"
            />
          </label>
          <label>
            path
            <input
              type="text"
              value={draft.path}
              onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              placeholder="public/data/data.json"
            />
          </label>
          <label>
            Fine-grained PAT（Contents: Read and write 権限）
            <input
              type="password"
              value={draft.token}
              onChange={(e) => setDraft({ ...draft, token: e.target.value })}
              placeholder="github_pat_..."
            />
          </label>
          <p className="muted small">
            トークン作成: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens →
            Generate new token →
            Resource owner: 自分 → Repository access: <code>bees-nippo</code> のみ →
            Repository permissions → Contents: Read and write
          </p>
          <div className="setup-buttons">
            {settings && (
              <button className="ghost" onClick={handleClearSettings}>
                設定を削除
              </button>
            )}
            <div className="spacer" />
            <button className="ghost" onClick={() => setShowSetup(false)}>
              キャンセル
            </button>
            <button
              className="primary"
              onClick={() => void saveAndClose()}
              disabled={phase.kind === "verifying"}
            >
              {phase.kind === "verifying" ? "確認中…" : "保存して接続テスト"}
            </button>
          </div>
        </div>
      )}

      {phase.kind === "error" && (
        <p className="error small">{phase.message}</p>
      )}

      {phase.kind === "done" && (
        <div className="publish-done">
          <p>
            ✓ 公開しました。GitHub Actions のデプロイ完了まで 1〜2 分待ってからアクセスしてください。
          </p>
          <div className="publish-done-actions">
            <a
              className="link"
              href={phase.url}
              target="_blank"
              rel="noreferrer"
            >
              公開ページを開く
            </a>
            <a
              className="link"
              href={phase.result.workflowRunUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
            >
              デプロイ状況
            </a>
            <button className="ghost small" onClick={() => void copyShare()}>
              Discord 用テキストをコピー
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
